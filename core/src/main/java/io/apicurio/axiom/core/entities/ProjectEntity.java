package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Represents a tracked unit of work tied to a single external issue.
 */
@Entity
@Table(name = "project")
public class ProjectEntity extends PanacheEntity {

    @Column(nullable = false)
    public String name;

    @Column(columnDefinition = "TEXT")
    public String description;

    @Column(nullable = false)
    public String type;

    @Column(nullable = false)
    public String status;

    @Column(name = "issue_source", nullable = false)
    public String issueSource;

    @Column(name = "issue_ref", nullable = false, unique = true)
    public String issueRef;

    @Column(nullable = false)
    public String repository;

    @Column(name = "created_on", nullable = false)
    public Instant createdOn;

    @Column(name = "updated_on", nullable = false)
    public Instant updatedOn;

    @Column(columnDefinition = "TEXT")
    public String metadata;
}
