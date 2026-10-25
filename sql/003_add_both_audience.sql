-- Applied once by hand against Neon. The popup now offers a "subscribe to
-- both" option, so a lead can be audience='both' instead of exactly one of
-- 'parent'/'educator'. Campaign targeting (api/admin/campaigns/[id]/send.js)
-- treats 'both' leads as matching either a 'parent' or 'educator' campaign.

ALTER TABLE leads DROP CONSTRAINT leads_audience_check;
ALTER TABLE leads ADD CONSTRAINT leads_audience_check
  CHECK (audience IN ('parent', 'educator', 'both'));
