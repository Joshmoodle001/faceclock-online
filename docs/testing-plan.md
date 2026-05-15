# Testing Plan

## Unit Tests

### Face Module
- `detectFace`: mock ImageData, verify result structure
- `checkFaceQuality`: test brightness/blur thresholds
- `compareEmbeddings`: cosine similarity edge cases (identical, opposite, orthogonal vectors)
- `runPassiveLiveness`: mock return values
- `enrollFace`: multiple frames, best frame selection

### Location Module
- `checkGeofence`: circle inside/boundary/outside, polygon inside/outside
- `calculateLocationRiskScore`: accuracy scenarios, impossible travel, stale data, same coordinates
- `getCurrentPosition`: mock geolocation API

### Risk Scoring
- `calculateFinalRiskScore`: weight calculations
- `getClockDecision`: threshold boundaries (accepted/rejected/review_required)

### Payroll Calculator
- `calculatePayroll`: regular only, overtime, deductions, adjustments, zero hours
- `calculateOvertime`: daily threshold, weekly threshold, edge cases
- `generatePayrollCSV`: header format, row format, totals

### Audit Utils
- `logAuditEvent`: verify insert structure
- `createAuditEntry`: field mapping

### Device Utils
- `generateDeviceFingerprint`: deterministic for same inputs
- `getDeviceInfo`: platform detection

## Integration Tests

### Supabase Edge Functions
- `submit-clock-event`: valid clock_in, duplicate prevention, outside geofence, low liveness, broken auth token
- `calculate-payroll`: empty period, single employee, multiple employees, overtime calculation
- `export-payroll`: CSV generation, storage upload, signed URL
- `stale-session-check`: find and close stale sessions

### Database Functions
- `fn_check_duplicate_clock`: same client_event_id returns true
- `fn_get_active_attendance_session`: open session exists vs doesn't
- `fn_handle_clock_event`: full event lifecycle

### RLS Policies
- Employee can read own profile only
- Org admin can read org profiles only
- Super admin can read all
- Unauthenticated access returns empty

## E2E Tests (Manual Checklist)

### Employee Flow
- [ ] Sign in with valid credentials → redirect to /app
- [ ] Sign in with invalid credentials → error message
- [ ] Enroll face with good lighting → enrollment pending
- [ ] Enroll face with poor lighting → quality error
- [ ] Enroll face with multiple faces → error
- [ ] Clock in inside geofence → accepted
- [ ] Clock in outside geofence → rejected or review
- [ ] Clock in without camera → error
- [ ] Clock in without location → error
- [ ] Clock out after clock in → accepted
- [ ] Clock out without clocking in → error
- [ ] Start break while clocked in → accepted
- [ ] End break after break start → accepted
- [ ] Double clock prevention → rejected as duplicate
- [ ] View attendance history → list of sessions
- [ ] View payroll summary → payroll data

### Admin Flow
- [ ] Sign in as org_admin → redirect to /admin
- [ ] View dashboard → stats load
- [ ] Manage employees → create/edit/disable
- [ ] Review enrollments → approve/reject
- [ ] Create site → map/coordinates
- [ ] Create geofence → circle/polygon
- [ ] View clock events → filterable table
- [ ] Approve pending events
- [ ] View live map → markers load
- [ ] Create payroll run → calculates correctly
- [ ] Export payroll CSV → file downloads
- [ ] View audit logs → entries present

### Super Admin Flow
- [ ] View all organizations
- [ ] Access any org's admin panel
- [ ] View global live map
- [ ] Review system-wide audit logs
- [ ] Manage global settings

## Load Testing Considerations
- Clock event submission throughput per organization
- Payroll calculation for large employee counts
- Live map with many concurrent users
- Real-time presence/broadcast limits

## Test Files Location
- Unit tests: `src/**/*.test.ts` (co-located with source)
- Edge Function tests: `supabase/functions/*/test.ts`
- E2E tests: `cypress/` or `playwright/`
