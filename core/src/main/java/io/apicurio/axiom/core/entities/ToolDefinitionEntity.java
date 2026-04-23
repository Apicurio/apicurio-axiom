package io.apicurio.axiom.core.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Defines a custom tool that can be provided to AI agents via MCP.
 *
 * <p>Two types of tools:</p>
 * <ul>
 *   <li><b>script</b> — A shell command template that Axiom wraps into an MCP server.
 *       Users define the command with {{param}} placeholders.</li>
 *   <li><b>mcp-server</b> — An external MCP server (stdio or HTTP) that provides
 *       its own tools.</li>
 * </ul>
 */
@Entity
@Table(name = "tool_definition")
public class ToolDefinitionEntity extends PanacheEntity {

    @Column(nullable = false, unique = true)
    public String name;

    @Column(columnDefinition = "TEXT")
    public String description;

    /**
     * Tool type: "script" or "mcp-server"
     */
    @Column(nullable = false)
    public String type;

    /**
     * JSON array of parameter definitions.
     * Each element: {name, type, description, required}
     * Only used for "script" type tools.
     */
    @Column(columnDefinition = "TEXT")
    public String parameters;

    /**
     * Bash script template with {{param}} placeholders.
     * Supports multi-line scripts. Only used for "script" type tools.
     */
    @Column(name = "script_template", columnDefinition = "TEXT")
    public String scriptTemplate;

    /**
     * For "mcp-server" type: the command to launch the server (stdio transport).
     */
    @Column(name = "server_command")
    public String serverCommand;

    /**
     * For "mcp-server" type: arguments for the server command (JSON array).
     */
    @Column(name = "server_args", columnDefinition = "TEXT")
    public String serverArgs;

    /**
     * For "mcp-server" type: environment variables (JSON object).
     */
    @Column(name = "server_env", columnDefinition = "TEXT")
    public String serverEnv;

    /**
     * For "mcp-server" type: HTTP/SSE URL (alternative to stdio).
     */
    @Column(name = "server_url")
    public String serverUrl;
}
