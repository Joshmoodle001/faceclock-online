-- Database functions for the attendance system.
-- All functions use SECURITY DEFINER for elevated privileges when called via edge functions.

-- ============================================================================
-- FUNCTION: fn_update_updated_at()
-- Trigger function that automatically sets updated_at = now() on any row update.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_update_updated_at IS 'Auto-sets updated_at to current timestamp on row modification';

-- Apply trigger to all tables with updated_at column
CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_sites_updated_at
    BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_geofences_updated_at
    BEFORE UPDATE ON geofences FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_teams_updated_at
    BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_devices_updated_at
    BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_face_enrollments_updated_at
    BEFORE UPDATE ON face_enrollments FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_attendance_sessions_updated_at
    BEFORE UPDATE ON attendance_sessions FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_schedule_rules_updated_at
    BEFORE UPDATE ON schedule_rules FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_pay_policies_updated_at
    BEFORE UPDATE ON pay_policies FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_pay_rates_updated_at
    BEFORE UPDATE ON pay_rates FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_payroll_runs_updated_at
    BEFORE UPDATE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_payroll_lines_updated_at
    BEFORE UPDATE ON payroll_lines FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
CREATE TRIGGER trg_live_location_policies_updated_at
    BEFORE UPDATE ON live_location_policies FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- ============================================================================
-- FUNCTION: fn_check_duplicate_clock(p_client_event_id uuid)
-- Returns TRUE if the client_event_id already exists (idempotency check).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_duplicate_clock(p_client_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM clock_events
        WHERE client_event_id = p_client_event_id
    );
END;
$$;

COMMENT ON FUNCTION public.fn_check_duplicate_clock IS 'Idempotency guard: returns true if client_event_id is already recorded';

-- ============================================================================
-- FUNCTION: fn_get_active_attendance_session(p_user_id uuid)
-- Returns the current open attendance session for a user, or NULL if none.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_get_active_attendance_session(p_user_id uuid)
RETURNS SETOF attendance_sessions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM attendance_sessions
    WHERE user_id = p_user_id
      AND status = 'open'
    ORDER BY started_at DESC
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.fn_get_active_attendance_session IS 'Returns the currently open session for a given user (or empty set)';

