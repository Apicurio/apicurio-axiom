-- =============================================================================
-- V12: Add timeout_seconds column to report_definition
-- Allows per-report timeout override for long-running reports.
-- =============================================================================

ALTER TABLE report_definition ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER;
