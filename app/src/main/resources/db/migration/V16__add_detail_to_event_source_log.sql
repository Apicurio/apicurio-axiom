-- =============================================================================
-- V16: Add detail column to event_source_log
-- Stores the full detailed log for each poll cycle.
-- =============================================================================

ALTER TABLE event_source_log ADD COLUMN IF NOT EXISTS detail TEXT;
