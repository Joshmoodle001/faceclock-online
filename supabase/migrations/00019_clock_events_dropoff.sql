-- Add drop-off tracking columns to clock_events for family tree clock-ins

ALTER TABLE clock_events
  ADD COLUMN IF NOT EXISTS drop_off_site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drop_off_custom_location text,
  ADD COLUMN IF NOT EXISTS parent_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
