package io.apicurio.axiom.actors.claudecode;

import io.apicurio.axiom.actors.spi.Actor;
import io.apicurio.axiom.actors.spi.ActorContext;
import io.apicurio.axiom.actors.spi.TaskResult;
import io.apicurio.axiom.core.entities.TaskEntity;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Actor implementation that executes tasks by launching Claude Code as a CLI
 * subprocess. Each task gets its own subprocess, scoped to the project's
 * working directory.
 */
@ApplicationScoped
public class ClaudeCodeActor implements Actor {

    private static final Logger LOG = Logger.getLogger(ClaudeCodeActor.class);

    @ConfigProperty(name = "axiom.claude-code.model")
    Optional<String> model;

    @ConfigProperty(name = "axiom.claude-code.max-turns", defaultValue = "50")
    int maxTurns;

    @ConfigProperty(name = "axiom.claude-code.max-budget-usd", defaultValue = "5.0")
    double maxBudgetUsd;

    @ConfigProperty(name = "axiom.claude-code.timeout-seconds", defaultValue = "600")
    int timeoutSeconds;

    private final Map<Long, ClaudeCodeSubprocess> runningProcesses = new ConcurrentHashMap<>();

    /**
     * {@inheritDoc}
     */
    @Override
    public String getType() {
        return "claude-code";
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CompletableFuture<TaskResult> execute(TaskEntity task, ActorContext context) {
        LOG.infof("Executing task %d (action: %s) via Claude Code", task.id, task.actionType);

        String prompt = buildPrompt(task);
        String sessionId = "axiom-task-" + task.id;

        ClaudeCodeCommandBuilder cmdBuilder = ClaudeCodeCommandBuilder
                .fromContext(prompt, context)
                .sessionId(sessionId)
                .maxTurns(maxTurns)
                .maxBudgetUsd(maxBudgetUsd);

        model.ifPresent(cmdBuilder::model);

        List<String> command = cmdBuilder.build();

        ClaudeCodeSubprocess subprocess = new ClaudeCodeSubprocess(
                command,
                context.getEnvironment() != null ? context.getEnvironment() : Map.of(),
                Duration.ofSeconds(timeoutSeconds),
                line -> LOG.tracef("Task %d stream: %s", task.id, line)
        );

        runningProcesses.put(task.id, subprocess);

        return subprocess.execute()
                .thenApply(result -> {
                    runningProcesses.remove(task.id);
                    return toTaskResult(result);
                })
                .exceptionally(throwable -> {
                    runningProcesses.remove(task.id);
                    LOG.errorf(throwable, "Task %d execution failed", task.id);
                    return TaskResult.failure("Execution error: " + throwable.getMessage()).build();
                });
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void cancel(TaskEntity task) {
        ClaudeCodeSubprocess subprocess = runningProcesses.remove(task.id);
        if (subprocess != null) {
            LOG.infof("Cancelling task %d", task.id);
            subprocess.kill();
        }
    }

    /**
     * Builds the prompt for Claude Code from the task's action type and input.
     */
    private String buildPrompt(TaskEntity task) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("You are performing the following action: ").append(task.actionType).append("\n\n");

        if (task.input != null && !task.input.isEmpty()) {
            prompt.append("Task context:\n").append(task.input).append("\n");
        }

        return prompt.toString();
    }

    private TaskResult toTaskResult(ClaudeCodeResult result) {
        if (result.isSuccess()) {
            return TaskResult.success(result.result())
                    .sessionId(result.sessionId())
                    .costUsd(result.totalCostUsd())
                    .inputTokens(result.inputTokens())
                    .outputTokens(result.outputTokens())
                    .build();
        } else {
            return TaskResult.failure(result.result())
                    .sessionId(result.sessionId())
                    .costUsd(result.totalCostUsd())
                    .inputTokens(result.inputTokens())
                    .outputTokens(result.outputTokens())
                    .build();
        }
    }
}
