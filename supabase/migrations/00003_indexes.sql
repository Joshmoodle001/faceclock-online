-- Performance indexes for the attendance system.
-- Covers B-tree for lookups, GIST for geospatial, and IVFFlat for vector similarity.

-- ============================================================================
-- PROFILES INDEXES
-- ============================================================================
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_manager_user_id ON profiles(manager_user_id);
CREATE INDEX idx_profiles_team_id ON profiles(team_id);
CREATE INDEX idx_profiles_employment_status ON profiles(employment_status);

-- ============================================================================
-- CLOCK EVENTS INDEXES
-- ============================================================================
CREATE INDEX idx_clock_events_org_occurred ON clock_events(organization_id, occurred_at DESC);
CREATE INDEX idx_clock_events_user_occurred ON clock_events(user_id, occurred_at);
CREATE UNIQUE INDEX idx_clock_events_client_event_id ON clock_events(client_event_id);
CREATE INDEX idx_clock_events_decision ON clock_events(decision);
CREATE INDEX idx_clock_events_review_state ON clock_events(review_state);

-- ============================================================================
-- ATTENDANCE SESSIONS INDEXES
-- ============================================================================
CREATE INDEX idx_att_sessions_org_user_started ON attendance_sessions(organization_id, user_id, started_at);
CREATE INDEX idx_att_sessions_status ON attendance_sessions(status);

-- ============================================================================
-- DEVICES INDEXES
-- ============================================================================
CREATE INDEX idx_devices_org_user ON devices(organization_id, user_id);
CREATE INDEX idx_devices_attestation_level ON devices(attestation_level);

-- ============================================================================
-- FACE ENROLLMENTS INDEXES
-- ============================================================================
CREATE INDEX idx_face_enrollments_org_user ON face_enrollments(organization_id, user_id);
CREATE INDEX idx_face_enrollments_status ON face_enrollments(status);
CREATE INDEX idx_face_enrollments_active ON face_enrollments(active);

-- ============================================================================
-- AUDIT LOGS INDEXES
-- ============================================================================
CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- PAYROLL RUNS INDEXES
-- ============================================================================
CREATE INDEX idx_payroll_runs_org_period ON payroll_runs(organization_id, period_start);
CREATE INDEX idx_payroll_runs_status ON payroll_runs(status);

-- ============================================================================
-- PAYROLL LINES INDEXES
-- ============================================================================
CREATE INDEX idx_payroll_lines_run ON payroll_lines(payroll_run_id);
CREATE INDEX idx_payroll_lines_user ON payroll_lines(user_id);
CREATE INDEX idx_payroll_lines_status ON payroll_lines(status);

-- ============================================================================
-- LOCATION BREADCRUMBS INDEXES
-- ============================================================================
CREATE INDEX idx_breadcrumbs_user_captured ON location_breadcrumbs(user_id, captured_at DESC);

-- ============================================================================
-- PAY RATES INDEXES
-- ============================================================================
CREATE INDEX idx_pay_rates_user_effective ON pay_rates(user_id, effective_from DESC);

-- ============================================================================
-- SPATIAL INDEXES (GIST on geography/geometry columns)
-- ============================================================================
CREATE INDEX idx_sites_center_geog ON sites USING GIST (center_geog);
CREATE INDEX idx_geofences_center_geog ON geofences USING GIST (center_geog);
CREATE INDEX idx_geofences_polygon_geom ON geofences USING GIST (polygon_geom);
CREATE INDEX idx_clock_events_location_geog ON clock_events USING GIST (location_geog);
CREATE INDEX idx_breadcrumbs_location_geog ON location_breadcrumbs USING GIST (location_geog);

-- ============================================================================
-- VECTOR INDEX (IVFFlat with cosine similarity for face embeddings)
-- ============================================================================
CREATE INDEX idx_face_enrollments_embedding ON face_enrollments USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

COMMENT ON INDEX idx_face_enrollments_embedding IS 'IVFFlat index for cosine similarity search on 512-dim face embeddings; 100 lists for ~10K-50K enrollment scale';
