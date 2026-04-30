package io.apicurio.axiom.app;

import io.apicurio.axiom.core.entities.ReportDefinitionEntity;
import io.apicurio.axiom.core.entities.ReportEntity;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Polls for report definitions that are due and triggers report generation.
 * Runs every 60 seconds, checking for definitions where nextRunAt has passed.
 */
@ApplicationScoped
public class ReportScheduler {

    private static final Logger LOG = Logger.getLogger(ReportScheduler.class);

    @Inject
    ReportExecutionService reportExecutionService;

    /**
     * Checks for report definitions that are due and triggers generation.
     */
    @Scheduled(every = "${axiom.reports.poll-interval:60s}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void checkDueReports() {
        List<ReportDefinitionEntity> dueReports = ReportDefinitionEntity
                .<ReportDefinitionEntity>list(
                        "enabled = true and nextRunAt <= ?1", Instant.now());

        if (dueReports.isEmpty()) {
            return;
        }

        LOG.infof("Found %d report(s) due for generation", dueReports.size());

        for (ReportDefinitionEntity definition : dueReports) {
            try {
                Long reportId = createReportAndScheduleNext(definition);
                reportExecutionService.generateReport(definition, reportId);
            } catch (Exception e) {
                LOG.errorf(e, "Failed to trigger report '%s'", definition.name);
            }
        }
    }

    /**
     * Creates a pending report entity and advances the definition's next run time.
     *
     * @param definition the report definition
     * @return the created report entity ID
     */
    @Transactional
    public Long createReportAndScheduleNext(ReportDefinitionEntity definition) {
        // Create the report entity
        ReportEntity report = new ReportEntity();
        report.definitionId = definition.id;
        report.status = "Pending";
        report.title = definition.name;
        report.createdOn = Instant.now();
        report.persist();

        // Update the definition's scheduling
        definition.lastRunAt = Instant.now();
        definition.nextRunAt = computeNextRunAt(definition);
        definition.updatedOn = Instant.now();

        LOG.infof("Triggered report '%s' (report ID: %d, next run: %s)",
                definition.name, report.id, definition.nextRunAt);

        return report.id;
    }

    /**
     * Computes the next run time based on the schedule preset and time of day.
     */
    private Instant computeNextRunAt(ReportDefinitionEntity definition) {
        LocalTime timeOfDay = parseTimeOfDay(definition.scheduleTime);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        ZonedDateTime next;

        switch (definition.schedule) {
            case "daily" -> next = now.toLocalDate().plusDays(1).atTime(timeOfDay)
                    .atZone(ZoneId.systemDefault());
            case "weekly" -> next = now.toLocalDate().plusWeeks(1).atTime(timeOfDay)
                    .atZone(ZoneId.systemDefault());
            case "monthly" -> next = now.toLocalDate().plusMonths(1).atTime(timeOfDay)
                    .atZone(ZoneId.systemDefault());
            case "hourly" -> next = now.plusHours(1).truncatedTo(ChronoUnit.HOURS);
            default -> {
                // Default to daily if unrecognized
                next = now.toLocalDate().plusDays(1).atTime(timeOfDay)
                        .atZone(ZoneId.systemDefault());
            }
        }

        return next.toInstant();
    }

    private LocalTime parseTimeOfDay(String scheduleTime) {
        if (scheduleTime != null && !scheduleTime.isBlank()) {
            try {
                return LocalTime.parse(scheduleTime);
            } catch (Exception e) {
                // Fall back to 8:00 AM
            }
        }
        return LocalTime.of(8, 0);
    }
}
