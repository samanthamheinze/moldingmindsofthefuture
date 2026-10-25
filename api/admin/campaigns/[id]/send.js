import { getSql } from '../../../_lib/db.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { sendEmail } from '../../../_lib/email.js';
import { wrapEmail } from '../../../_lib/emailTemplate.js';

const DEFAULT_LIMIT = 200;
const CONCURRENCY = 5;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!id) {
    res.status(400).json({ ok: false, error: 'missing_id' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== 'object') body = {};

  let limit = Number(body.limit);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;

  const sql = getSql();

  let campaign;
  try {
    const rows = await sql`SELECT * FROM campaigns WHERE id = ${id}`;
    campaign = rows[0];
  } catch (err) {
    console.error('admin/campaigns/[id]/send: load campaign failed', err);
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  if (!campaign) {
    res.status(404).json({ ok: false, error: 'not_found' });
    return;
  }

  if (campaign.status === 'draft') {
    try {
      await sql`UPDATE campaigns SET status = 'sending' WHERE id = ${id}`;
      campaign.status = 'sending';
    } catch (err) {
      console.error('admin/campaigns/[id]/send: status update failed', err);
      res.status(500).json({ ok: false, error: 'server_error' });
      return;
    }
  }

  const matchAll = campaign.audience === 'all';

  let leads;
  try {
    leads = matchAll
      ? await sql`
          SELECT l.id, l.email, l.unsubscribe_token
          FROM leads l
          WHERE l.status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM campaign_recipients cr
              WHERE cr.campaign_id = ${id} AND cr.lead_id = l.id AND cr.status = 'sent'
            )
          LIMIT ${limit}
        `
      : await sql`
          SELECT l.id, l.email, l.unsubscribe_token
          FROM leads l
          WHERE l.status = 'active'
            AND (l.audience = ${campaign.audience} OR l.audience = 'both')
            AND NOT EXISTS (
              SELECT 1 FROM campaign_recipients cr
              WHERE cr.campaign_id = ${id} AND cr.lead_id = l.id AND cr.status = 'sent'
            )
          LIMIT ${limit}
        `;
  } catch (err) {
    console.error('admin/campaigns/[id]/send: select leads failed', err);
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  const siteUrl = process.env.SITE_URL || '';
  let sentCount = 0;

  for (const batch of chunk(leads, CONCURRENCY)) {
    await Promise.all(
      batch.map(async (lead) => {
        const unsubscribeUrl = `${siteUrl}/api/unsubscribe?token=${lead.unsubscribe_token}`;
        const html = wrapEmail({
          subject: campaign.subject,
          bodyHtml:
            campaign.html_body +
            (campaign.freebie_url
              ? `<p><a href="${campaign.freebie_url}">Get this month's freebie</a></p>`
              : ''),
          unsubscribeUrl,
        });

        try {
          const messageId = await sendEmail({ to: lead.email, subject: campaign.subject, html });
          await sql`
            INSERT INTO campaign_recipients (campaign_id, lead_id, status, resend_message_id, sent_at)
            VALUES (${id}, ${lead.id}, 'sent', ${messageId}, now())
            ON CONFLICT (campaign_id, lead_id) DO UPDATE
              SET status = 'sent', resend_message_id = excluded.resend_message_id, sent_at = now(), error = NULL
          `;
          sentCount += 1;
        } catch (err) {
          console.error('admin/campaigns/[id]/send: send failed for', lead.email, err);
          try {
            await sql`
              INSERT INTO campaign_recipients (campaign_id, lead_id, status, error)
              VALUES (${id}, ${lead.id}, 'failed', ${String(err && err.message ? err.message : err)})
              ON CONFLICT (campaign_id, lead_id) DO UPDATE
                SET status = 'failed', error = excluded.error
            `;
          } catch (innerErr) {
            console.error('admin/campaigns/[id]/send: failed to record failure', innerErr);
          }
        }
      })
    );
  }

  let remaining = 0;
  try {
    const remainingRows = matchAll
      ? await sql`
          SELECT count(*)::int AS count
          FROM leads l
          WHERE l.status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM campaign_recipients cr
              WHERE cr.campaign_id = ${id} AND cr.lead_id = l.id AND cr.status = 'sent'
            )
        `
      : await sql`
          SELECT count(*)::int AS count
          FROM leads l
          WHERE l.status = 'active'
            AND (l.audience = ${campaign.audience} OR l.audience = 'both')
            AND NOT EXISTS (
              SELECT 1 FROM campaign_recipients cr
              WHERE cr.campaign_id = ${id} AND cr.lead_id = l.id AND cr.status = 'sent'
            )
        `;
    remaining = remainingRows[0]?.count ?? 0;
  } catch (err) {
    console.error('admin/campaigns/[id]/send: remaining count failed', err);
  }

  let finalStatus = campaign.status;
  if (remaining === 0) {
    try {
      const sentCountRows = await sql`
        SELECT count(*)::int AS count FROM campaign_recipients
        WHERE campaign_id = ${id} AND status = 'sent'
      `;
      const totalSent = sentCountRows[0]?.count ?? 0;
      await sql`
        UPDATE campaigns
        SET status = 'sent', sent_at = now(), recipient_count = ${totalSent}
        WHERE id = ${id}
      `;
      finalStatus = 'sent';
    } catch (err) {
      console.error('admin/campaigns/[id]/send: finalize failed', err);
    }
  }

  res.status(200).json({
    ok: true,
    status: finalStatus,
    sent_this_batch: sentCount,
    remaining,
  });
}
