# Security Checklist

## Authentication & Authorization
- [ ] Supabase Auth configured with email/password + social providers
- [ ] Row Level Security (RLS) enabled on all tables
- [ ] RLS policies restrict data to authenticated users within their organization
- [ ] Service role key only used in Edge Functions (never exposed to client)
- [ ] Middleware protects admin routes by role
- [ ] Face enrollment requires authenticated session
- [ ] Device registration required for clock events

## Face Verification
- [ ] Browser performs initial detection but server makes final decision
- [ ] Face match score threshold enforced server-side (minimum 0.6)
- [ ] Liveness check required (minimum 0.5 for accept)
- [ ] Face embeddings stored in database, never returned to browser
- [ ] Biometric media stored in private storage bucket
- [ ] Automatic cleanup of biometric media after retention period
- [ ] Enrollment requires admin approval before use

## Location Security
- [ ] HTTPS enforced for all connections
- [ ] High-accuracy geolocation required for clock events
- [ ] PostGIS validates geofence server-side (client check is UX only)
- [ ] Location accuracy threshold enforced server-side
- [ ] Stale location timestamps rejected (>30 seconds)
- [ ] Impossible travel detection (speed >900km/h rejected)
- [ ] Repeated same-coordinate detection
- [ ] GPS accuracy analyzed (too-perfect accuracy flagged as suspicious)

## Device Trust
- [ ] Device fingerprint captured and verified per session
- [ ] Device attestation level tracked (web/passkey/native)
- [ ] WebAuthn/passkey support for stronger verification
- [ ] Device blocking capability for admins
- [ ] Suspicious device changes flagged

## Risk Scoring
- [ ] Location risk score (0-100) calculated from multiple factors
- [ ] Device risk score calculated from trust indicators
- [ ] Face match score inverted and weighted
- [ ] Liveness score inverted and weighted
- [ ] Final risk score determines decision (accepted/rejected/review)
- [ ] Thresholds configurable per organization

## Payroll Security
- [ ] Payroll calculated only from approved attendance sessions
- [ ] Payroll changes require audit logging
- [ ] Finance admin cannot access biometric data
- [ ] Payroll exports stored in private bucket
- [ ] Calculation snapshots stored for auditability

## Audit Trail
- [ ] All clock events stored append-only
- [ ] All admin actions logged (entity_type, entity_id, action, metadata)
- [ ] Biometric access logged
- [ ] Payroll approvals logged
- [ ] Manual edits logged
- [ ] Exports logged
- [ ] Audit logs insert-only from trusted backend

## Data Privacy
- [ ] Explicit consent screens for biometric and location data
- [ ] Clear biometric policy displayed during enrollment
- [ ] Location tracked at clock events only by default
- [ ] Live tracking requires enabled policy
- [ ] Retention limits on biometric media
- [ ] Re-enrollment support
- [ ] Employee disable/deactivation support
- [ ] Biometric template deletion per policy

## Production Hardening (Future)
- [ ] Rate limiting on auth endpoints
- [ ] Rate limiting on clock event submissions
- [ ] IP-based suspicious activity detection
- [ ] Session management with expiry
- [ ] CORS configuration for production domains
- [ ] Content Security Policy headers
- [ ] Subresource Integrity for CDN resources
- [ ] Regular security audits
- [ ] Penetration testing

## Compliance
- [ ] Review against POPIA (South Africa) before production
- [ ] Review against GDPR if EU users
- [ ] Review against local employment laws
- [ ] Privacy policy displayed and accepted
- [ ] Terms of service displayed and accepted
- [ ] Data retention policy documented and enforced
