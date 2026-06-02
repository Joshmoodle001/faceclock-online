-- ============================================================================
-- RESET: Fix profiles table and create super admin profile.
-- Copy/paste into Supabase Dashboard > SQL Editor and run.
--
-- ROOT CAUSE: The profiles table uses column names from a different app
-- (auth_user_id, business_id, full_name, status) but the face-attendance app
-- expects (user_id, organization_id, display_name, employment_status, etc.).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Drop existing profiles (1 row for admin@emberweb.dev, unrelated to FC)
-- ============================================================================
DELETE FROM profiles;

-- ============================================================================
-- 2. Drop old FK constraints before renaming columns
-- ============================================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_auth_user_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_business_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_organization_id_fkey;

-- ============================================================================
-- 3. Drop dependent FK constraints from other tables that reference profiles.id
--    (bookings + audit_logs from the business-management schema)
-- ============================================================================
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_assigned_staff_profile_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_profile_id_fkey;

-- ============================================================================
-- 4. Rename columns to what the face-attendance app expects
-- ============================================================================
ALTER TABLE profiles RENAME COLUMN auth_user_id TO user_id;
ALTER TABLE profiles RENAME COLUMN business_id TO organization_id;
ALTER TABLE profiles RENAME COLUMN full_name TO display_name;
ALTER TABLE profiles RENAME COLUMN status TO employment_status;

-- ============================================================================
-- 5. Drop old PK (profiles.id) and set user_id as the new primary key
-- ============================================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_pkey CASCADE;
ALTER TABLE profiles ADD PRIMARY KEY (user_id);
ALTER TABLE profiles DROP COLUMN IF EXISTS id CASCADE;

-- ============================================================================
-- 6. Re-create FK to auth.users
-- ============================================================================
ALTER TABLE profiles 
  ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 7. Fix the organizations FK
-- ============================================================================
ALTER TABLE profiles 
  ADD CONSTRAINT profiles_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- ============================================================================
-- 8. Add missing columns (nullable, no data yet)
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_code text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_site_id uuid REFERENCES sites(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_user_id uuid REFERENCES profiles(user_id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================================
-- 9. Create the super admin profile using the auth.users email lookup
-- ============================================================================
DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@faceclock.com';
  IF NOT FOUND THEN
    RAISE NOTICE 'Auth user admin@faceclock.com not found. Checking alternative admin emails...';
    SELECT id INTO v_user_id FROM auth.users WHERE email LIKE '%admin%' LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin auth user found. Create one via Authentication > Users first.';
  END IF;

  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name, slug, default_timezone, currency, status)
    VALUES ('Demo Corp', 'demo-corp', 'Africa/Johannesburg', 'ZAR', 'active')
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO profiles (
    user_id, organization_id, employee_code, display_name, email, role, employment_status
  ) VALUES (
    v_user_id,
    v_org_id,
    'ADM-001',
    'System Administrator',
    'admin@faceclock.com',
    'super_admin',
    'active'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'super_admin',
    organization_id = v_org_id,
    display_name = 'System Administrator',
    employment_status = 'active';

  RAISE NOTICE 'Super admin profile created/updated for user_id=%', v_user_id;
END;
$$;

COMMIT;
