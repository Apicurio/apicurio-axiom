package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Represents something that happened — either externally or internally.
 */
@Entity
@Table(name = "event")
public class EventEntity extends PanacheEntity {

    @Column(nullable = false)
    public String source;

    @Column(name = "event_type", nullable = false)
    public String eventType;

    @Column(name = "issue_ref")
    public String issueRef;

    public String repository;

    @Column(name = "project_id")
    public Long projectId;

    @Column(name = "task_id")
    public Long taskId;

    @Column(nullable = false, columnDefinition = "TEXT")
    public String payload;

    @Column(name = "received_at", nullable = false)
    public Instant receivedAt;
}
