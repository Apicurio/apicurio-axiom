package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A monitored repository (GitHub or Jira project).
 */
@Entity
@Table(name = "repository")
public class RepositoryEntity extends PanacheEntity {

    @Column(nullable = false)
    public String name;

    @Column(nullable = false)
    public String owner;

    @Column(nullable = false)
    public String source;

    @Column(nullable = false)
    public String url;

    @Column(name = "poll_interval")
    public Integer pollInterval;

    @Column(name = "webhook_secret")
    public String webhookSecret;

    @Column(columnDefinition = "TEXT")
    public String configuration;

    @Column(name = "polling_enabled")
    public boolean pollingEnabled;

    @Column(name = "last_polled_at")
    public Instant lastPolledAt;
}
