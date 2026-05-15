-- Storage bucket and RLS setup for biometric media and payroll exports.

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES
    (
        'biometric-media',
        'biometric-media',
        false,
        false,
        10485760, -- 10 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
    ),
    (
        'payroll-exports',
        'payroll-exports',
        false,
        false,
        52428800, -- 50 MB
        ARRAY['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf']
    )
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN storage.buckets.file_size_limit IS 'biometric-media: 10MB, payroll-exports: 50MB';

-- ============================================================================
-- RLS ON STORAGE OBJECTS: BIOMETRIC-MEDIA
-- ============================================================================
-- Note: In Supabase, storage RLS policies are on the storage.objects table
-- using bucket_id to scope the policy.

-- Allow service_role full access (edge functions / server-side operations)
CREATE POLICY biomedia_service_all ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'biometric-media')
    WITH CHECK (bucket_id = 'biometric-media');

-- Allow authenticated org_admins to SELECT (read) biometric media for review
CREATE POLICY biomedia_org_admin_select ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'biometric-media'
        AND auth.get_user_role() IN ('org_admin', 'super_admin')
    );

-- Employees cannot list or read biometric-media objects (no policy for them = deny)

-- ============================================================================
-- RLS ON STORAGE OBJECTS: PAYROLL-EXPORTS
-- ============================================================================
CREATE POLICY payroll_exports_service_all ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'payroll-exports')
    WITH CHECK (bucket_id = 'payroll-exports');

CREATE POLICY payroll_exports_finance_select ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'payroll-exports'
        AND auth.get_user_role() IN ('finance_admin', 'org_admin', 'super_admin')
    );
