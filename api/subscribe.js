import { getSql } from './_lib/db.js';
import { normalizeEmail, normalizeName, isValidAudience, isBotSuspected } from './_lib/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
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

  const { audience: rawAudience, source, hp, hp_time_ms, consent } = body;

  // Bot check happens before validation errors are surfaced, but we still
  // need a normalized email/audience shape to decide what "suspected" means.
  // Per spec: if a bot is suspected, return 200 ok:true and skip all DB/email
  // work regardless of whether the fields would otherwise validate.
  if (isBotSuspected({ hp, hp_time_ms })) {
    res.status(200).json({ ok: true, message: 'Check your inbox!' });
    return;
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    res.status(400).json({ ok: false, error: 'invalid_email' });
    return;
  }

  const name = normalizeName(body.name);
  if (!name) {
    res.status(400).json({ ok: false, error: 'invalid_name' });
    return;
  }

  if (!isValidAudience(rawAudience)) {
    res.status(400).json({ ok: false, error: 'invalid_audience' });
    return;
  }
  const audience = rawAudience;

  if (consent !== true) {
    res.status(400).json({ ok: false, error: 'consent_required' });
    return;
  }

  const sql = getSql();

  let row;
  try {
    const rows = await sql`
      INSERT INTO leads (email, name, audience, source, status, terms_accepted_at)
      VALUES (${email}, ${name}, ${audience}, ${source ?? null}, 'active', now())
      ON CONFLICT (email) DO UPDATE
        SET name = excluded.name,
            audience = excluded.audience,
            status = 'active',
            terms_accepted_at = now()
      RETURNING *
    `;
    row = rows[0];
  } catch (err) {
    console.error('subscribe: db upsert failed', err);
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  // row.welcome_email_sent_at reflects the pre-existing value, since this
  // upsert never writes that column itself — so "null here" means "never
  // sent before," whether the lead was just inserted or just reactivated.
  if (row && row.welcome_email_sent_at == null) {
    try {
      const { sendWelcomeEmail } = await import('./_lib/email.js');
      // 'both' gets both welcome emails (and both freebies) — everything
      // else about a 'both' lead (campaign targeting, unsubscribe) treats
      // it as matching either audience.
      const audiencesToEmail = row.audience === 'both' ? ['parent', 'educator'] : [row.audience];
      for (const aud of audiencesToEmail) {
        await sendWelcomeEmail({
          email: row.email,
          audience: aud,
          unsubscribeToken: row.unsubscribe_token,
        });
      }
      await sql`
        UPDATE leads
        SET welcome_email_sent_at = now(), welcome_email_error = NULL
        WHERE id = ${row.id}
      `;
    } catch (err) {
      console.error('subscribe: welcome email failed', err);
      try {
        await sql`
          UPDATE leads
          SET welcome_email_error = ${String(err && err.message ? err.message : err)}
          WHERE id = ${row.id}
        `;
      } catch (innerErr) {
        console.error('subscribe: failed to record welcome_email_error', innerErr);
      }
    }
  }

  res.status(200).json({ ok: true, message: 'Check your inbox!' });
}
