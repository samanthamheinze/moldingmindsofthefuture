-- Newsletter scheduling (reminder only, no auto-send)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_for date;

-- Channel attribution (UTM capture on signup)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign text;

-- Email click tracking (sales-pipeline signal)
CREATE TABLE IF NOT EXISTS clicks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url   text NOT NULL,
  source       text,
  campaign_id  uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id      uuid REFERENCES leads(id) ON DELETE SET NULL,
  clicked_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clicks_campaign_idx ON clicks (campaign_id);
