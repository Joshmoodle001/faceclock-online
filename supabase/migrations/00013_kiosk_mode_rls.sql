-- Kiosk mode: allow unauthenticated (anon) users to:
-- 1. Read approved face enrollments for face matching
-- 2. Read basic profile info for display names
-- 3. Insert clock events and attendance sessions (face = auth)
-- 4. Update attendance sessions for clock-out
-- 5. Read launch action assignments (if tables exist)

-- ============================================================================
-- ANON: FACE ENROLLMENTS
-- ============================================================================
CREATE POLICY "anon_read_non_rejected_enrollments" ON face_enrollments
    FOR SELECT
    TO anon
    USING (active = true AND status <> 'rejected');

-- ============================================================================
-- ANON: PROFILES
-- ============================================================================
CREATE POLICY "anon_read_profiles" ON profiles
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- ANON: CLOCK EVENTS
-- ============================================================================
CREATE POLICY "anon_insert_clock_events" ON clock_events
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- ============================================================================
-- ANON: ATTENDANCE SESSIONS
-- ============================================================================
CREATE POLICY "anon_insert_attendance_sessions" ON attendance_sessions
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "anon_update_attendance_sessions" ON attendance_sessions
    FOR UPDATE
    TO anon
    USING (status = 'open')
    WITH CHECK (status = 'closed');

-- ============================================================================
-- ANON: LAUNCH ACTIONS (only if tables exist — 00012 may not have run yet)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_launch_assignments') THEN
        CREATE POLICY "anon_read_user_launch_assignments" ON user_launch_assignments
            FOR SELECT
            TO anon
            USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'launch_actions') THEN
        CREATE POLICY "anon_read_launch_actions" ON launch_actions
            FOR SELECT
            TO anon
            USING (true);
    END IF;
END $$;
