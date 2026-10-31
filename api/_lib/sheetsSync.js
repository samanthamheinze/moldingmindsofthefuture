import crypto from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Cached for the lifetime of a warm serverless instance — avoids re-signing
// a JWT and re-exchanging it on every signup/unsubscribe within the window.
let cachedToken = null;
let cachedTokenExpiresAt = 0;
let cachedSheetMeta = null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`sheetsSync: ${name} is not configured`);
  return value;
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60000) return cachedToken;

  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = requireEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: email,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64url(header)}.${b64url(claims)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`sheetsSync: token exchange failed ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function sheetsFetch(path, opts = {}) {
  const spreadsheetId = requireEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    ...opts,
    headers: { ...opts.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`sheetsSync: Sheets API ${path} failed ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function getSheetIdByTitle(title) {
  if (!cachedSheetMeta) {
    cachedSheetMeta = await sheetsFetch('?fields=sheets.properties');
  }
  const sheet = cachedSheetMeta.sheets.find((s) => s.properties.title === title);
  if (!sheet) throw new Error(`sheetsSync: tab "${title}" not found in spreadsheet`);
  return sheet.properties.sheetId;
}

async function findRowByEmail(tabTitle, email) {
  const data = await sheetsFetch(`/values/${encodeURIComponent(tabTitle)}!B2:B`);
  const rows = data.values || [];
  const idx = rows.findIndex((r) => (r[0] || '').trim().toLowerCase() === email.toLowerCase());
  return idx === -1 ? null : idx + 2; // +2: 1-indexed, offset by header row
}

async function deleteRow(tabTitle, rowNumber) {
  const sheetId = await getSheetIdByTitle(tabTitle);
  await sheetsFetch(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        },
      ],
    }),
  });
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toISOString().slice(0, 10);
}

async function syncTabRow(tabTitle, lead, eligible) {
  const rowNumber = await findRowByEmail(tabTitle, lead.email);

  if (!eligible) {
    if (rowNumber) await deleteRow(tabTitle, rowNumber);
    return;
  }

  const values = [[lead.name, lead.email, lead.audience, formatDate(lead.created_at)]];
  if (rowNumber) {
    await sheetsFetch(`/values/${encodeURIComponent(tabTitle)}!A${rowNumber}:D${rowNumber}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  } else {
    await sheetsFetch(`/values/${encodeURIComponent(tabTitle)}!A:D:append?valueInputOption=RAW`, {
      method: 'POST',
      body: JSON.stringify({ values }),
    });
  }
}

// Keeps the Educators/Parents tabs in sync with one lead's current state.
// Best-effort: never throws, since this must never block a signup or
// unsubscribe response. Call after every lead insert/update.
export async function syncLeadToSheet(lead) {
  try {
    const active = lead.status === 'active';
    const parentEligible = active && (lead.audience === 'parent' || lead.audience === 'both');
    const educatorEligible = active && (lead.audience === 'educator' || lead.audience === 'both');
    await syncTabRow('Parents', lead, parentEligible);
    await syncTabRow('Educators', lead, educatorEligible);
  } catch (err) {
    console.error('syncLeadToSheet failed', err);
  }
}
