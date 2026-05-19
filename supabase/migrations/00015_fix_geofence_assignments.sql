-- Fix geofence_assignments: add organization_id column + proper org-scoped RLS

-- Drop the table entirely and recreate with organization_id
DROP TABLE IF EXISTS geofence_assignments;

CREATE TABLE geofence_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  geofence_id uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(geofence_id, user_id)
);

ALTER TABLE geofence_assignments ENABLE ROW LEVEL SECURITY;

-- Super admin: full access across all orgs
CREATE POLICY "super_admin_all_geofence_assignments"
  ON geofence_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'super_admin'
    )
  );

-- Org admin / manager: access only within their own org
CREATE POLICY "org_admin_geofence_assignments"
  ON geofence_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('org_admin', 'manager')
      AND p.organization_id = geofence_assignments.organization_id
    )
  );

-- Employee: read their own assignments
CREATE POLICY "employee_read_own_geofence_assignments"
  ON geofence_assignments
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE geofence_assignments IS 'Junction table linking geofences to assigned users (org-scoped)';
