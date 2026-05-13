-- =============================================================================
-- V15: Create event_source_log table
-- Stores a log entry for each poll cycle of an event source.
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_source_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_source_id BIGINT NOT NULL,
    status VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    events_ingested INTEGER,
    created_on TIMESTAMP NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS event_source_log_SEQ START WITH 1 INCREMENT BY 50;
