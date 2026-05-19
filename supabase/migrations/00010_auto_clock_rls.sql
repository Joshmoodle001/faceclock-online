-- RLS policies for auto clock-in/out (home page face detection)
-- Allows employees to insert clock_events and attendance_sessions for themselves

CREATE POLICY clock_events_employee_insert_auto ON clock_events
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY att_sessions_employee_insert_auto ON attendance_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY att_sessions_employee_update_own ON attendance_sessions
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() AND status = 'open')
    WITH CHECK (user_id = auth.uid() AND status = 'closed');
