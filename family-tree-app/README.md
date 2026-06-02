# Family Tree Clock App

Standalone application for parent-child family drop-off clock-in attendance tracking.  
Extracted from the FaceAttend platform into its own dedicated application.

## Overview

The Family Tree Clock app allows organizations to:
- Create family trees with a parent/guardian and assigned children
- Clock children in/out via a parent's device at drop-off locations
- Track which sites or custom locations children are dropped off at
- View organogram visualizations showing clock-in status for each family tree

## Tech Stack

- **Next.js 14** (App Router) with React 18 + TypeScript
- **Tailwind CSS** for styling
- **Supabase** for auth, database, and edge functions
- **Deno** for Supabase Edge Functions

## Database Setup

Run the migrations in order:

```bash
supabase migration up
```

### Tables
- `family_trees` — Tree definitions (org_id, name, parent_user_id)
- `family_tree_children` — Child assignments (family_tree_id, child_user_id)
- `clock_events` — Extended with `parent_user_id`, `drop_off_site_id`, `drop_off_custom_location`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the admin panel.

## Deploy Edge Function

```bash
supabase functions deploy family-clock-event
```

## Architecture

### Components
- **FamilyTreeOrganogram** — Visual tree showing parent + children with clock-in status
- **DropOffDialog** — Modal for selecting site or entering custom drop-off location

### Pages
- `/admin` — Full CRUD for family trees: create, edit, delete, manage children, view organogram

### Edge Function
- `family-clock-event` — Handles family clock-in event submission with drop-off location tracking
