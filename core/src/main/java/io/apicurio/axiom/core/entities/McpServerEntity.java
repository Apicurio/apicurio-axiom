package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Defines an external MCP server that provides tools to AI agents.
 * Supports stdio transport (command + args) or HTTP transport (URL).
 */
@Entity
@Table(name = "mcp_server")
public class McpServerEntity extends PanacheEntity {

    @Column(nullable = false, unique = true)
    public String name;

    @Column(columnDefinition = "TEXT")
    public String description;

    /**
     * Command to launch the MCP server (stdio transport).
     */
    @Column(name = "server_command")
    public String serverCommand;

    /**
     * Arguments for the server command (JSON array).
     */
    @Column(name = "server_args", columnDefinition = "TEXT")
    public String serverArgs;

    /**
     * Environment variables for the server (JSON object).
     */
    @Column(name = "server_env", columnDefinition = "TEXT")
    public String serverEnv;

    /**
     * HTTP/SSE URL (alternative to stdio transport).
     */
    @Column(name = "server_url")
    public String serverUrl;
}
