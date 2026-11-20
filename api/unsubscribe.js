import { getSql } from './_lib/db.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STYLE = `<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    font-family: 'Nunito', sans-serif;
    color: #2C2547;
    padding: 24px;
  }
  .card {
    max-width: 440px;
    width: 100%;
    text-align: center;
    background: #ffffff;
    border: 1px solid #eee6f7;
    border-radius: 20px;
    padding: 40px 32px;
    box-shadow: 0 10px 30px rgba(44, 37, 71, 0.08);
  }
  .secondary {
    display: block;
    margin-top: 16px;
    font-size: 14px;
    color: #8A86A0;
  }
  .icon {
    font-size: 42px;
    margin-bottom: 8px;
  }
  h1 {
    font-family: 'Poppins', sans-serif;
    font-size: 24px;
    color: #2C2547;
    margin: 0 0 12px;
  }
  p {
    font-size: 16px;
    line-height: 1.5;
    margin: 0 0 24px;
    color: #2C2547;
  }
  .accent {
    color: #7C5CBF;
    font-weight: 700;
  }
  a.button, button.button {
    display: inline-block;
    background: #4BAE8A;
    color: #ffffff;
    text-decoration: none;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    font-size: 15px;
    padding: 12px 28px;
    border-radius: 999px;
    transition: opacity 0.15s ease;
  }
  button.button {
    border: 0;
    cursor: pointer;
  }
  a.button:hover, button.button:hover {
    opacity: 0.9;
  }
</style>`;

function page(title, inner) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Nunito:wght@400;600&display=swap" rel="stylesheet">
${STYLE}
</head>
<body>
  <div class="card">
    <div class="icon">💜</div>
${inner}
  </div>
</body>
</html>
`;
}

// Shown on GET. Opening the link changes nothing, so school/corporate email
// scanners that pre-open every link (e.g. Outlook Safe Links) can't
// unsubscribe anyone by accident. Only the button's POST does.
function confirmPage(token) {
  return page('Unsubscribe', `    <h1>Unsubscribe?</h1>
    <p>Click the button below and you won't receive any more emails from the <span class="accent">Molding Minds of the Future</span> community.</p>
    <form method="POST" action="/api/unsubscribe?token=${token}">
      <button class="button" type="submit">Unsubscribe</button>
    </form>
    <a class="secondary" href="https://moldingmindsofthefuture.com">Never mind, keep me subscribed</a>`);
}

const DONE_HTML = page('Unsubscribed', `    <h1>You've been unsubscribed</h1>
    <p>We're sorry to see you go! You won't receive any more emails from the <span class="accent">Molding Minds of the Future</span> community.</p>
    <a class="button" href="https://moldingmindsofthefuture.com">Back to the site</a>`);

// GET  /api/unsubscribe?token=...  -> confirmation page with a button (no DB change)
// POST /api/unsubscribe?token=...  -> unsubscribes. Used by that button and by
//      Gmail/Yahoo one-click unsubscribe (RFC 8058, body "List-Unsubscribe=One-Click").
export default async function handler(req, res) {
  const raw = Array.isArray(req.query?.token) ? req.query.token[0] : req.query?.token;
  const token = typeof raw === 'string' && UUID_RE.test(raw) ? raw : null;

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html').status(200).send(token ? confirmPage(token) : DONE_HTML);
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  if (token) {
    try {
      const sql = getSql();
      await sql`
        UPDATE leads
        SET status = 'unsubscribed', unsubscribed_at = now()
        WHERE unsubscribe_token = ${token} AND status != 'unsubscribed'
      `;
    } catch (err) {
      // Never let a lookup/update failure surface to the visitor — the page
      // must always render the same friendly confirmation regardless of
      // whether the token was valid, already used, or malformed.
      console.error('unsubscribe: db update failed', err);
    }
  }

  res.setHeader('Content-Type', 'text/html').status(200).send(DONE_HTML);
}
