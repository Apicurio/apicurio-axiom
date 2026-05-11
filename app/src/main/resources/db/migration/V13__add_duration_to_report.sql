-- =============================================================================
-- V13: Add duration_ms column to report
-- Tracks how long report generation took in milliseconds.
-- =============================================================================

ALTER TABLE report ADD COLUMN IF NOT EXISTS duration_ms BIGINT;
