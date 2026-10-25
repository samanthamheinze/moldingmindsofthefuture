import { getSql } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';

function csvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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
      SELECT name, email, audience, status, created_at
      FROM leads
      ORDER BY created_at DESC
    `;
  } catch (err) {
    console.error('admin/leads/export: query failed', err);
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  const lines = ['name,email,audience,status,created_at'];
  for (const row of rows) {
    lines.push([
      csvField(row.name),
      csvField(row.email),
      csvField(row.audience),
      csvField(row.status),
      csvField(row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at),
    ].join(','));
  }
  const csv = lines.join('\n') + '\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
  res.status(200).send(csv);
}
