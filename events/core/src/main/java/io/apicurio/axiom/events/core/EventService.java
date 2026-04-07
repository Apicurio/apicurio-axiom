package io.apicurio.axiom.events.core;

import io.apicurio.axiom.core.entities.ActivityLogEntity;
import io.apicurio.axiom.core.entities.EventEntity;
import io.apicurio.axiom.core.entities.EventQueueEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.Instant;

/**
 * Service for persisting events and enqueuing them for processing.
 */
@ApplicationScoped
public class EventService {

    private static final Logger LOG = Logger.getLogger(EventService.class);

    /**
     * Persists a new event and enqueues it for processing by the Manager.
     *
     * @param source the event source (github, jira, internal)
     * @param eventType the normalized event type (e.g. issue-created, comment-added)
     * @param issueRef the issue reference (e.g. owner/repo#123), may be null
     * @param repository the repository identifier, may be null
     * @param payload the raw event payload as JSON
     * @return the persisted EventEntity
     */
    @Transactional
    public EventEntity ingestEvent(String source, String eventType, String issueRef,
                                   String repository, String payload) {
        // Persist the event
        EventEntity event = new EventEntity();
        event.source = source;
        event.eventType = eventType;
        event.issueRef = issueRef;
        event.repository = repository;
        event.payload = payload;
        event.receivedAt = Instant.now();
        event.persist();

        // Enqueue for processing
        EventQueueEntity queueEntry = new EventQueueEntity();
        queueEntry.eventId = event.id;
        queueEntry.status = "pending";
        queueEntry.enqueuedAt = Instant.now();
        queueEntry.persist();

        // Log to activity log
        ActivityLogEntity logEntry = new ActivityLogEntity();
        logEntry.eventId = event.id;
        logEntry.entryType = "event-received";
        logEntry.summary = String.format("Received %s event: %s from %s", source, eventType, repository);
        if (issueRef != null) {
            logEntry.summary += " (" + issueRef + ")";
        }
        logEntry.createdOn = Instant.now();
        logEntry.persist();

        LOG.infof("Ingested %s event [%s] for %s, enqueued as %d",
                source, eventType, issueRef, queueEntry.id);

        return event;
    }
}
