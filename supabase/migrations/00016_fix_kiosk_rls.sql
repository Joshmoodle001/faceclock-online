-- Fix kiosk RLS: scope anon access by org context
-- Kiosk devices must set app.kiosk_org_id via set_config() before making queries
-- If not set, anon access is denied (no cross-org data leak)

-- Drop the overly broad anon policies
DROP POLICY IF EXISTS "anon_read_non_rejected_enrollments" ON face_enrollments;
DROP POLICY IF EXISTS "anon_read_profiles" ON profiles;
DROP POLICY IF EXISTS "anon_insert_clock_events" ON clock_events;
DROP POLICY IF EXISTS "anon_insert_attendance_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "anon_update_attendance_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "anon_read_user_launch_assignments" ON user_launch_assignments;
DROP POLICY IF EXISTS "anon_read_launch_actions" ON launch_actions;

-- Helper: get the kiosk org id from session setting (NULL if not set)
CREATE OR REPLACE FUNCTION get_kiosk_org_id()
RETURNS uuid
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.kiosk_org_id', true), '')::uuid;
$$;

-- ============================================================================
-- ANON: FACE ENROLLMENTS (scoped by kiosk org context)
-- ============================================================================
CREATE POLICY "anon_read_non_rejected_enrollments" ON face_enrollments
    FOR SELECT
    TO anon
    USING (
        organization_id = get_kiosk_org_id()
        AND active = true
        AND status <> 'rejected'
    );

-- ============================================================================
-- ANON: PROFILES (scoped by kiosk org context)
-- ============================================================================
CREATE POLICY "anon_read_profiles" ON profiles
    FOR SELECT
    TO anon
    USING (
        organization_id = get_kiosk_org_id()
    );

-- ============================================================================
-- ANON: CLOCK EVENTS (scoped by kiosk org context)
-- ============================================================================
CREATE POLICY "anon_insert_clock_events" ON clock_events
    FOR INSERT
    TO anon
    WITH CHECK (
        organization_id = get_kiosk_org_id()
    );

-- ============================================================================
-- ANON: ATTENDANCE SESSIONS (scoped by kiosk org context)
-- ============================================================================
CREATE POLICY "anon_insert_attendance_sessions" ON attendance_sessions
    FOR INSERT
    TO anon
    WITH CHECK (
        organization_id = get_kiosk_org_id()
    );

CREATE POLICY "anon_update_attendance_sessions" ON attendance_sessions
    FOR UPDATE
    TO anon
    USING (
        organization_id = get_kiosk_org_id()
        AND status = 'open'
    )
    WITH CHECK (
        organization_id = get_kiosk_org_id()
        AND status = 'closed'
    );

-- ============================================================================
-- ANON: LAUNCH ACTIONS (scoped by kiosk org context)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_launch_assignments') THEN
        DROP POLICY IF EXISTS "anon_read_user_launch_assignments" ON user_launch_assignments;
        CREATE POLICY "anon_read_user_launch_assignments" ON user_launch_assignments
            FOR SELECT
            TO anon
            USING (
                organization_id = get_kiosk_org_id()
            );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'launch_actions') THEN
        DROP POLICY IF EXISTS "anon_read_launch_actions" ON launch_actions;
        CREATE POLICY "anon_read_launch_actions" ON launch_actions
            FOR SELECT
            TO anon
            USING (
                organization_id = get_kiosk_org_id()
            );
    END IF;
END $$;
