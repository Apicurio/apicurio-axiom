package io.apicurio.axiom.app;

import io.apicurio.axiom.core.entities.EventSourceLogEntity;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Periodically deletes old event source poll logs to prevent unbounded
 * table growth. Runs once per hour and removes entries older than the
 * configured retention period.
 */
@ApplicationScoped
public class EventSourceLogCleanup {

    private static final Logger LOG = Logger.getLogger(EventSourceLogCleanup.class);

    @ConfigProperty(name = "axiom.event-source-logs.retention-days", defaultValue = "7")
    int retentionDays;

    /**
     * Deletes event source log entries older than the retention period.
     */
    @Scheduled(every = "1h", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    @Transactional
    void cleanup() {
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        long deleted = EventSourceLogEntity.delete("createdOn < ?1", cutoff);
        if (deleted > 0) {
            LOG.infof("Cleaned up %d event source log(s) older than %d days", deleted, retentionDays);
        }
    }
}
