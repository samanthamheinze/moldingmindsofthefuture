import { getSql } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const sql = getSql();

  let rows;
  try {
    rows = await sql`
      SELECT COALESCE(utm_source, 'direct / unknown') AS source, audience, count(*)::int AS count
      FROM leads
      WHERE status = 'active'
      GROUP BY source, audience
      ORDER BY count DESC
    `;
  } catch (err) {
    console.error('admin/channels: query failed', err);
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  res.status(200).json({ ok: true, channels: rows });
}
