-- =============================================================================
-- V11: Add schedule_day_of_week column to report_definition
-- Allows weekly reports to target a specific day of the week.
-- =============================================================================

ALTER TABLE report_definition ADD COLUMN IF NOT EXISTS schedule_day_of_week VARCHAR(10);
