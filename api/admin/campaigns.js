import { getSql } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

const VALID_AUDIENCES = new Set(['parent', 'educator', 'all']);

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  const sql = getSql();

  if (req.method === 'GET') {
    let rows;
    try {
      rows = await sql`
        SELECT c.id, c.audience, c.subject, c.status, c.recipient_count, c.created_at, c.sent_at,
          c.scheduled_for, COALESCE(clk.click_count, 0)::int AS click_count
        FROM campaigns c
        LEFT JOIN (
          SELECT campaign_id, count(*) AS click_count
          FROM clicks
          WHERE campaign_id IS NOT NULL
          GROUP BY campaign_id
        ) clk ON clk.campaign_id = c.id
        ORDER BY c.created_at DESC
      `;
    } catch (err) {
      console.error('admin/campaigns GET: query failed', err);
      res.status(500).json({ ok: false, error: 'server_error' });
      return;
    }
    res.status(200).json({ ok: true, campaigns: rows });
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (!body || typeof body !== 'object') body = {};

    const { audience, subject, html_body, freebie_url, scheduled_for } = body;

    if (!VALID_AUDIENCES.has(audience)) {
      res.status(400).json({ ok: false, error: 'invalid_audience' });
      return;
    }
    if (typeof subject !== 'string' || !subject.trim()) {
      res.status(400).json({ ok: false, error: 'invalid_subject' });
      return;
    }
    if (typeof html_body !== 'string' || !html_body.trim()) {
      res.status(400).json({ ok: false, error: 'invalid_html_body' });
      return;
    }
    let scheduledForValue = null;
    if (typeof scheduled_for === 'string' && scheduled_for.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduled_for.trim())) {
        res.status(400).json({ ok: false, error: 'invalid_scheduled_for' });
        return;
      }
      scheduledForValue = scheduled_for.trim();
    }

    let rows;
    try {
      rows = await sql`
        INSERT INTO campaigns (audience, subject, html_body, freebie_url, status, scheduled_for)
        VALUES (${audience}, ${subject}, ${html_body}, ${freebie_url ?? null}, 'draft', ${scheduledForValue})
        RETURNING *
      `;
    } catch (err) {
      console.error('admin/campaigns POST: insert failed', err);
      res.status(500).json({ ok: false, error: 'server_error' });
      return;
    }

    res.status(201).json({ ok: true, campaign: rows[0] });
    return;
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
