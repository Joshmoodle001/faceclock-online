export type Role = 'super_admin' | 'org_admin' | 'manager' | 'finance_admin' | 'employee';
export type EmploymentStatus = 'active' | 'inactive' | 'suspended' | 'terminated';
export type ClockEventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | 'manual_adjustment';
export type ClockDecision = 'accepted' | 'rejected' | 'review_required';
export type ReviewState = 'none' | 'pending' | 'approved' | 'rejected';
export type GeofenceType = 'circle' | 'polygon';
export type EnrollmentStatus = 'pending_review' | 'approved' | 'rejected' | 'needs_reenrollment';
export type AttestationLevel = 'web' | 'passkey_verified' | 'play_integrity' | 'app_attest';
export type PayrollRunStatus = 'draft' | 'calculated' | 'pending_approval' | 'approved' | 'paid' | 'cancelled';
export type PayrollLineStatus = 'draft' | 'approved' | 'held' | 'paid' | 'disputed';
export type AttendanceSessionStatus = 'open' | 'closed' | 'approved' | 'flagged';
export type LocationRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Organization { id: string; name: string; slug: string; default_timezone: string; currency: string; status: string; location_policy_json: Record<string, unknown>; biometric_policy_json: Record<string, unknown>; payroll_policy_json: Record<string, unknown>; created_at: string; updated_at: string; }

export interface Site { id: string; organization_id: string; name: string; address?: string; latitude: number; longitude: number; timezone?: string; active: boolean; created_at: string; updated_at: string; }

export interface Geofence { id: string; organization_id: string; site_id: string; name: string; type: GeofenceType; latitude?: number; longitude?: number; radius_m?: number; polygon_coordinates?: [number,number][]; accuracy_threshold_m: number; grace_distance_m: number; active_from?: string; active_to?: string; active: boolean; created_at: string; updated_at: string; }

export interface Profile { user_id: string; organization_id: string; employee_code?: string; display_name: string; email: string; phone?: string; role: Role; manager_user_id?: string; employment_status: EmploymentStatus; home_site_id?: string; team_id?: string; created_at: string; updated_at: string; }

export interface Device { id: string; organization_id: string; user_id: string; device_name?: string; device_type?: string; platform?: string; browser?: string; fingerprint_hash?: string; webauthn_credential_id?: string; attestation_level: AttestationLevel; blocked: boolean; last_seen_at?: string; created_at: string; updated_at: string; }

export interface FaceEnrollment { id: string; organization_id: string; user_id: string; model_name: string; model_version: string; quality_score: number; liveness_score: number; face_descriptor?: number[]; status: EnrollmentStatus; active: boolean; reviewed_by?: string; reviewed_at?: string; created_at: string; }

export interface ClockEvent { id: string; organization_id: string; user_id: string; site_id?: string; geofence_id?: string; device_id?: string; event_type: ClockEventType; occurred_at: string; submitted_at: string; client_event_id: string; latitude?: number; longitude?: number; accuracy_m?: number; within_geofence?: boolean; distance_from_geofence_m?: number; face_match_score?: number; liveness_score?: number; location_risk_score?: number; device_risk_score?: number; final_risk_score?: number; decision: ClockDecision; review_state: ReviewState; review_reason?: string; created_at: string; }

export interface AttendanceSession { id: string; organization_id: string; user_id: string; site_id?: string; opened_by_event_id?: string; closed_by_event_id?: string; started_at: string; ended_at?: string; worked_minutes_raw?: number; break_minutes: number; overtime_minutes: number; payable_minutes?: number; status: AttendanceSessionStatus; approved_by?: string; approved_at?: string; created_at: string; updated_at: string; }

export interface PayrollRun { id: string; organization_id: string; period_start: string; period_end: string; status: PayrollRunStatus; generated_at?: string; approved_by?: string; approved_at?: string; paid_at?: string; created_at: string; updated_at: string; }

export interface PayrollLine { id: string; organization_id: string; payroll_run_id: string; user_id: string; regular_minutes: number; overtime_minutes: number; break_minutes: number; hourly_rate_snapshot: number; gross_amount: number; deductions_amount: number; adjustments_amount: number; net_amount: number; status: PayrollLineStatus; created_at: string; updated_at: string; }

export interface AuditLog { id: string; organization_id: string; actor_user_id: string; entity_type: string; entity_id: string; action: string; metadata_json: Record<string, unknown>; ip_address?: string; user_agent?: string; created_at: string; }

export interface ClockSubmission { event_type: ClockEventType; occurred_at: string; client_event_id: string; site_id: string; geofence_id: string; latitude: number; longitude: number; accuracy_m: number; speed_mps?: number; heading?: number; altitude_m?: number; face_match_score: number; liveness_score: number; device_fingerprint: string; timestamp: string; }

export interface ClockResult { decision: ClockDecision; clock_event_id: string; message: string; risk_scores: { location: number; device: number; face_match: number; liveness: number; final: number; }; session?: AttendanceSession; }

export interface PayrollCalculation { user_id: string; regular_minutes: number; overtime_minutes: number; break_minutes: number; hourly_rate: number; gross_amount: number; deductions_amount: number; adjustments_amount: number; net_amount: number; }

export interface RiskScores { location_risk_score: number; device_risk_score: number; face_match_score: number; liveness_score: number; final_risk_score: number; }

export interface GeofenceResult { within: boolean; distance_m: number; risk_level: LocationRiskLevel; }

export interface GeofenceAssignment {
  id: string;
  geofence_id: string;
  user_id: string;
  created_at: string;
}

export interface DeviceInfo {
  fingerprint: string;
  platform?: string;
  browser?: string;
  device_type?: string;
  webauthn_credential_id?: string;
  attestation_level: AttestationLevel;
}

export const tables = {
  organizations: 'organizations',
  sites: 'sites',
  geofences: 'geofences',
  profiles: 'profiles',
  devices: 'devices',
  face_enrollments: 'face_enrollments',
  clock_events: 'clock_events',
  attendance_sessions: 'attendance_sessions',
  payroll_runs: 'payroll_runs',
  payroll_lines: 'payroll_lines',
  audit_logs: 'audit_logs',
  geofence_assignments: 'geofence_assignments',
} as const;

export type Tables = keyof typeof tables;

export function getTableName(table: Tables): string {
  return tables[table];
}
