package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Defines a recurring report that the system generates on a schedule.
 * Each definition produces {@link ReportEntity} instances when executed.
 */
@Entity
@Table(name = "report_definition")
public class ReportDefinitionEntity extends PanacheEntity {

    @Column(nullable = false)
    public String name;

    @Column(columnDefinition = "TEXT")
    public String description;

    /**
     * Schedule preset: "daily", "weekly", "monthly", or a cron expression.
     */
    @Column(nullable = false)
    public String schedule;

    /**
     * Time of day to run (e.g. "08:00"). Used with schedule presets.
     */
    @Column(name = "schedule_time")
    public String scheduleTime;

    /**
     * Time window for the report: "since-last-run", "last-24h", "last-7d", "last-30d".
     */
    @Column(name = "time_window", nullable = false)
    public String timeWindow;

    /**
     * List of "owner/repo" strings to scan. Empty list means all repositories.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "report_definition_repository",
            joinColumns = @JoinColumn(name = "definition_id"))
    @Column(name = "repository")
    public List<String> repositories = new ArrayList<>();

    /**
     * Prompt template with placeholders for the AI agent.
     * Supports: {{repositories}}, {{timeRangeStart}}, {{timeRangeEnd}}, {{timeWindow}}
     */
    @Column(name = "prompt_template", nullable = false, columnDefinition = "TEXT")
    public String promptTemplate;

    /**
     * Comma-separated list of tools the AI agent is allowed to use.
     */
    @Column(name = "allowed_tools", columnDefinition = "TEXT")
    public String allowedTools;

    @Column(nullable = false)
    public boolean enabled;

    @Column(name = "next_run_at")
    public Instant nextRunAt;

    @Column(name = "last_run_at")
    public Instant lastRunAt;

    @Column(name = "created_on", nullable = false)
    public Instant createdOn;

    @Column(name = "updated_on", nullable = false)
    public Instant updatedOn;
}
