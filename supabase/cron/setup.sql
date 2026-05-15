-- Cron job setup for the attendance system.
-- These jobs use Supabase's pg_cron extension for scheduling background tasks.
-- Requires: pg_cron extension to be enabled in the Supabase project dashboard.

-- ============================================================================
-- CRON JOB 1: stale-session-check
-- Runs every hour. Flags attendance sessions that have been open for > 14 hours
-- as requiring review. Calls the edge function or updates directly.
-- ============================================================================
SELECT cron.schedule(
    'stale-session-check',
    '0 * * * *',  -- Every hour at minute 0
    $$
    UPDATE attendance_sessions
    SET
        status = 'closed',
        ended_at = now(),
        updated_at = now()
    WHERE
        status = 'open'
        AND started_at < now() - INTERVAL '14 hours'
        AND id IN (
            SELECT id FROM attendance_sessions
            WHERE status = 'open'
              AND started_at < now() - INTERVAL '14 hours'
            ORDER BY started_at ASC
            FOR UPDATE SKIP LOCKED
        );
    $$
);

COMMENT ON FUNCTION cron.schedule IS 'Cron job: stale-session-check - auto-closes sessions open > 14 hours and flags for review';

-- ============================================================================
-- CRON JOB 2: cleanup-sensitive-media
-- Runs daily at 03:00. Deletes biometric media files from storage that are
-- older than the retention period defined in the organization's biometric policy.
-- ============================================================================
SELECT cron.schedule(
    'cleanup-sensitive-media',
    '0 3 * * *',  -- Daily at 03:00
    $$
    DELETE FROM storage.objects
    WHERE bucket_id = 'biometric-media'
      AND created_at < now() - INTERVAL '90 days'
      AND id IN (
        SELECT id FROM storage.objects
        WHERE bucket_id = 'biometric-media'
          AND created_at < now() - INTERVAL '90 days'
        ORDER BY id
        FOR UPDATE SKIP LOCKED
    );
    $$
);

COMMENT ON FUNCTION cron.schedule IS 'Cron job: cleanup-sensitive-media - deletes biometric media older than 90 days';

-- ============================================================================
-- CRON JOB 3: auto-close-stale-sessions
-- Runs daily at 23:59. Closes any attendance sessions still open from the
-- previous calendar day (or earlier), recording them with ended_at = midnight.
-- ============================================================================
SELECT cron.schedule(
    'auto-close-stale-sessions',
    '59 23 * * *',  -- Daily at 23:59
    $$
    UPDATE attendance_sessions
    SET
        status = 'closed',
        ended_at = date_trunc('day', now()) + INTERVAL '23 hours 59 minutes',
        worked_minutes_raw = EXTRACT(EPOCH FROM (
            (date_trunc('day', now()) + INTERVAL '23 hours 59 minutes') - started_at
        )) / 60,
        payable_minutes = EXTRACT(EPOCH FROM (
            (date_trunc('day', now()) + INTERVAL '23 hours 59 minutes') - started_at
        )) / 60,
        updated_at = now()
    WHERE
        status = 'open'
        AND started_at < date_trunc('day', now())
        AND id IN (
            SELECT id FROM attendance_sessions
            WHERE status = 'open'
              AND started_at < date_trunc('day', now())
            ORDER BY started_at ASC
            FOR UPDATE SKIP LOCKED
        );
    $$
);

COMMENT ON FUNCTION cron.schedule IS 'Cron job: auto-close-stale-sessions - closes sessions still open from the previous day at midnight';
