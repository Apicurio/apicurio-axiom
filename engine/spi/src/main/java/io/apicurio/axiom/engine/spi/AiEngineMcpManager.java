package io.apicurio.axiom.engine.spi;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * SPI interface for engine-specific MCP (Model Context Protocol) server management.
 * Each engine implementation handles MCP configuration differently:
 * <ul>
 *   <li>Claude Code: generates a JSON config file passed via {@code --mcp-config}</li>
 *   <li>OpenCode: registers servers via HTTP API or {@code opencode.json} config</li>
 * </ul>
 *
 * <p>Implementations are CDI beans annotated with {@link AiEngineType}.</p>
 */
public interface AiEngineMcpManager {

    /**
     * Configures MCP servers for a task execution. The returned path may be
     * used as an engine-specific MCP configuration reference (e.g. a config
     * file path for Claude Code), or null if the engine handles MCP setup
     * differently (e.g. via HTTP API).
     *
     * @param taskId       the task ID (for unique naming/isolation)
     * @param environment  environment variables to pass to MCP servers
     * @param allowedTools the action type's allowed tools list (may be empty)
     * @return path to the generated MCP config, or null if not applicable
     */
    Path configureMcpServers(Long taskId, Map<String, String> environment,
                              List<String> allowedTools);

    /**
     * Cleans up MCP configuration after task completion. Implementations
     * may delete temp files, deregister servers, etc.
     *
     * @param taskId the task ID whose MCP config should be cleaned up
     */
    default void cleanup(Long taskId) {
        // Default no-op — not all engines need cleanup
    }
}
