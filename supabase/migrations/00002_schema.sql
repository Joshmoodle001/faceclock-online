-- Core schema for the facial recognition attendance system.
-- All tables use UUID primary keys, timestamptz for time handling,
-- geography(Point,4326) for GPS locations, vector(512) for face embeddings,
-- and JSONB for flexible policy snapshots.

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
CREATE TABLE organizations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    default_timezone text NOT NULL DEFAULT 'Africa/Johannesburg',
    currency text NOT NULL DEFAULT 'ZAR',
    status text DEFAULT 'active',
    location_policy_json jsonb DEFAULT '{}'::jsonb,
    biometric_policy_json jsonb DEFAULT '{}'::jsonb,
    payroll_policy_json jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE organizations IS 'Top-level tenant organizations in the multi-tenant attendance system';
COMMENT ON COLUMN organizations.slug IS 'URL-safe unique identifier for the organization';
COMMENT ON COLUMN organizations.location_policy_json IS 'Flexible JSON policy for location-based attendance rules';
COMMENT ON COLUMN organizations.biometric_policy_json IS 'Flexible JSON policy for biometric/face recognition rules';
COMMENT ON COLUMN organizations.payroll_policy_json IS 'Flexible JSON policy for payroll processing rules';

-- ============================================================================
-- SITES
-- ============================================================================
CREATE TABLE sites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    address text,
    center_geog geography(POINT, 4326),
    timezone text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE sites IS 'Physical work sites / locations belonging to an organization';
COMMENT ON COLUMN sites.center_geog IS 'Geographic center point of the site using WGS84 (EPSG:4326)';

-- ============================================================================
-- GEOFENCES
-- ============================================================================
CREATE TABLE geofences (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text CHECK (type IN ('circle', 'polygon')),
    center_geog geography(POINT, 4326),
    radius_m numeric,
    polygon_geom geometry(POLYGON, 4326),
    accuracy_threshold_m numeric DEFAULT 50,
    grace_distance_m numeric DEFAULT 100,
    active_from timestamptz,
    active_to timestamptz,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT chk_geofence_type CHECK (
        (type = 'circle' AND center_geog IS NOT NULL AND radius_m IS NOT NULL) OR
        (type = 'polygon' AND polygon_geom IS NOT NULL)
    )
);

COMMENT ON TABLE geofences IS 'Virtual geographic boundaries for attendance validation';
COMMENT ON COLUMN geofences.type IS 'circle uses center_geog + radius_m; polygon uses polygon_geom';
COMMENT ON COLUMN geofences.accuracy_threshold_m IS 'Maximum acceptable GPS accuracy for clock events';
COMMENT ON COLUMN geofences.grace_distance_m IS 'Extra distance beyond geofence radius still accepted';

-- ============================================================================
-- PROFILES
-- ============================================================================
CREATE TABLE profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES organizations(id),
    employee_code text,
    display_name text,
    email text,
    phone text,
    role text CHECK (role IN ('super_admin', 'org_admin', 'manager', 'finance_admin', 'employee')) DEFAULT 'employee',
    manager_user_id uuid REFERENCES profiles(user_id),
    employment_status text DEFAULT 'active',
    home_site_id uuid REFERENCES sites(id),
    team_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Extended user profiles linked to Supabase auth.users';
COMMENT ON COLUMN profiles.role IS 'RBAC role: super_admin, org_admin, manager, finance_admin, or employee';
COMMENT ON COLUMN profiles.manager_user_id IS 'Self-referential FK for manager-subordinate hierarchy';

