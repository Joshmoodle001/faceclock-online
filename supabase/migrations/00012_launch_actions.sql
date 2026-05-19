CREATE TABLE IF NOT EXISTS launch_actions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    url text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_launch_assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    launch_action_id uuid NOT NULL REFERENCES launch_actions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(launch_action_id, user_id)
);

ALTER TABLE launch_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_launch_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_admins_manage_launch_actions" ON launch_actions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND organization_id = launch_actions.organization_id
            AND role IN ('super_admin', 'org_admin')
        )
    );

CREATE POLICY "employees_read_launch_assignments" ON user_launch_assignments
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND organization_id = user_launch_assignments.organization_id
            AND role IN ('super_admin', 'org_admin', 'manager')
        )
    );

CREATE POLICY "org_admins_manage_launch_assignments" ON user_launch_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND organization_id = user_launch_assignments.organization_id
            AND role IN ('super_admin', 'org_admin')
        )
    );

CREATE TRIGGER trg_launch_actions_updated_at
    BEFORE UPDATE ON launch_actions FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

COMMENT ON TABLE launch_actions IS 'Admin-defined launch actions (URLs) assigned to users that trigger on clock-in';
COMMENT ON TABLE user_launch_assignments IS 'Links users to their assigned launch actions';
