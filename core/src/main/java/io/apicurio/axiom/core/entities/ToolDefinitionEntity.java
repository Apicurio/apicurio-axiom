package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Defines a custom script tool that can be provided to AI agents via MCP.
 * The tool is a bash script template with {{param}} placeholders that Axiom
 * wraps into an MCP server automatically.
 */
@Entity
@Table(name = "tool_definition")
public class ToolDefinitionEntity extends PanacheEntity {

    @Column(nullable = false, unique = true)
    public String name;

    @Column(columnDefinition = "TEXT")
    public String description;

    /**
     * JSON array of parameter definitions.
     * Each element: {name, type, description, required}
     */
    @Column(columnDefinition = "TEXT")
    public String parameters;

    /**
     * Bash script template with {{param}} placeholders.
     * Supports multi-line scripts.
     */
    @Column(name = "script_template", columnDefinition = "TEXT")
    public String scriptTemplate;
}
