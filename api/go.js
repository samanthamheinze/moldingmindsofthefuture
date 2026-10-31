import { getSql } from './_lib/db.js';

const FALLBACK_URL = 'https://www.teacherspayteachers.com/store/molding-minds-of-the-future';

function isAllowedTarget(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      (parsed.hostname === 'teacherspayteachers.com' || parsed.hostname.endsWith('.teacherspayteachers.com'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const q = req.query || {};
  const get = (key) => (Array.isArray(q[key]) ? q[key][0] : q[key]);

  const target = get('u');
  const destination = isAllowedTarget(target) ? target : FALLBACK_URL;

  try {
    const sql = getSql();
    await sql`
      INSERT INTO clicks (target_url, source, campaign_id, lead_id)
      VALUES (${destination}, ${get('src') ?? null}, ${get('c') ?? null}, ${get('l') ?? null})
    `;
  } catch (err) {
    // Never let logging failure block the redirect — the visitor should
    // always land on TPT regardless of whether we could record the click.
    console.error('go: failed to log click', err);
  }

  res.redirect(302, destination);
}
