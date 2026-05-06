package io.apicurio.axiom.engine.opencode;

import io.apicurio.axiom.engine.spi.AiEngineMcpManager;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * OpenCode implementation of {@link AiEngineMcpManager}. Registers MCP servers
 * dynamically via the OpenCode server's HTTP API ({@code POST /mcp}).
 *
 * <p>Unlike the Claude Code approach (which generates per-task config files),
 * OpenCode manages MCP servers as part of its server-level configuration.
 * Servers registered here persist for the lifetime of the OpenCode server process.</p>
 */
@ApplicationScoped
@Typed(OpenCodeMcpManager.class)
public class OpenCodeMcpManager implements AiEngineMcpManager {

    private static final Logger LOG = Logger.getLogger(OpenCodeMcpManager.class);

    @Inject
    OpenCodeEngine engine;

    @Override
    public Path configureMcpServers(Long taskId, Map<String, String> environment,
                                     List<String> allowedTools) {
        // OpenCode manages MCP servers via its HTTP API, not config files.
        // For now, we log the intent. Full MCP registration is planned for Phase 4.
        if (allowedTools != null && !allowedTools.isEmpty()) {
            long mcpToolCount = allowedTools.stream()
                    .filter(t -> t.startsWith("mcp__") || t.startsWith("mcp_"))
                    .count();
            if (mcpToolCount > 0) {
                LOG.infof("Task %d has %d MCP tools in allowed list (OpenCode MCP registration pending)",
                        taskId, mcpToolCount);
            }
        }

        // No config file needed — OpenCode doesn't use --mcp-config
        return null;
    }

    @Override
    public void cleanup(Long taskId) {
        // No per-task cleanup needed — MCP servers are server-level in OpenCode
    }
}
