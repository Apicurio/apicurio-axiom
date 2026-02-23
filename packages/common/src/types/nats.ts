/**
 * NATS message wrapper types
 */

import type { Event } from './events.js';

/**
 * NATS event message wrapper
 * Wraps the normalized Event with metadata for message passing
 */
export interface NatsEventMessage {
    /**
     * Schema version for compatibility checking
     */
    schema_version: string;

    /**
     * Schema identifier for validation
     */
    schema_id: string;

    /**
     * Event source system (github, jira, etc.)
     */
    source: 'github' | 'jira';

    /**
     * Timestamp when message was published
     */
    timestamp: string;

    /**
     * The normalized event data
     */
    event: Event;
}
