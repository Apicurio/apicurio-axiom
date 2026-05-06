package io.apicurio.axiom.engine.spi;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * Engine-agnostic configuration for an AI invocation. Bundles all parameters
 * that callers need to specify, regardless of which engine executes the request.
 * Engine implementations translate this to their specific CLI flags, HTTP
 * request bodies, or agent configuration files.
 */
public class AiEngineConfig {

    private final String model;
    private final String systemPrompt;
    private final List<String> allowedTools;
    private final List<String> disallowedTools;
    private final Path workingDirectory;
    private final Map<String, String> environment;
    private final int timeoutSeconds;
    private final int maxSteps;
    private final Double maxBudgetUsd;
    private final String sessionId;
    private final Path mcpConfigFile;

    private AiEngineConfig(Builder builder) {
        this.model = builder.model;
        this.systemPrompt = builder.systemPrompt;
        this.allowedTools = builder.allowedTools;
        this.disallowedTools = builder.disallowedTools;
        this.workingDirectory = builder.workingDirectory;
        this.environment = builder.environment;
        this.timeoutSeconds = builder.timeoutSeconds;
        this.maxSteps = builder.maxSteps;
        this.maxBudgetUsd = builder.maxBudgetUsd;
        this.sessionId = builder.sessionId;
        this.mcpConfigFile = builder.mcpConfigFile;
    }

    /** @return the AI model identifier, or null to use the engine's default */
    public String getModel() {
        return model;
    }

    /** @return additional system prompt instructions */
    public String getSystemPrompt() {
        return systemPrompt;
    }

    /** @return the set of tools the AI is allowed to use */
    public List<String> getAllowedTools() {
        return allowedTools;
    }

    /** @return tools that are explicitly blocked */
    public List<String> getDisallowedTools() {
        return disallowedTools;
    }

    /** @return the working directory for the AI agent, or null */
    public Path getWorkingDirectory() {
        return workingDirectory;
    }

    /** @return additional environment variables for the AI process */
    public Map<String, String> getEnvironment() {
        return environment;
    }

    /** @return timeout in seconds for the AI invocation */
    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    /** @return maximum number of agent steps/turns */
    public int getMaxSteps() {
        return maxSteps;
    }

    /** @return maximum budget in USD, or null for no limit */
    public Double getMaxBudgetUsd() {
        return maxBudgetUsd;
    }

    /** @return engine-specific session ID for resumption, or null */
    public String getSessionId() {
        return sessionId;
    }

    /** @return path to the MCP config file, or null if no MCP tools are configured */
    public Path getMcpConfigFile() {
        return mcpConfigFile;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String model;
        private String systemPrompt;
        private List<String> allowedTools = List.of();
        private List<String> disallowedTools = List.of();
        private Path workingDirectory;
        private Map<String, String> environment = Map.of();
        private int timeoutSeconds = 120;
        private int maxSteps = 50;
        private Double maxBudgetUsd;
        private String sessionId;
        private Path mcpConfigFile;

        public Builder model(String model) {
            this.model = model;
            return this;
        }

        public Builder systemPrompt(String systemPrompt) {
            this.systemPrompt = systemPrompt;
            return this;
        }

        public Builder allowedTools(List<String> allowedTools) {
            this.allowedTools = allowedTools;
            return this;
        }

        public Builder disallowedTools(List<String> disallowedTools) {
            this.disallowedTools = disallowedTools;
            return this;
        }

        public Builder workingDirectory(Path workingDirectory) {
            this.workingDirectory = workingDirectory;
            return this;
        }

        public Builder environment(Map<String, String> environment) {
            this.environment = environment;
            return this;
        }

        public Builder timeoutSeconds(int timeoutSeconds) {
            this.timeoutSeconds = timeoutSeconds;
            return this;
        }

        public Builder maxSteps(int maxSteps) {
            this.maxSteps = maxSteps;
            return this;
        }

        public Builder maxBudgetUsd(Double maxBudgetUsd) {
            this.maxBudgetUsd = maxBudgetUsd;
            return this;
        }

        public Builder sessionId(String sessionId) {
            this.sessionId = sessionId;
            return this;
        }

        public Builder mcpConfigFile(Path mcpConfigFile) {
            this.mcpConfigFile = mcpConfigFile;
            return this;
        }

        public AiEngineConfig build() {
            return new AiEngineConfig(this);
        }
    }
}