-- ============================================================================
-- TEAMS
-- ============================================================================
CREATE TABLE teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    manager_user_id uuid REFERENCES profiles(user_id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE teams IS 'Organizational teams/groups for scheduling and reporting';

-- ============================================================================
-- DEVICES
-- ============================================================================
CREATE TABLE devices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    device_name text,
    device_type text,
    platform text,
    browser text,
    fingerprint_hash text,
    webauthn_credential_id text,
    attestation_level text DEFAULT 'web',
    blocked boolean DEFAULT false,
    last_seen_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE devices IS 'Registered user devices for WebAuthn attestation and risk scoring';
COMMENT ON COLUMN devices.fingerprint_hash IS 'Device fingerprint hash for risk assessment';
COMMENT ON COLUMN devices.attestation_level IS 'WebAuthn attestation: none, web, or platform';

-- ============================================================================
-- FACE ENROLLMENTS
-- ============================================================================
CREATE TABLE face_enrollments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    embedding vector(512),
    model_name text,
    model_version text,
    liveness_model text,
    quality_score numeric,
    liveness_score numeric,
    status text DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'needs_reenrollment')),
    active boolean DEFAULT true,
    media_path_optional text,
    reviewed_by uuid REFERENCES profiles(user_id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE face_enrollments IS 'Facial recognition enrollment data with 512-dim embeddings';
COMMENT ON COLUMN face_enrollments.embedding IS '512-dimensional face embedding vector for recognition';
COMMENT ON COLUMN face_enrollments.status IS 'Review workflow: pending_review → approved/rejected/needs_reenrollment';
COMMENT ON COLUMN face_enrollments.media_path_optional IS 'Optional path to the enrollment image/video in storage';

-- ============================================================================
-- CLOCK EVENTS
-- ============================================================================
CREATE TABLE clock_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    site_id uuid REFERENCES sites(id),
    geofence_id uuid REFERENCES geofences(id),
    device_id uuid REFERENCES devices(id),
    event_type text CHECK (event_type IN ('clock_in', 'clock_out', 'break_start', 'break_end', 'manual_adjustment')),
    occurred_at timestamptz DEFAULT now(),
    submitted_at timestamptz DEFAULT now(),
    client_event_id uuid UNIQUE DEFAULT gen_random_uuid(),
    location_geog geography(POINT, 4326),
    accuracy_m numeric,
    heading numeric,
    speed_mps numeric,
    altitude_m numeric,
    within_geofence boolean,
    distance_from_geofence_m numeric,
    face_match_score numeric,
    liveness_score numeric,
    location_risk_score numeric,
    device_risk_score numeric,
    final_risk_score numeric,
    decision text CHECK (decision IN ('accepted', 'rejected', 'review_required')),
    review_state text DEFAULT 'none' CHECK (review_state IN ('none', 'pending', 'approved', 'rejected')),
    review_reason text,
    server_validation_json jsonb,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE clock_events IS 'All clock-in/out and break events with geospatial and biometric validation data';
COMMENT ON COLUMN clock_events.client_event_id IS 'Idempotency key from the client; unique to prevent duplicates';
COMMENT ON COLUMN clock_events.location_geog IS 'GPS location at time of event in WGS84';
COMMENT ON COLUMN clock_events.server_validation_json IS 'Server-side validation results and risk assessment snapshot';
COMMENT ON COLUMN clock_events.decision IS 'Automated decision: accepted, rejected, or flagged for review';

-- ============================================================================
-- ATTENDANCE SESSIONS
-- ============================================================================
CREATE TABLE attendance_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    site_id uuid REFERENCES sites(id),
    opened_by_event_id uuid REFERENCES clock_events(id),
    closed_by_event_id uuid REFERENCES clock_events(id),
    started_at timestamptz,
    ended_at timestamptz,
    worked_minutes_raw integer,
    break_minutes integer DEFAULT 0,
    overtime_minutes integer DEFAULT 0,
    payable_minutes integer,
    status text DEFAULT 'open',
    approved_by uuid REFERENCES profiles(user_id),
    approved_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE attendance_sessions IS 'Computed attendance sessions derived from clock events';
COMMENT ON COLUMN attendance_sessions.status IS 'open (active), closed (ended), approved, rejected';

-- ============================================================================
-- ATTENDANCE ADJUSTMENTS
-- ============================================================================
CREATE TABLE attendance_adjustments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    attendance_session_id uuid REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    adjustment_type text,
    minutes_delta integer,
    reason text,
    created_by uuid REFERENCES profiles(user_id),
    approved_by uuid REFERENCES profiles(user_id),
    created_at timestamptz DEFAULT now(),
    approved_at timestamptz
);

