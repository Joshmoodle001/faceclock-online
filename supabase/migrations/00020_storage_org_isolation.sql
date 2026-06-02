-- Fix storage RLS to prevent cross-organization data leaks.
-- Drop over-broad authenticated policies and replace with org-scoped ones.
-- Files should be stored under {organization_id}/ path prefix.

-- ============================================================================
-- DROP existing over-broad authenticated policies
-- ============================================================================
DROP POLICY IF EXISTS biomedia_org_admin_select ON storage.objects;
DROP POLICY IF EXISTS payroll_exports_finance_select ON storage.objects;

-- ============================================================================
-- REPLACE with org-scoped policies
-- ============================================================================

-- biometric-media: org_admin/super_admin can only read files in their org's folder
CREATE POLICY biomedia_org_scoped_select ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'biometric-media'
        AND (
            auth.get_user_role() IN ('super_admin')
            OR (
                auth.get_user_role() = 'org_admin'
                AND name LIKE (auth.get_user_organization_id()::text || '/%')
            )
        )
    );

-- payroll-exports: org_admin/finance_admin/super_admin scoped by org folder
CREATE POLICY payroll_exports_org_scoped_select ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'payroll-exports'
        AND (
            auth.get_user_role() IN ('super_admin')
            OR (
                auth.get_user_role() IN ('org_admin', 'finance_admin')
                AND name LIKE (auth.get_user_organization_id()::text || '/%')
            )
        )
    );
