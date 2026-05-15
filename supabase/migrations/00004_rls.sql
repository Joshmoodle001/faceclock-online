-- Row-Level Security policies for the attendance system.
-- Every table has RLS enabled. Policies follow the RBAC hierarchy:
-- super_admin > org_admin > manager > finance_admin > employee

-- ============================================================================
-- HELPER: Function to get the current user's organization_id from profile
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION auth.get_user_organization_id IS 'Returns the organization_id for the currently authenticated user';

-- ============================================================================
-- HELPER: Function to get the current user's role
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION auth.get_user_role IS 'Returns the RBAC role for the currently authenticated user';

-- ============================================================================
-- HELPER: Function to check if user is super_admin
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    );
$$;

-- ============================================================================
-- HELPER: Function to check if user is org_admin for a given org
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid()
          AND organization_id = org_id
          AND role IN ('org_admin', 'super_admin')
    );
$$;

-- ============================================================================
-- HELPER: Get team IDs managed by the current user
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.get_managed_team_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT ARRAY_AGG(id) FROM public.teams WHERE manager_user_id = auth.uid();
$$;

-- ============================================================================
-- TRIGGER: Auto-set organization_id on profile insert from auth user metadata
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_id uuid;
BEGIN
    -- Attempt to get organization_id from auth user raw_app_meta_data
    org_id := (auth.uid()::text)::uuid;
    BEGIN
        org_id := (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
        org_id := NULL;
    END;

    IF org_id IS NULL THEN
        org_id := NEW.organization_id;
    END IF;

    NEW.organization_id := org_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_set_organization_id
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_organization_id();

-- ============================================================================
-- RLS: ORGANIZATIONS
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_super_admin_all ON organizations
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY org_admin_read_own ON organizations
    FOR SELECT
    TO authenticated
    USING (id = auth.get_user_organization_id());

-- ============================================================================
-- RLS: SITES
-- ============================================================================
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY sites_super_admin_all ON sites
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY sites_org_admin_manage ON sites
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY sites_manager_read ON sites
    FOR SELECT
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('manager', 'super_admin')
    );

CREATE POLICY sites_employee_read ON sites
    FOR SELECT
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('employee', 'super_admin')
    );

-- ============================================================================
-- RLS: GEOFENCES
-- ============================================================================
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY geofences_super_admin_all ON geofences
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY geofences_org_admin_manage ON geofences
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY geofences_manager_read ON geofences
    FOR SELECT
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('manager', 'super_admin')
    );

CREATE POLICY geofences_employee_read ON geofences
    FOR SELECT
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('employee', 'super_admin')
    );

-- ============================================================================
-- RLS: PROFILES
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_super_admin_all ON profiles
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY profiles_org_admin_manage ON profiles
    FOR ALL
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('org_admin', 'super_admin')
    )
    WITH CHECK (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('org_admin', 'super_admin')
    );

CREATE POLICY profiles_manager_read_team ON profiles
    FOR SELECT
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('manager', 'super_admin')
        AND (
            team_id = ANY (auth.get_managed_team_ids())
            OR user_id = auth.uid()
        )
    );

CREATE POLICY profiles_employee_read_own ON profiles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- RLS: DEVICES
-- ============================================================================
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY devices_super_admin_all ON devices
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY devices_org_admin_manage ON devices
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY devices_employee_read_own ON devices
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- RLS: FACE ENROLLMENTS
-- ============================================================================
ALTER TABLE face_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY face_enrollments_super_admin_all ON face_enrollments
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY face_enrollments_org_admin_manage ON face_enrollments
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY face_enrollments_employee_read_own ON face_enrollments
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- RLS: CLOCK EVENTS
-- ============================================================================
ALTER TABLE clock_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY clock_events_super_admin_all ON clock_events
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY clock_events_org_admin_read ON clock_events
    FOR SELECT
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY clock_events_manager_read_team ON clock_events
    FOR SELECT
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('manager', 'super_admin')
        AND user_id IN (
            SELECT user_id FROM profiles
            WHERE team_id = ANY (auth.get_managed_team_ids())
        )
    );

