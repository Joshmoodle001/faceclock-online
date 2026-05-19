-- Fix auto-clock RLS: add organization_id validation to all policies

-- Drop old auto-clock policies
DROP POLICY IF EXISTS "clock_events_employee_insert_auto" ON clock_events;
DROP POLICY IF EXISTS "att_sessions_employee_insert_auto" ON attendance_sessions;
DROP POLICY IF EXISTS "att_sessions_employee_update_own" ON attendance_sessions;

-- Helper: get the current user's org id from their profile
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM profiles WHERE user_id = auth.uid();
$$;

-- Employee can insert clock_events for themselves within their org
CREATE POLICY clock_events_employee_insert_auto ON clock_events
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND organization_id = public.get_user_organization_id()
    );

-- Employee can insert attendance_sessions for themselves within their org
CREATE POLICY att_sessions_employee_insert_auto ON attendance_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND organization_id = public.get_user_organization_id()
    );

-- Employee can update their own open session within their org
CREATE POLICY att_sessions_employee_update_own ON attendance_sessions
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        AND status = 'open'
        AND organization_id = public.get_user_organization_id()
    )
    WITH CHECK (
        user_id = auth.uid()
        AND status = 'closed'
        AND organization_id = public.get_user_organization_id()
    );
