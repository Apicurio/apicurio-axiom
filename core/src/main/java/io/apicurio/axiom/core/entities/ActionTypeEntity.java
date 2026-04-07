package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Defines a kind of work that can be performed within the system.
 */
@Entity
@Table(name = "action_type")
public class ActionTypeEntity extends PanacheEntity {

    @Column(nullable = false, unique = true)
    public String name;

    @Column(columnDefinition = "TEXT")
    public String description;

    @Column(name = "execution_mode", nullable = false)
    public String executionMode;

    @Column(name = "user_triggerable", nullable = false)
    public boolean userTriggerable;

    @Column(name = "input_schema", columnDefinition = "TEXT")
    public String inputSchema;

    @Column(name = "tool_constraints", columnDefinition = "TEXT")
    public String toolConstraints;

    @Column(name = "emits_event", nullable = false)
    public boolean emitsEvent;
}
