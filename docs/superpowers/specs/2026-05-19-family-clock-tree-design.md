# Family Clock-In Tree — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan from this spec.

**Goal:** Add a parent-child clock-in family tree system where a driver/parent clocks in first, then children scan their face and record their drop-off site.

**Architecture:** New DB tables `family_trees` and `family_tree_children`, new columns on `clock_events` for drop-off tracking, new admin page for CRUD + organogram view, modified clock page for family flow.

**Tech Stack:** Next.js 14, Supabase (Postgres + RLS), shadcn/ui

---

## 1. Data Model

### New Tables

```sql
CREATE TABLE family_trees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE family_tree_children (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  family_tree_id uuid NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
  child_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(child_user_id)  -- one child belongs to exactly one family tree
);
```

### New Columns on `clock_events`

- `drop_off_site_id uuid REFERENCES sites(id) ON DELETE SET NULL` — the site where the child was dropped off (NULL if manual entry)
- `drop_off_custom_location text` — free-text store name when parent clicked "Can't find it" (NULL if site was selected)
- `parent_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL` — the parent who oversaw this child's clock-in

### RLS Policies

Every table follows the standard pattern:
- **Super admin** — full access across all orgs (role = 'super_admin')
- **Org admin / manager** — full CRUD within their org
- **Employee** — SELECT own records

---

## 2. Admin Page: `/admin/family-trees`

### Features
- **Tree list table** — columns: Name, Parent (display_name), Children count, Actions (Edit, Delete, View Organogram)
- **Create/Edit dialog** (modal):
  - Tree Name (text input)
  - Parent Employee (searchable Select with employee list from this org)
  - Children Employees (multi-select checkboxes from employee list, excluding the parent)
- **Organogram toggle** — clicking "View Organogram" on a row opens a panel showing the family tree visually:
  - Parent at top in a card (name, employee_code, role badge)
  - Children below in a column, connected with CSS lines/borders
  - Each child card shows name + employee_code
  - Simple CSS-based tree layout (no external library needed — flexbox + borders)

### Data Flow
- All queries scoped to `organization_id` (super admin sees all)
- Uses the existing employee list (`profiles`) filtered to the org

---

## 3. Clock-In Flow (Modified)

### Parent Clock-In
1. Parent scans face → face recognized → normal clock-in (`clock_in` event)
2. `AttendanceSession` created as normal
3. Screen now shows **organogram view** below the camera:
   - Parent card at top (name + employee_code + "Clocked In ✓")
   - Children cards below with status: "Not Yet Clocked In" or "Clocked In ✓"
   - Updates in real-time via Supabase Realtime subscription

### Child Clock-In
1. Child stands in front of the tablet camera
2. Parent clicks **"Clock In"** button (or a **"Clock In Team Member"** button shown after parent is clocked in)
3. Camera captures child's face → sent to edge function → child is identified by face match
4. Edge function creates the `clock_in` event + `AttendanceSession`
5. If the identified child has a `family_tree_children` record AND the parent is currently clocked in:
   - A dialog appears on screen: *"Where are we dropping off {child_name}?"*
   - **Searchable dropdown** of sites (from `sites` table, filtered to the org)
   - At the bottom: **"Can't find it"** button
   - If "Can't find it" clicked: dropdown hides, free-text input appears: *"Enter store name"*
   - Parent selects/enters and confirms
6. The `clock_events` row is **updated** with:
   - `drop_off_site_id` (if site selected)
   - `drop_off_custom_location` (if manual entry)
   - `parent_user_id` (the logged-in parent who oversaw the clock-in)

### Edge Cases
- If parent is NOT clocked in when child scans: normal clock-in, no family/drop-off flow (child clocks in independently)
- If child has no family tree: normal clock-in, no changes
- If parent clocks out: children continue their sessions independently

---

## 4. Clock Page UI Changes (`/app/clock`)

After parent clock-in, the area below the GeofenceStatusCard shows:

```
┌──────────────────────────────┐
│  👤 John Driver (DRV-001)   │
│  Parent — Clocked In ✓      │
│  ┌────────────────────────┐ │
│  │     connection line      │ │
│  ├────────────────────────┤ │
│  │  👤 Alice (ALC-002)     │ │
│  │  Clocked In ✓           │ │
│  │  Drop-off: Site A       │ │
│  ├────────────────────────┤ │
│  │  👤 Bob (BOB-003)       │ │
│  │  Not Yet Clocked In     │ │
│  └────────────────────────┘ │
└──────────────────────────────┘
```

- Uses Supabase Realtime to subscribe to `clock_events` for children in the family tree
- When a child clocks in: card updates to "Clocked In ✓" + shows drop-off location
- Only visible when the currently-authenticated user is a parent who is clocked in
- Hidden if user is not a parent or not clocked in

---

## 5. API Changes

No new API routes needed — the clock page and admin page use Supabase direct queries with RLS.

---

## 6. Files to Create/Modify

### New Files
- `supabase/migrations/00018_family_trees.sql` — family_trees + family_tree_children tables, RLS
- `supabase/migrations/00019_clock_events_dropoff.sql` — add drop-off + parent columns to clock_events
- `src/app/admin/family-trees/page.tsx` — Admin CRUD + organogram view
- `src/components/FamilyTreeOrganogram.tsx` — Reusable organogram component (used in admin + clock page)
- `src/components/DropOffDialog.tsx` — Drop-off site selection dialog for child clock-in

### Modified Files
- `src/app/app/clock/page.tsx` — Add family tree organogram view, drop-off dialog, parent-child clock flow
- `src/types/index.ts` — Add `FamilyTree`, `FamilyTreeChild` types, update `ClockEvent`
- `src/app/admin/layout.tsx` — Add nav link for Family Trees
- `src/app/admin/employees/page.tsx` — Maybe show family tree assignments (could be separate task)

---

## 7. RLS Policies Detail

All tables follow this pattern (using `auth.get_user_organization_id()` and the super_admin check already established in migrations 00015-00017):

```sql
-- Super admin: full access
CREATE POLICY "super_admin_all_family_trees" ... USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')
);

-- Org admin/manager: access within their org
CREATE POLICY "org_admin_family_trees" ... FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role IN ('org_admin','manager')
    AND p.organization_id = family_trees.organization_id)
);

-- Employee: SELECT own records
CREATE POLICY "employee_read_own_family_trees" ... FOR SELECT USING (
  EXISTS (SELECT 1 FROM family_tree_children fc
    WHERE fc.family_tree_id = family_trees.id AND fc.child_user_id = auth.uid())
  OR parent_user_id = auth.uid()
);
```

---

## 8. No-Go / Out of Scope

- No self-service family tree creation (admin only)
- No cross-org parent-child relationships
- No shifts or schedules tied to the family tree (just clock-in grouping)
- No notifications
