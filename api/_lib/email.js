import welcomeParentHtml from './templates/welcome-parent.js';
import welcomeEducatorHtml from './templates/welcome-educator.js';
import { wrapTptLinks } from './tracking.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

// Low-level send via the Resend REST API. Throws a descriptive error if the
// required env vars are missing or Resend responds non-2xx — callers decide
// how to handle/log the failure (this file never swallows errors silently).
export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new Error('sendEmail: RESEND_API_KEY is not configured');
  }
  if (!from) {
    throw new Error('sendEmail: RESEND_FROM_EMAIL is not configured');
  }

  let res;
  try {
    res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
  } catch (err) {
    throw new Error(`sendEmail: network error calling Resend: ${err && err.message ? err.message : err}`);
  }

  if (!res.ok) {
    let bodyText;
    try {
      bodyText = await res.text();
    } catch {
      bodyText = '<unreadable body>';
    }
    throw new Error(`sendEmail: Resend API responded ${res.status}: ${bodyText}`);
  }

  const data = await res.json();
  return data.id;
}

// Welcome emails use the designer-provided templates verbatim (see
// ./templates/welcome-parent.js and ./templates/welcome-educator.js) — only
// the subject line and the {{UNSUBSCRIBE_URL}} placeholder are set here.
// Asset URLs and the freebie landing-page link are already baked into those
// template files.
const WELCOME_EMAILS = {
  parent: {
    subject: 'Welcome to the Molding Minds family 💜 Your free week of play is inside',
    html: welcomeParentHtml,
  },
  educator: {
    subject: 'Welcome, teacher friend 🍎 Your free decodable passages are here',
    html: welcomeEducatorHtml,
  },
};

// Called by api/subscribe.js via a dynamic import('./_lib/email.js') —
// keep this signature and file path exactly as-is for that integration.
export async function sendWelcomeEmail({ email, audience, unsubscribeToken, leadId }) {
  const entry = WELCOME_EMAILS[audience];
  if (!entry) {
    throw new Error(`sendWelcomeEmail: unknown audience "${audience}"`);
  }

  const siteUrl = process.env.SITE_URL || '';
  const unsubscribeUrl = `${siteUrl}/api/unsubscribe?token=${unsubscribeToken}`;
  let html = entry.html.split('{{UNSUBSCRIBE_URL}}').join(unsubscribeUrl);
  html = wrapTptLinks(html, { source: `welcome_${audience}`, leadId });

  return sendEmail({ to: email, subject: entry.subject, html });
}
