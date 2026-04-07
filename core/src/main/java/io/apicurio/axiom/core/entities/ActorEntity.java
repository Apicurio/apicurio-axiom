package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Represents an entity capable of performing work (human or AI agent).
 */
@Entity
@Table(name = "actor")
public class ActorEntity extends PanacheEntity {

    @Column(nullable = false)
    public String name;

    @Column(columnDefinition = "TEXT")
    public String description;

    @Column(nullable = false)
    public String type;

    @Column(columnDefinition = "TEXT")
    public String capabilities;

    @Column(columnDefinition = "TEXT")
    public String permissions;

    @Column(columnDefinition = "TEXT")
    public String configuration;
}
