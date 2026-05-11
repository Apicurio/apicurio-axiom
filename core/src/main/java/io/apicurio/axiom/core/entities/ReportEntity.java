package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A single generated report instance produced from a {@link ReportDefinitionEntity}.
 * Contains the report content (markdown), metadata about the time range covered,
 * execution status, and AI cost.
 */
@Entity
@Table(name = "report")
public class ReportEntity extends PanacheEntity {

    @Column(name = "definition_id", nullable = false)
    public Long definitionId;

    @Column(nullable = false)
    public String status;

    public String title;

    @Column(columnDefinition = "TEXT")
    public String content;

    @Column(name = "time_range_start")
    public Instant timeRangeStart;

    @Column(name = "time_range_end")
    public Instant timeRangeEnd;

    @Column(name = "execution_log", columnDefinition = "TEXT")
    public String executionLog;

    @Column(name = "cost_usd")
    public Double costUsd;

    @Column(name = "duration_ms")
    public Long durationMs;

    @Column(name = "created_on", nullable = false)
    public Instant createdOn;

    @Column(name = "completed_on")
    public Instant completedOn;
}
