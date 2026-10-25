-- Applied once by hand against Neon. Adds name + terms-of-use consent timestamp
-- to support the on-site signup form (name, email, required consent checkbox).

ALTER TABLE leads ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
