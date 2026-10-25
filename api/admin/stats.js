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
      SELECT audience, status, count(*)::int AS count
      FROM leads
      GROUP BY audience, status
    `;
  } catch (err) {
    console.error('admin/stats: query failed', err);
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  const counts = {
    parent: { active: 0, unsubscribed: 0 },
    educator: { active: 0, unsubscribed: 0 },
    both: { active: 0, unsubscribed: 0 },
    total_active: 0,
  };

  for (const row of rows) {
    if (counts[row.audience] && (row.status === 'active' || row.status === 'unsubscribed')) {
      counts[row.audience][row.status] = row.count;
    }
  }
  counts.total_active = counts.parent.active + counts.educator.active + counts.both.active;

  res.status(200).json({ ok: true, counts });
}
