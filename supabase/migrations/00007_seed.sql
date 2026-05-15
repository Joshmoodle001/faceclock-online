-- Seed data for development and testing.
-- IMPORTANT: Replace the placeholder auth.uid() values with actual user IDs
-- from your Supabase Auth users before running this migration in production.

-- ============================================================================
-- 1. DEMO ORGANIZATION
-- ============================================================================
INSERT INTO organizations (id, name, slug, default_timezone, currency, status, location_policy_json, biometric_policy_json, payroll_policy_json)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Demo Corp (Pty) Ltd',
    'demo-corp',
    'Africa/Johannesburg',
    'ZAR',
    'active',
    '{
        "enforce_geofence": true,
        "allow_live_tracking": false,
        "gps_accuracy_threshold_m": 50,
        "grace_distance_m": 100,
        "require_gps_for_clock": true
    }'::jsonb,
    '{
        "require_face_match": true,
        "min_quality_score": 0.7,
        "min_liveness_score": 0.8,
        "require_liveness_check": true,
        "max_retries_per_day": 5
    }'::jsonb,
    '{
        "overtime_threshold_daily_min": 480,
        "overtime_threshold_weekly_min": 2400,
        "default_currency": "ZAR",
        "rounding_interval_min": 15,
        "auto_approve_threshold_days": 7
    }'::jsonb
);

-- ============================================================================
-- 2. SITE
-- ============================================================================
INSERT INTO sites (id, organization_id, name, address, center_geog, timezone, active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Head Office - Sandton',
    '3 Alice Lane, Sandton, Johannesburg, 2196',
    ST_GeographyFromText('SRID=4326;POINT(28.0515 -26.1076)'),
    'Africa/Johannesburg',
    true
);

-- ============================================================================
-- 3. GEOFENCE (Circle around the site)
-- ============================================================================
INSERT INTO geofences (id, organization_id, site_id, name, type, center_geog, radius_m, accuracy_threshold_m, grace_distance_m, active)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Sandton Office Perimeter',
    'circle',
    ST_GeographyFromText('SRID=4326;POINT(28.0515 -26.1076)'),
    200,   -- 200m radius
    50,    -- 50m accuracy threshold
    100,   -- 100m grace distance
    true
);

-- ============================================================================
-- 4. TEAM
-- ============================================================================
INSERT INTO teams (id, organization_id, name)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Engineering'
);

-- ============================================================================
-- 5. SUPER ADMIN PROFILE
-- IMPORTANT: Replace 'REPLACE_WITH_SUPER_ADMIN_AUTH_USER_ID' with the actual
-- auth.users() id from your Supabase Auth dashboard.
-- ============================================================================
INSERT INTO profiles (user_id, organization_id, employee_code, display_name, email, role, employment_status)
VALUES (
    '00000000-0000-0000-0000-000000000000',  -- REPLACE WITH ACTUAL AUTH USER ID
    'a0000000-0000-0000-0000-000000000001',
    'ADM-001',
    'System Administrator',
    'admin@democorp.co.za',
    'super_admin',
    'active'
);

-- ============================================================================
-- 6. ORG ADMIN PROFILE
-- IMPORTANT: Replace 'REPLACE_WITH_ORG_ADMIN_AUTH_USER_ID' with actual Auth ID.
-- ============================================================================
INSERT INTO profiles (user_id, organization_id, employee_code, display_name, email, role, employment_status)
VALUES (
    '00000000-0000-0000-0000-000000000001',  -- REPLACE WITH ACTUAL AUTH USER ID
    'a0000000-0000-0000-0000-000000000001',
    'ADM-002',
    'Jane OrgAdmin',
    'jane@democorp.co.za',
    'org_admin',
    'active'
);

-- ============================================================================
-- 7. MANAGER PROFILE
-- ============================================================================
INSERT INTO profiles (user_id, organization_id, employee_code, display_name, email, role, employment_status, team_id)
VALUES (
    '00000000-0000-0000-0000-000000000002',  -- REPLACE WITH ACTUAL AUTH USER ID
    'a0000000-0000-0000-0000-000000000001',
    'MGR-001',
    'Bob Manager',
    'bob@democorp.co.za',
    'manager',
    'active',
    'd0000000-0000-0000-0000-000000000001'
);

-- Update the team's manager reference
UPDATE teams SET manager_user_id = '00000000-0000-0000-0000-000000000002'
WHERE id = 'd0000000-0000-0000-0000-000000000001';

-- ============================================================================
-- 8. EMPLOYEE PROFILE
-- ============================================================================
INSERT INTO profiles (user_id, organization_id, employee_code, display_name, email, role, employment_status, home_site_id, team_id, manager_user_id)
VALUES (
    '00000000-0000-0000-0000-000000000003',  -- REPLACE WITH ACTUAL AUTH USER ID
    'a0000000-0000-0000-0000-000000000001',
    'EMP-001',
    'Alice Employee',
    'alice@democorp.co.za',
    'employee',
    'active',
    'b0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
);

-- ============================================================================
-- 9. PAY POLICY (Standard South African overtime rules)
-- ============================================================================
INSERT INTO pay_policies (id, organization_id, name, overtime_thresholds_json, overtime_multipliers_json, weekend_rules_json, rounding_rules_json)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Standard SA Overtime (BCEA Compliant)',
    '{
        "daily_threshold_minutes": 480,
        "weekly_threshold_minutes": 2700,
        "overtime_start_after_hours": 9
    }'::jsonb,
    '{
        "weekday_overtime_rate": 1.5,
        "sunday_rate": 2.0,
        "public_holiday_rate": 2.5,
        "night_work_allowance": 0.1
    }'::jsonb,
    '{
        "saturday_pay_multiplier": 1.5,
        "sunday_pay_multiplier": 2.0,
        "saturday_overtime_after_minutes": 180,
        "sunday_all_hours_overtime": true
    }'::jsonb,
    '{
        "rounding_interval_minutes": 15,
        "rounding_method": "nearest",
        "grace_period_minutes": 5
    }'::jsonb
);

-- ============================================================================
-- 10. PAY RATE FOR EMPLOYEE
-- ============================================================================
INSERT INTO pay_rates (id, organization_id, user_id, effective_from, hourly_rate, overtime_rate, currency)
VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    '2026-01-01',
    85.00,
    127.50,
    'ZAR'
);

-- ============================================================================
-- 11. SCHEDULE RULE (Standard office hours)
-- ============================================================================
INSERT INTO schedule_rules (id, organization_id, site_id, team_id, weekday_mask, local_start_time, local_end_time, grace_in_min, grace_out_min, break_policy_json, active)
VALUES (
    'g0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    31,  -- Mon-Fri (1+2+4+8+16 = 31)
    '08:00'::time,
    '17:00'::time,
    5,
    5,
    '{
        "paid_break_minutes": 60,
        "unpaid_break_minutes": 30,
        "break_after_continuous_minutes": 300,
        "minimum_break_minutes": 30
    }'::jsonb,
    true
);

-- ============================================================================
-- 12. LIVE LOCATION POLICY
-- ============================================================================
INSERT INTO live_location_policies (id, organization_id, role, allow_live_tracking, allow_admin_map_visibility, retain_breadcrumbs, retention_days)
VALUES
    ('h0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'super_admin', true, true, false, 90),
    ('h0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'org_admin',  true, true, false, 90),
    ('h0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'manager',   true, false, false, 30),
    ('h0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'employee',  false, false, false, 0);
