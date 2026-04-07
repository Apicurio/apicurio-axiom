package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A global activity log entry.
 */
@Entity
@Table(name = "activity_log")
public class ActivityLogEntity extends PanacheEntity {

    @Column(name = "project_id")
    public Long projectId;

    @Column(name = "task_id")
    public Long taskId;

    @Column(name = "event_id")
    public Long eventId;

    @Column(name = "entry_type", nullable = false)
    public String entryType;

    @Column(nullable = false)
    public String summary;

    @Column(columnDefinition = "TEXT")
    public String details;

    @Column(name = "created_on", nullable = false)
    public Instant createdOn;
}
