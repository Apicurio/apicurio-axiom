package io.apicurio.axiom.events.core;

import io.apicurio.axiom.core.entities.EventQueueEntity;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.util.List;

/**
 * Background service that polls the event queue for pending events.
 *
 * <p>In Phase 3, this poller only detects and logs pending events. In Phase 6
 * (Pipeline Integration), it will be wired to the Manager for actual processing.</p>
 */
@ApplicationScoped
public class EventQueuePoller {

    private static final Logger LOG = Logger.getLogger(EventQueuePoller.class);

    /**
     * Polls for pending events every 5 seconds.
     */
    @Scheduled(every = "5s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void pollQueue() {
        List<EventQueueEntity> pending = EventQueueEntity
                .list("status", io.quarkus.panache.common.Sort.by("enqueuedAt"), "pending");

        if (!pending.isEmpty()) {
            LOG.infof("Event queue: %d pending event(s) awaiting processing", pending.size());
            for (EventQueueEntity entry : pending) {
                LOG.debugf("  Pending event queue entry %d (event %d)", entry.id, entry.eventId);
            }
        }
    }
}
