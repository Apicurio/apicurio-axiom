package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * A natural-language decision guideline used by the AI Manager.
 */
@Entity
@Table(name = "policy")
public class PolicyEntity extends PanacheEntity {

    @Column(nullable = false)
    public String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    public String guideline;

    @Column(name = "action_type")
    public String actionType;

    @Column(name = "actor_hint")
    public String actorHint;
}
