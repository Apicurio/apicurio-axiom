package io.apicurio.axiom.actors.claudecode;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jboss.logging.Logger;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Manages a Claude Code CLI subprocess. Handles launching the process,
 * reading NDJSON streaming output, parsing the final result, and
 * enforcing timeouts.
 */
public class ClaudeCodeSubprocess {

    private static final Logger LOG = Logger.getLogger(ClaudeCodeSubprocess.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final List<String> command;
    private final java.io.File workingDirectory;
    private final Map<String, String> environment;
    private final Duration timeout;
    private final Consumer<String> streamListener;

    private Process process;

    /**
     * Creates a new subprocess wrapper.
     *
     * @param command the command line arguments
     * @param workingDirectory the working directory for the process (may be null)
     * @param environment additional environment variables
     * @param timeout maximum execution duration
     * @param streamListener callback for streaming output lines (may be null)
     */
    public ClaudeCodeSubprocess(List<String> command, java.io.File workingDirectory,
                                 Map<String, String> environment,
                                 Duration timeout, Consumer<String> streamListener) {
        this.command = command;
        this.workingDirectory = workingDirectory;
        this.environment = environment;
        this.timeout = timeout;
        this.streamListener = streamListener;
    }

    /**
     * Launches the subprocess and returns a future that completes with the result.
     *
     * @return a future containing the parsed Claude Code result
     */
    public CompletableFuture<ClaudeCodeResult> execute() {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return doExecute();
            } catch (Exception e) {
                LOG.errorf(e, "Claude Code subprocess failed");
                return ClaudeCodeResult.failed("Subprocess error: " + e.getMessage(), -1);
            }
        });
    }

    /**
     * Kills the running subprocess, if any.
     */
    public void kill() {
        if (process != null && process.isAlive()) {
            LOG.warn("Killing Claude Code subprocess");
            process.destroyForcibly();
        }
    }

    private ClaudeCodeResult doExecute() throws IOException, InterruptedException {
        LOG.infof("Launching Claude Code: %s", String.join(" ",
                command.subList(0, Math.min(command.size(), 5))) + "...");
        // Log tool-related flags for debugging
        for (int i = 0; i < command.size(); i++) {
            String arg = command.get(i);
            if ("--tools".equals(arg) || "--allowedTools".equals(arg)
                    || "--disallowedTools".equals(arg) || "--permission-mode".equals(arg)) {
                String value = (i + 1 < command.size()) ? command.get(i + 1) : "?";
                LOG.infof("  [cmd] %s %s", arg, value);
            }
        }

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(false);
        pb.redirectInput(ProcessBuilder.Redirect.from(new java.io.File("/dev/null")));

        if (workingDirectory != null) {
            pb.directory(workingDirectory);
        }

        if (environment != null) {
            pb.environment().putAll(environment);
        }

        process = pb.start();

        // Read stdout (NDJSON lines or final JSON)
        StringBuilder lastResultLine = new StringBuilder();
        StringBuilder stderrContent = new StringBuilder();

        // Read stdout in a thread — parse NDJSON for diagnostic logging
        CompletableFuture<Void> stdoutFuture = CompletableFuture.runAsync(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    lastResultLine.setLength(0);
                    lastResultLine.append(line);

                    if (streamListener != null) {
                        streamListener.accept(line);
                    }

                    // Parse NDJSON for diagnostic logging
                    logStreamEvent(line);
                }
            } catch (IOException e) {
                LOG.warnf("Error reading Claude Code stdout: %s", e.getMessage());
            }
        });

        // Read stderr in a thread
        CompletableFuture<Void> stderrFuture = CompletableFuture.runAsync(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stderrContent.append(line).append("\n");
                    LOG.debugf("Claude Code stderr: %s", line);
                }
            } catch (IOException e) {
                LOG.warnf("Error reading Claude Code stderr: %s", e.getMessage());
            }
        });

        // Wait for process with timeout
        boolean completed = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
        if (!completed) {
            LOG.warnf("Claude Code subprocess timed out after %s", timeout);
            process.destroyForcibly();
            process.waitFor(5, TimeUnit.SECONDS);
            return ClaudeCodeResult.failed("Process timed out after " + timeout, 124);
        }

        // Wait for stream readers to finish
        stdoutFuture.join();
        stderrFuture.join();

        int exitCode = process.exitValue();
        LOG.infof("Claude Code subprocess exited with code %d", exitCode);

        if (exitCode != 0) {
            String error = stderrContent.toString().trim();
            if (error.isEmpty()) {
                error = "Process exited with code " + exitCode;
            }
            return ClaudeCodeResult.failed(error, exitCode);
        }

        // Parse the final result line
        return parseResult(lastResultLine.toString(), exitCode);
    }

    /**
     * Parses the final JSON output from Claude Code.
     */
    private ClaudeCodeResult parseResult(String jsonLine, int exitCode) {
        if (jsonLine == null || jsonLine.isEmpty()) {
            return ClaudeCodeResult.failed("No output from Claude Code", exitCode);
        }

        try {
            JsonNode root = MAPPER.readTree(jsonLine);

            // When --json-schema is used, the structured output may be in
            // "structured_output" as a parsed object, or in "result" as a string
            String result;
            JsonNode structuredOutput = root.path("structured_output");
            if (!structuredOutput.isMissingNode() && !structuredOutput.isNull()) {
                result = MAPPER.writeValueAsString(structuredOutput);
            } else {
                result = root.path("result").asText(null);
            }
            String sessionId = root.path("session_id").asText(null);

            Double costUsd = null;
            if (root.has("total_cost_usd")) {
                costUsd = root.get("total_cost_usd").asDouble();
            }

            Long inputTokens = null;
            Long outputTokens = null;
            JsonNode usage = root.path("usage");
            if (!usage.isMissingNode()) {
                if (usage.has("input_tokens")) {
                    inputTokens = usage.get("input_tokens").asLong();
                }
                if (usage.has("output_tokens")) {
                    outputTokens = usage.get("output_tokens").asLong();
                }
            }

            return new ClaudeCodeResult(result, sessionId, costUsd, inputTokens,
                    outputTokens, exitCode);
        } catch (Exception e) {
            LOG.warnf(e, "Failed to parse Claude Code output as JSON: %s",
                    jsonLine.substring(0, Math.min(jsonLine.length(), 200)));
            // Fall back to treating the raw output as the result text
            return new ClaudeCodeResult(jsonLine, null, null, null, null, exitCode);
        }
    }

    /**
     * Parses a stream-json NDJSON line and logs meaningful diagnostic information.
     * This helps trace what Claude Code is doing during execution.
     */
    private void logStreamEvent(String line) {
        try {
            JsonNode node = MAPPER.readTree(line);
            String type = node.path("type").asText("");

            switch (type) {
                case "assistant" -> {
                    // Assistant message — check for tool use
                    JsonNode content = node.path("message").path("content");
                    if (content.isArray()) {
                        for (JsonNode block : content) {
                            String blockType = block.path("type").asText("");
                            if ("tool_use".equals(blockType)) {
                                String toolName = block.path("name").asText("?");
                                String input = block.path("input").toString();
                                String inputPreview = input.length() > 150
                                        ? input.substring(0, 147) + "..."
                                        : input;
                                LOG.infof("  [claude] Tool call: %s — %s", toolName, inputPreview);
                            } else if ("text".equals(blockType)) {
                                String text = block.path("text").asText("");
                                if (!text.isBlank()) {
                                    String preview = text.length() > 120
                                            ? text.substring(0, 117) + "..."
                                            : text;
                                    LOG.debugf("  [claude] Text: %s", preview);
                                }
                            }
                        }
                    }
                }
                case "result" -> {
                    String subtype = node.path("subtype").asText("");
                    double cost = node.path("total_cost_usd").asDouble(0);
                    int turns = node.path("num_turns").asInt(0);
                    long durationMs = node.path("duration_ms").asLong(0);
                    LOG.infof("  [claude] Result: %s (turns=%d, cost=$%.4f, duration=%dms)",
                            subtype, turns, cost, durationMs);
                }
                case "tool_result" -> {
                    String toolName = node.path("name").asText("");
                    boolean isError = node.path("is_error").asBoolean(false);
                    if (isError) {
                        String errorContent = node.path("content").asText(
                                node.path("content").toString());
                        String errorPreview = errorContent.length() > 200
                                ? errorContent.substring(0, 197) + "..."
                                : errorContent;
                        LOG.warnf("  [claude] Tool failed: %s — %s", toolName, errorPreview);
                    } else {
                        LOG.infof("  [claude] Tool completed: %s", toolName);
                    }
                }
                default -> LOG.tracef("  [claude] Stream event type: %s", type);
            }
        } catch (Exception e) {
            // Not JSON or unparseable — log raw at trace
            LOG.tracef("  [claude] Raw: %s",
                    line.substring(0, Math.min(line.length(), 200)));
        }
    }
}
