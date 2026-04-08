package io.apicurio.axiom.actors.spi;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * Context provided to an Actor when executing a task. Contains all the
 * information the actor needs to perform its work.
 */
public class ActorContext {

    private final Path workingDirectory;
    private final List<String> allowedTools;
    private final List<String> disallowedTools;
    private final String systemPrompt;
    private final Map<String, String> environment;

    private ActorContext(Builder builder) {
        this.workingDirectory = builder.workingDirectory;
        this.allowedTools = builder.allowedTools;
        this.disallowedTools = builder.disallowedTools;
        this.systemPrompt = builder.systemPrompt;
        this.environment = builder.environment;
    }

    /**
     * @return the project's git clone directory
     */
    public Path getWorkingDirectory() {
        return workingDirectory;
    }

    /**
     * @return the effective set of tools the actor is allowed to use
     */
    public List<String> getAllowedTools() {
        return allowedTools;
    }

    /**
     * @return tools that are explicitly blocked
     */
    public List<String> getDisallowedTools() {
        return disallowedTools;
    }

    /**
     * @return additional system prompt instructions for the task
     */
    public String getSystemPrompt() {
        return systemPrompt;
    }

    /**
     * @return additional environment variables for the subprocess
     */
    public Map<String, String> getEnvironment() {
        return environment;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Path workingDirectory;
        private List<String> allowedTools = List.of();
        private List<String> disallowedTools = List.of();
        private String systemPrompt;
        private Map<String, String> environment = Map.of();

        public Builder workingDirectory(Path workingDirectory) {
            this.workingDirectory = workingDirectory;
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

        public Builder systemPrompt(String systemPrompt) {
            this.systemPrompt = systemPrompt;
            return this;
        }

        public Builder environment(Map<String, String> environment) {
            this.environment = environment;
            return this;
        }

        public ActorContext build() {
            return new ActorContext(this);
        }
    }
}