CREATE POLICY clock_events_employee_read_own ON clock_events
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- RLS: ATTENDANCE SESSIONS
-- ============================================================================
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY att_sessions_super_admin_all ON attendance_sessions
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY att_sessions_org_admin_read ON attendance_sessions
    FOR SELECT
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY att_sessions_manager_read_team ON attendance_sessions
    FOR SELECT
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('manager', 'super_admin')
        AND user_id IN (
            SELECT user_id FROM profiles
            WHERE team_id = ANY (auth.get_managed_team_ids())
        )
    );

CREATE POLICY att_sessions_employee_read_own ON attendance_sessions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- RLS: AUDIT LOGS
-- ============================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_super_admin_all ON audit_logs
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY audit_logs_org_admin_read ON audit_logs
    FOR SELECT
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

-- INSERTs to audit_logs from client are restricted; only service_role / edge functions
-- use the default "authenticated" deny since no INSERT policy exists here.

-- ============================================================================
-- RLS: PAYROLL RUNS
-- ============================================================================
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY payroll_runs_super_admin_all ON payroll_runs
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY payroll_runs_org_admin_manage ON payroll_runs
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY payroll_runs_finance_manage ON payroll_runs
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('finance_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('finance_admin', 'super_admin'));

-- ============================================================================
-- RLS: PAYROLL LINES
-- ============================================================================
ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY payroll_lines_super_admin_all ON payroll_lines
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY payroll_lines_org_admin_manage ON payroll_lines
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY payroll_lines_finance_manage ON payroll_lines
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('finance_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('finance_admin', 'super_admin'));

CREATE POLICY payroll_lines_employee_read_approved ON payroll_lines
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        AND status IN ('approved', 'paid')
    );

-- ============================================================================
-- RLS: PAY POLICIES
-- ============================================================================
ALTER TABLE pay_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY pay_policies_super_admin_all ON pay_policies
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY pay_policies_org_admin_manage ON pay_policies
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

-- ============================================================================
-- RLS: PAY RATES
-- ============================================================================
ALTER TABLE pay_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY pay_rates_super_admin_all ON pay_rates
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY pay_rates_org_admin_manage ON pay_rates
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

-- ============================================================================
-- RLS: SCHEDULE RULES
-- ============================================================================
ALTER TABLE schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedule_rules_super_admin_all ON schedule_rules
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY schedule_rules_org_admin_manage ON schedule_rules
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY schedule_rules_manager_read ON schedule_rules
    FOR SELECT
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('manager', 'super_admin'));

-- ============================================================================
-- RLS: LIVE LOCATION POLICIES
-- ============================================================================
ALTER TABLE live_location_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_loc_policies_super_admin_all ON live_location_policies
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY live_loc_policies_org_admin_manage ON live_location_policies
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

-- ============================================================================
-- RLS: LOCATION BREADCRUMBS
-- ============================================================================
ALTER TABLE location_breadcrumbs ENABLE ROW LEVEL SECURITY;

CREATE POLICY breadcrumbs_super_admin_all ON location_breadcrumbs
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY breadcrumbs_org_admin_read ON location_breadcrumbs
    FOR SELECT
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

-- ============================================================================
-- RLS: ATTENDANCE ADJUSTMENTS
-- ============================================================================
ALTER TABLE attendance_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY att_adj_super_admin_all ON attendance_adjustments
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY att_adj_org_admin_manage ON attendance_adjustments
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY att_adj_manager_read_team ON attendance_adjustments
    FOR SELECT
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('manager', 'super_admin')
        AND user_id IN (
            SELECT user_id FROM profiles
            WHERE team_id = ANY (auth.get_managed_team_ids())
        )
    );

CREATE POLICY att_adj_employee_read_own ON attendance_adjustments
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- RLS: TEAMS
-- ============================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY teams_super_admin_all ON teams
    FOR ALL
    TO authenticated
    USING (auth.is_super_admin())
    WITH CHECK (auth.is_super_admin());

CREATE POLICY teams_org_admin_manage ON teams
    FOR ALL
    TO authenticated
    USING (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'))
    WITH CHECK (organization_id = auth.get_user_organization_id() AND auth.get_user_role() IN ('org_admin', 'super_admin'));

CREATE POLICY teams_manager_read ON teams
    FOR SELECT
    TO authenticated
    USING (
        organization_id = auth.get_user_organization_id()
        AND auth.get_user_role() IN ('manager', 'super_admin')
    );