-- ============================================================================
-- FUNCTION: fn_handle_clock_event(...)
-- SECURITY DEFINER function called by the edge function to validate and insert
-- a clock event. Performs duplicate checking, geofence validation, and
-- session management (opens/closes attendance sessions).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_handle_clock_event(
    p_organization_id uuid DEFAULT NULL,
    p_user_id uuid DEFAULT NULL,
    p_site_id uuid DEFAULT NULL,
    p_geofence_id uuid DEFAULT NULL,
    p_device_id uuid DEFAULT NULL,
    p_event_type text DEFAULT NULL,
    p_occurred_at timestamptz DEFAULT now(),
    p_client_event_id uuid DEFAULT gen_random_uuid(),
    p_location_geog geography(POINT, 4326) DEFAULT NULL,
    p_accuracy_m numeric DEFAULT NULL,
    p_heading numeric DEFAULT NULL,
    p_speed_mps numeric DEFAULT NULL,
    p_altitude_m numeric DEFAULT NULL,
    p_face_match_score numeric DEFAULT NULL,
    p_liveness_score numeric DEFAULT NULL,
    p_server_validation_json jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_duplicate boolean;
    v_event_id uuid;
    v_decision text;
    v_within_geofence boolean;
    v_distance_from_geofence_m numeric;
    v_location_risk_score numeric;
    v_device_risk_score numeric;
    v_final_risk_score numeric;
    v_active_session attendance_sessions;
    v_session_id uuid;
    v_result jsonb;
BEGIN
    -- 1. Idempotency check
    v_duplicate := public.fn_check_duplicate_clock(p_client_event_id);
    IF v_duplicate THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'DUPLICATE_EVENT',
            'message', 'A clock event with this client_event_id already exists',
            'client_event_id', p_client_event_id
        );
    END IF;

    -- 2. Validate event type
    IF p_event_type NOT IN ('clock_in', 'clock_out', 'break_start', 'break_end', 'manual_adjustment') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_EVENT_TYPE',
            'message', 'Event type must be one of: clock_in, clock_out, break_start, break_end, manual_adjustment'
        );
    END IF;

    -- 3. Geofence validation if location provided
    IF p_location_geog IS NOT NULL AND p_geofence_id IS NOT NULL THEN
        SELECT
            ST_DWithin(p_location_geog, center_geog, radius_m + grace_distance_m),
            ST_Distance(p_location_geog, center_geog)
        INTO v_within_geofence, v_distance_from_geofence_m
        FROM geofences
        WHERE id = p_geofence_id AND active = true;
    END IF;

    -- 4. Risk scoring
    v_location_risk_score := CASE
        WHEN p_accuracy_m IS NULL OR p_accuracy_m > 100 THEN 0.7
        WHEN p_accuracy_m > 50 THEN 0.3
        ELSE 0.0
    END;

    v_device_risk_score := CASE
        WHEN p_device_id IS NULL THEN 0.5
        ELSE 0.0
    END;

    v_final_risk_score := GREATEST(v_location_risk_score, v_device_risk_score);

    -- 5. Determine decision
    IF v_within_geofence IS TRUE THEN
        v_decision := 'accepted';
    ELSIF v_within_geofence IS FALSE AND v_distance_from_geofence_m IS NOT NULL THEN
        v_decision := 'review_required';
    ELSIF p_face_match_score IS NOT NULL AND p_face_match_score < 0.5 THEN
        v_decision := 'rejected';
    ELSE
        v_decision := 'accepted';
    END IF;

    -- 6. Insert the clock event
    INSERT INTO clock_events (
        organization_id, user_id, site_id, geofence_id, device_id,
        event_type, occurred_at, client_event_id,
        location_geog, accuracy_m, heading, speed_mps, altitude_m,
        within_geofence, distance_from_geofence_m,
        face_match_score, liveness_score,
        location_risk_score, device_risk_score, final_risk_score,
        decision, server_validation_json
    ) VALUES (
        p_organization_id, p_user_id, p_site_id, p_geofence_id, p_device_id,
        p_event_type, p_occurred_at, p_client_event_id,
        p_location_geog, p_accuracy_m, p_heading, p_speed_mps, p_altitude_m,
        v_within_geofence, v_distance_from_geofence_m,
        p_face_match_score, p_liveness_score,
        v_location_risk_score, v_device_risk_score, v_final_risk_score,
        v_decision, p_server_validation_json
    )
    RETURNING id INTO v_event_id;

    -- 7. Session management
    IF p_event_type = 'clock_in' THEN
        -- Close any stale open sessions first
        UPDATE attendance_sessions
        SET status = 'closed',
            ended_at = p_occurred_at,
            closed_by_event_id = v_event_id
        WHERE user_id = p_user_id AND status = 'open';

        -- Create new session
        INSERT INTO attendance_sessions (
            organization_id, user_id, site_id,
            opened_by_event_id, started_at, status
        ) VALUES (
            p_organization_id, p_user_id, p_site_id,
            v_event_id, p_occurred_at, 'open'
        )
        RETURNING id INTO v_session_id;

    ELSIF p_event_type IN ('clock_out', 'manual_adjustment') THEN
        -- Try to close the active session
        SELECT * INTO v_active_session
        FROM attendance_sessions
        WHERE user_id = p_user_id AND status = 'open'
        ORDER BY started_at DESC
        LIMIT 1;

        IF FOUND THEN
            UPDATE attendance_sessions
            SET status = 'closed',
                ended_at = p_occurred_at,
                closed_by_event_id = v_event_id,
                worked_minutes_raw = EXTRACT(EPOCH FROM (p_occurred_at - started_at)) / 60,
                payable_minutes = EXTRACT(EPOCH FROM (p_occurred_at - started_at)) / 60
            WHERE id = v_active_session.id
            RETURNING id INTO v_session_id;
        END IF;
    END IF;

    -- 8. Return result
    v_result := jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'session_id', v_session_id,
        'decision', v_decision,
        'within_geofence', v_within_geofence,
        'distance_from_geofence_m', v_distance_from_geofence_m,
        'location_risk_score', v_location_risk_score,
        'device_risk_score', v_device_risk_score,
        'final_risk_score', v_final_risk_score,
        'duplicate', false
    );

    -- Write audit log
    INSERT INTO audit_logs (
        organization_id, actor_user_id, entity_type, entity_id,
        action, metadata_json
    ) VALUES (
        p_organization_id, p_user_id, 'clock_event', v_event_id,
        'clock_event_' || p_event_type,
        jsonb_build_object(
            'event_type', p_event_type,
            'decision', v_decision,
            'session_id', v_session_id
        )
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLSTATE,
        'message', SQLERRM,
        'client_event_id', p_client_event_id
    );
