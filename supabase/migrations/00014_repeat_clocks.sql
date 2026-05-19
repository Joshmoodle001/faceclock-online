CREATE TABLE IF NOT EXISTS repeat_clock_rules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    interval_minutes integer NOT NULL CHECK (interval_minutes >= 1),
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_repeat_clock_assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_id uuid NOT NULL REFERENCES repeat_clock_rules(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(rule_id, user_id)
);

ALTER TABLE repeat_clock_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_repeat_clock_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_repeat_clock_rules" ON repeat_clock_rules;
CREATE POLICY "admins_manage_repeat_clock_rules" ON repeat_clock_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND organization_id = repeat_clock_rules.organization_id
            AND role IN ('super_admin', 'org_admin')
        )
    );

DROP POLICY IF EXISTS "employees_read_repeat_clock_rules" ON repeat_clock_rules;
CREATE POLICY "employees_read_repeat_clock_rules" ON repeat_clock_rules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND organization_id = repeat_clock_rules.organization_id
        )
    );

DROP POLICY IF EXISTS "employees_read_repeat_clock_assignments" ON user_repeat_clock_assignments;
CREATE POLICY "employees_read_repeat_clock_assignments" ON user_repeat_clock_assignments
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND organization_id = user_repeat_clock_assignments.organization_id
            AND role IN ('super_admin', 'org_admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "admins_manage_repeat_clock_assignments" ON user_repeat_clock_assignments;
CREATE POLICY "admins_manage_repeat_clock_assignments" ON user_repeat_clock_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND organization_id = user_repeat_clock_assignments.organization_id
            AND role IN ('super_admin', 'org_admin')
        )
    );

CREATE TRIGGER trg_repeat_clock_rules_updated_at
    BEFORE UPDATE ON repeat_clock_rules FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

COMMENT ON TABLE repeat_clock_rules IS 'Rules that force employees to re-clock-in at set intervals during a shift';
COMMENT ON TABLE user_repeat_clock_assignments IS 'Links employees to their assigned repeat clock rules';
