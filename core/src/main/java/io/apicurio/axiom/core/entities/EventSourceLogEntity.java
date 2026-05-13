package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A log entry recording the result of a single poll cycle for an event source.
 * Tracks whether the poll succeeded or failed, how many events were ingested,
 * and a human-readable summary message.
 */
@Entity
@Table(name = "event_source_log")
public class EventSourceLogEntity extends PanacheEntity {

    @Column(name = "event_source_id", nullable = false)
    public Long eventSourceId;

    @Column(nullable = false)
    public String status;

    @Column(nullable = false, columnDefinition = "TEXT")
    public String message;

    @Column(columnDefinition = "TEXT")
    public String detail;

    @Column(name = "events_ingested")
    public Integer eventsIngested;

    @Column(name = "created_on", nullable = false)
    public Instant createdOn;
}
