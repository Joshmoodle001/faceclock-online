-- Junction table for user-to-geofence assignments (many-to-many)
-- Run this in Supabase SQL Editor if the table doesn't exist yet

CREATE TABLE IF NOT EXISTS geofence_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  geofence_id uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(geofence_id, user_id)
);

ALTER TABLE geofence_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_admin can manage geofence_assignments"
  ON geofence_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('super_admin', 'org_admin', 'manager')
    )
  );

COMMENT ON TABLE geofence_assignments IS 'Junction table linking geofences to assigned users';
