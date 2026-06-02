export interface FamilyTree {
  id: string;
  organization_id: string;
  name: string;
  parent_user_id: string;
  created_at: string;
}

export interface FamilyTreeChild {
  id: string;
  family_tree_id: string;
  child_user_id: string;
  created_at: string;
}

export interface ClockEvent {
  id: string;
  organization_id: string;
  user_id: string;
  site_id?: string;
  event_type: 'clock_in' | 'clock_out';
  occurred_at: string;
  submitted_at: string;
  face_match_score?: number;
  liveness_score?: number;
  device_fingerprint?: string;
  drop_off_site_id?: string;
  drop_off_custom_location?: string;
  parent_user_id?: string;
  created_at: string;
}

export interface Site {
  id: string;
  organization_id: string;
  name: string;
  active: boolean;
}

export interface Profile {
  user_id: string;
  display_name: string;
  organization_id?: string;
  email?: string;
  employee_code?: string;
  role?: string;
  employment_status?: string;
}

export interface AttendanceSession {
  id: string;
  organization_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  status: 'open' | 'closed';
}

export type Role = 'super_admin' | 'org_admin' | 'manager' | 'employee';

export const tables = {
  family_trees: 'family_trees',
  family_tree_children: 'family_tree_children',
  clock_events: 'clock_events',
  sites: 'sites',
  profiles: 'profiles',
  organizations: 'organizations',
  attendance_sessions: 'attendance_sessions',
} as const;