END;
$$;

COMMENT ON FUNCTION public.fn_handle_clock_event IS 'Core clock event handler: validates, inserts, manages sessions, and returns decision';

-- ============================================================================
-- FUNCTION: fn_calculate_attendance_session(p_event_id uuid)
-- Recalculates session minutes after a clock_out event. Called by edge function
-- or manually for reconciliation.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_calculate_attendance_session(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session attendance_sessions;
    v_break_minutes integer;
    v_overtime_minutes integer;
    v_payable_minutes integer;
    v_raw_minutes numeric;
    v_schedule schedule_rules;
    v_regular_end time;
    v_result jsonb;
BEGIN
    -- Find the session closed by this event
    SELECT * INTO v_session
    FROM attendance_sessions
    WHERE closed_by_event_id = p_event_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'SESSION_NOT_FOUND',
            'message', 'No attendance session found for the given clock_out event'
        );
    END IF;

    -- Calculate raw minutes
    v_raw_minutes := EXTRACT(EPOCH FROM (v_session.ended_at - v_session.started_at)) / 60;
    v_session.worked_minutes_raw := v_raw_minutes::integer;

    -- Calculate break minutes from break events during the session
    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (ce2.occurred_at - ce1.occurred_at)) / 60
    )::integer, 0)
    INTO v_break_minutes
    FROM clock_events ce1
    JOIN clock_events ce2 ON ce2.user_id = ce1.user_id
        AND ce2.event_type = 'break_end'
        AND ce2.occurred_at > ce1.occurred_at
    WHERE ce1.user_id = v_session.user_id
        AND ce1.event_type = 'break_start'
        AND ce1.occurred_at >= v_session.started_at
        AND ce1.occurred_at <= v_session.ended_at
        AND NOT EXISTS (
            SELECT 1 FROM clock_events ce3
            WHERE ce3.user_id = ce1.user_id
                AND ce3.event_type = 'break_end'
                AND ce3.occurred_at > ce1.occurred_at
                AND ce3.occurred_at < ce2.occurred_at
        );

    -- Calculate overtime: find schedule rule for this user/site/weekday
    SELECT * INTO v_schedule
    FROM schedule_rules
    WHERE (site_id = v_session.site_id OR site_id IS NULL)
        AND active = true
        AND (
            weekday_mask IS NULL
            OR (weekday_mask & (1 << (EXTRACT(DOW FROM v_session.started_at)::integer)) > 0)
        )
    ORDER BY site_id NULLS LAST
    LIMIT 1;

    IF FOUND AND v_schedule.local_end_time IS NOT NULL THEN
        v_regular_end := v_session.started_at::date + v_schedule.local_end_time;
        v_overtime_minutes := GREATEST(0,
            EXTRACT(EPOCH FROM (v_session.ended_at - (v_session.started_at::date + v_schedule.local_end_time))) / 60
        )::integer;
    ELSE
        v_overtime_minutes := 0;
    END IF;

    v_payable_minutes := GREATEST(0, v_raw_minutes::integer - v_break_minutes);

    -- Update the session
    UPDATE attendance_sessions
    SET
        worked_minutes_raw = v_raw_minutes::integer,
        break_minutes = v_break_minutes,
        overtime_minutes = v_overtime_minutes,
        payable_minutes = v_payable_minutes
    WHERE id = v_session.id;

    v_result := jsonb_build_object(
        'success', true,
        'session_id', v_session.id,
        'worked_minutes_raw', v_raw_minutes::integer,
        'break_minutes', v_break_minutes,
        'overtime_minutes', v_overtime_minutes,
        'payable_minutes', v_payable_minutes
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLSTATE,
        'message', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.fn_calculate_attendance_session IS 'Recalculates session break, overtime, and payable minutes after clock_out';
