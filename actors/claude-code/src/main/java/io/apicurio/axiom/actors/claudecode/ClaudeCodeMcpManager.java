package io.apicurio.axiom.actors.claudecode;

import io.apicurio.axiom.engine.spi.AiEngineMcpManager;
import io.apicurio.axiom.engine.spi.AiEngineType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * Claude Code implementation of {@link AiEngineMcpManager}. Delegates to the
 * existing {@link io.apicurio.axiom.app.McpConfigGenerator} to produce
 * {@code --mcp-config} JSON files for Claude Code subprocesses.
 *
 * <p>Note: This is a thin adapter. The actual MCP config generation logic
 * remains in {@code McpConfigGenerator} (in the app module) and is injected
 * here. This class exists to satisfy the engine SPI contract so that
 * consumers can use {@link AiEngineMcpManager} without coupling to
 * Claude-specific code.</p>
 */
@ApplicationScoped
@AiEngineType("claude-code")
public class ClaudeCodeMcpManager implements AiEngineMcpManager {

    /**
     * Functional interface for the MCP config generation, allowing the app module's
     * McpConfigGenerator to be injected without creating a circular dependency.
     */
    @FunctionalInterface
    public interface McpConfigDelegate {
        Path generateMcpConfig(Long taskId, Map<String, String> environment,
                               List<String> allowedTools);
    }

    private volatile McpConfigDelegate delegate;

    /**
     * Sets the delegate that performs the actual MCP config generation.
     * Called by the app module during initialization.
     *
     * @param delegate the MCP config generation delegate
     */
    public void setDelegate(McpConfigDelegate delegate) {
        this.delegate = delegate;
    }

    @Override
    public Path configureMcpServers(Long taskId, Map<String, String> environment,
                                     List<String> allowedTools) {
        if (delegate != null) {
            return delegate.generateMcpConfig(taskId, environment, allowedTools);
        }
        return null;
    }
}
