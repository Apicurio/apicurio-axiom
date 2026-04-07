package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * An entry in the event processing queue.
 */
@Entity
@Table(name = "event_queue")
public class EventQueueEntity extends PanacheEntity {

    @Column(name = "event_id", nullable = false)
    public Long eventId;

    @Column(nullable = false)
    public String status;

    @Column(name = "enqueued_at", nullable = false)
    public Instant enqueuedAt;

    @Column(name = "processed_at")
    public Instant processedAt;
}
