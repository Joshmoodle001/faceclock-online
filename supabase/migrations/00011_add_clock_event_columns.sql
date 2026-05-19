ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS device_fingerprint text;
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS face_match_method text;
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS risk_scores jsonb;