COMMENT ON TABLE attendance_adjustments IS 'Manual adjustments to attendance sessions (additions/deductions)';

-- ============================================================================
-- SCHEDULE RULES
-- ============================================================================
CREATE TABLE schedule_rules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    site_id uuid REFERENCES sites(id),
    team_id uuid REFERENCES teams(id),
    weekday_mask integer,
    local_start_time time,
    local_end_time time,
    grace_in_min integer DEFAULT 5,
    grace_out_min integer DEFAULT 5,
    break_policy_json jsonb,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE schedule_rules IS 'Scheduled shifts using weekday bitmask and local time ranges';
COMMENT ON COLUMN schedule_rules.weekday_mask IS 'Bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64';

-- ============================================================================
-- PAY POLICIES
-- ============================================================================
CREATE TABLE pay_policies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text,
    overtime_thresholds_json jsonb,
    overtime_multipliers_json jsonb,
    weekend_rules_json jsonb,
    holiday_rules_json jsonb,
    rounding_rules_json jsonb,
    deduction_rules_json jsonb,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE pay_policies IS 'Payroll policy configuration with flexible JSON rules';

-- ============================================================================
-- PAY RATES
-- ============================================================================
CREATE TABLE pay_rates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    effective_from date NOT NULL,
    hourly_rate numeric NOT NULL,
    overtime_rate numeric,
    currency text DEFAULT 'ZAR',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE pay_rates IS 'Employee pay rates with effective dating for historical tracking';

-- ============================================================================
-- PAYROLL RUNS
-- ============================================================================
CREATE TABLE payroll_runs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start date NOT NULL,
    period_end date NOT NULL,
    status text DEFAULT 'draft',
    generated_at timestamptz,
    approved_by uuid REFERENCES profiles(user_id),
    approved_at timestamptz,
    paid_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE payroll_runs IS 'Payroll processing runs covering specific pay periods';

-- ============================================================================
-- PAYROLL LINES
-- ============================================================================
CREATE TABLE payroll_lines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    regular_minutes integer DEFAULT 0,
    overtime_minutes integer DEFAULT 0,
    break_minutes integer DEFAULT 0,
    hourly_rate_snapshot numeric,
    gross_amount numeric DEFAULT 0,
    deductions_amount numeric DEFAULT 0,
    adjustments_amount numeric DEFAULT 0,
    net_amount numeric DEFAULT 0,
    status text DEFAULT 'draft',
    calculation_snapshot_json jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE payroll_lines IS 'Per-employee payroll line items within a payroll run';

-- ============================================================================
-- LIVE LOCATION POLICIES
-- ============================================================================
CREATE TABLE live_location_policies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role text,
    allow_live_tracking boolean DEFAULT false,
    allow_admin_map_visibility boolean DEFAULT false,
    retain_breadcrumbs boolean DEFAULT false,
    retention_days integer DEFAULT 30,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE live_location_policies IS 'Per-role policies for live GPS tracking and breadcrumb retention';

-- ============================================================================
-- LOCATION BREADCRUMBS
-- ============================================================================
CREATE TABLE location_breadcrumbs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    device_id uuid REFERENCES devices(id),
    location_geog geography(POINT, 4326),
    accuracy_m numeric,
    speed_mps numeric,
    heading numeric,
    source text,
    risk_score numeric,
    captured_at timestamptz,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE location_breadcrumbs IS 'Continuous GPS breadcrumb trail for live location tracking';

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================
CREATE TABLE audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id uuid REFERENCES profiles(user_id),
    entity_type text,
    entity_id uuid,
    action text,
    metadata_json jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all security-sensitive operations';
COMMENT ON COLUMN audit_logs.metadata_json IS 'Arbitrary JSON context about the audited action';
