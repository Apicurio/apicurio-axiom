package io.apicurio.axiom.actors.claudecode;

import io.apicurio.axiom.actors.spi.ActorContext;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Builds the command line for launching a Claude Code CLI subprocess.
 */
public class ClaudeCodeCommandBuilder {

    private String prompt;
    private Path workingDirectory;
    private String model;
    private List<String> allowedTools = List.of();
    private List<String> disallowedTools = List.of();
    private String systemPrompt;
    private Integer maxTurns;
    private Double maxBudgetUsd;
    private String sessionId;
    private Path mcpConfigFile;
    private boolean bare = true;
    private boolean streamJson = true;

    /**
     * Creates a builder from an ActorContext and prompt.
     *
     * @param prompt the prompt to send to Claude Code
     * @param context the actor context
     * @return a pre-configured builder
     */
    public static ClaudeCodeCommandBuilder fromContext(String prompt, ActorContext context) {
        ClaudeCodeCommandBuilder builder = new ClaudeCodeCommandBuilder();
        builder.prompt = prompt;
        builder.workingDirectory = context.getWorkingDirectory();
        builder.allowedTools = context.getAllowedTools();
        builder.disallowedTools = context.getDisallowedTools();
        builder.systemPrompt = context.getSystemPrompt();
        return builder;
    }

    public ClaudeCodeCommandBuilder model(String model) {
        this.model = model;
        return this;
    }

    public ClaudeCodeCommandBuilder maxTurns(Integer maxTurns) {
        this.maxTurns = maxTurns;
        return this;
    }

    public ClaudeCodeCommandBuilder maxBudgetUsd(Double maxBudgetUsd) {
        this.maxBudgetUsd = maxBudgetUsd;
        return this;
    }

    public ClaudeCodeCommandBuilder sessionId(String sessionId) {
        this.sessionId = sessionId;
        return this;
    }

    public ClaudeCodeCommandBuilder mcpConfigFile(Path mcpConfigFile) {
        this.mcpConfigFile = mcpConfigFile;
        return this;
    }

    public ClaudeCodeCommandBuilder bare(boolean bare) {
        this.bare = bare;
        return this;
    }

    public ClaudeCodeCommandBuilder streamJson(boolean streamJson) {
        this.streamJson = streamJson;
        return this;
    }

    /**
     * Builds the command line as a list of strings suitable for ProcessBuilder.
     *
     * @return the command line arguments
     */
    public List<String> build() {
        List<String> cmd = new ArrayList<>();
        cmd.add("claude");
        cmd.add("-p");
        cmd.add(prompt);

        if (bare) {
            cmd.add("--bare");
        }

        if (streamJson) {
            cmd.add("--output-format");
            cmd.add("stream-json");
        } else {
            cmd.add("--output-format");
            cmd.add("json");
        }

        if (workingDirectory != null) {
            cmd.add("--cwd");
            cmd.add(workingDirectory.toAbsolutePath().toString());
        }

        if (model != null) {
            cmd.add("--model");
            cmd.add(model);
        }

        if (allowedTools != null && !allowedTools.isEmpty()) {
            cmd.add("--allowedTools");
            cmd.addAll(allowedTools);
        }

        if (disallowedTools != null && !disallowedTools.isEmpty()) {
            cmd.add("--disallowedTools");
            cmd.addAll(disallowedTools);
        }

        if (systemPrompt != null) {
            cmd.add("--append-system-prompt");
            cmd.add(systemPrompt);
        }

        cmd.add("--permission-mode");
        cmd.add("acceptEdits");

        if (maxTurns != null) {
            cmd.add("--max-turns");
            cmd.add(maxTurns.toString());
        }

        if (maxBudgetUsd != null) {
            cmd.add("--max-budget-usd");
            cmd.add(maxBudgetUsd.toString());
        }

        if (sessionId != null) {
            cmd.add("--session-id");
            cmd.add(sessionId);
        }

        if (mcpConfigFile != null) {
            cmd.add("--mcp-config");
            cmd.add(mcpConfigFile.toAbsolutePath().toString());
        }

        return cmd;
    }
}
