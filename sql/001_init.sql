-- Applied once by hand against Neon. Not run automatically by the app.

CREATE TABLE leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text NOT NULL UNIQUE,
  audience              text NOT NULL CHECK (audience IN ('parent','educator')),
  status                text NOT NULL DEFAULT 'active' CHECK (status IN ('active','unsubscribed')),
  source                text,
  unsubscribe_token     uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  welcome_email_sent_at timestamptz,
  welcome_email_error   text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at       timestamptz
);
CREATE INDEX leads_audience_status_idx ON leads (audience, status);

CREATE TABLE campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience         text NOT NULL CHECK (audience IN ('parent','educator','all')),
  subject          text NOT NULL,
  html_body        text NOT NULL,
  freebie_url      text,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sending','sent','failed')),
  recipient_count  integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz
);

CREATE TABLE campaign_recipients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id           uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  resend_message_id text,
  error             text,
  sent_at           timestamptz,
  UNIQUE (campaign_id, lead_id)
);
