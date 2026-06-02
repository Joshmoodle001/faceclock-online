-- Family trees table
CREATE TABLE IF NOT EXISTS family_trees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Family tree children assignments
CREATE TABLE IF NOT EXISTS family_tree_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_tree_id uuid NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
  child_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(family_tree_id, child_user_id)
);

-- RLS
ALTER TABLE family_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_tree_children ENABLE ROW LEVEL SECURITY;

-- Super admin can access all
CREATE POLICY "super_admin_all_family_trees" ON family_trees
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin'));

CREATE POLICY "super_admin_all_family_tree_children" ON family_tree_children
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin'));

-- Org admins can manage their org's trees
CREATE POLICY "org_admin_family_trees" ON family_trees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role IN ('org_admin','manager') AND p.organization_id = family_trees.organization_id)
  );

CREATE POLICY "org_admin_family_tree_children" ON family_tree_children
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p JOIN family_trees ft ON ft.id = family_tree_children.family_tree_id WHERE p.user_id = auth.uid() AND p.role IN ('org_admin','manager') AND p.organization_id = ft.organization_id)
  );

-- Employees can read their own family trees
CREATE POLICY "employee_read_family_trees" ON family_trees
  FOR SELECT USING (
    parent_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM family_tree_children fc WHERE fc.family_tree_id = family_trees.id AND fc.child_user_id = auth.uid())
  );

CREATE POLICY "employee_read_family_tree_children" ON family_tree_children
  FOR SELECT USING (
    child_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM family_trees ft WHERE ft.id = family_tree_children.family_tree_id AND ft.parent_user_id = auth.uid())
  );

COMMENT ON TABLE family_trees IS 'Family clock-in trees: parent user with assigned children';
COMMENT ON TABLE family_tree_children IS 'Child-to-family-tree assignments (one child per tree)';
