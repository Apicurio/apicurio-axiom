package io.apicurio.axiom.events.core;

import io.apicurio.axiom.core.entities.ActivityLogEntity;
import io.apicurio.axiom.core.entities.EventEntity;
import io.apicurio.axiom.core.entities.EventQueueEntity;
import io.apicurio.axiom.core.entities.EventSourceLogEntity;
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
     * @param source the event source type (github, jira, internal)
     * @param eventType the normalized event type (e.g. issue-created, comment-added)
     * @param issueRef the issue reference (e.g. owner/repo#123), may be null
     * @param repository the repository identifier, may be null
     * @param payload the raw event payload as JSON
     * @return the persisted EventEntity
     */
    @Transactional
    public EventEntity ingestEvent(String source, String eventType, String issueRef,
                                   String repository, String payload) {
        return ingestEvent(null, source, eventType, issueRef, repository, payload);
    }

    /**
     * Persists a new event from a specific Event Source and enqueues it for processing.
     *
     * @param eventSourceId the ID of the Event Source that produced this event, may be null
     * @param source the event source type (github, jira, internal)
     * @param eventType the normalized event type (e.g. issue-created, comment-added)
     * @param issueRef the issue reference (e.g. owner/repo#123), may be null
     * @param repository the repository identifier, may be null
     * @param payload the raw event payload as JSON
     * @return the persisted EventEntity
     */
    @Transactional
    public EventEntity ingestEvent(Long eventSourceId, String source, String eventType,
                                   String issueRef, String repository, String payload) {
        // Persist the event
        EventEntity event = new EventEntity();
        event.eventSourceId = eventSourceId;
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

    /**
     * Records a poll log entry for an event source.
     *
     * @param eventSourceId the event source that was polled
     * @param status "success" or "error"
     * @param message short summary of the poll result
     * @param detail full detailed log of the poll cycle
     * @param eventsIngested number of events ingested (0 on error)
     */
    @Transactional
    public void recordPollLog(Long eventSourceId, String status, String message,
                               String detail, int eventsIngested) {
        EventSourceLogEntity log = new EventSourceLogEntity();
        log.eventSourceId = eventSourceId;
        log.status = status;
        log.message = message;
        log.detail = detail;
        log.eventsIngested = eventsIngested;
        log.createdOn = Instant.now();
        log.persist();
    }
}
