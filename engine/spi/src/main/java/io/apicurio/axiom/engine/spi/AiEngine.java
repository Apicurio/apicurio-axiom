package io.apicurio.axiom.engine.spi;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * SPI interface for pluggable AI engine implementations. Each implementation
 * (Claude Code, OpenCode, etc.) provides a CDI bean annotated with
 * {@link AiEngineType} that handles the engine-specific invocation details.
 *
 * <p>This interface is used by the Manager, ScriptAiService, ToolAiService,
 * and ReportExecutionService to invoke AI without coupling to a specific engine.</p>
 */
public interface AiEngine {

    /**
     * Returns the engine type identifier (e.g. "claude-code", "opencode").
     *
     * @return the engine type string
     */
    String getType();

    /**
     * Sends a prompt to the AI engine and returns the result asynchronously.
     *
     * @param config engine-agnostic configuration (model, tools, timeout, etc.)
     * @param prompt the user prompt text
     * @return a future that completes with the AI result
     */
    CompletableFuture<AiEngineResult> prompt(AiEngineConfig config, String prompt);

    /**
     * Sends a prompt with a JSON schema constraint, requesting structured output.
     * The engine enforces that the response conforms to the given JSON schema.
     *
     * @param config     engine-agnostic configuration
     * @param prompt     the user prompt text
     * @param jsonSchema the JSON schema that the response must conform to
     * @return a future that completes with the structured AI result
     */
    CompletableFuture<AiEngineResult> promptWithSchema(AiEngineConfig config, String prompt,
                                                        String jsonSchema);

    /**
     * Performs engine-specific startup health checks.
     *
     * @return a list of check results (name, status, message)
     */
    List<AiEngineCheckResult> healthCheck();

    /**
     * Returns the actor type identifier that this engine's Actor implementation
     * uses. This is used by TaskExecutionService to map entity actor types
     * (e.g. "ai-agent") to the correct Actor CDI bean.
     *
     * @return the actor implementation type (e.g. "claude-code", "opencode")
     */
    default String getActorType() {
        return getType();
    }
}
