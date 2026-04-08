package io.apicurio.axiom.actors.spi;

import io.apicurio.axiom.core.entities.TaskEntity;

import java.util.concurrent.CompletableFuture;

/**
 * SPI interface for task execution actors. Implementations handle the actual
 * work of performing a task — either by dispatching to an AI agent subprocess
 * or by notifying a human.
 */
public interface Actor {

    /**
     * Returns the actor type identifier (e.g. "claude-code", "human").
     *
     * @return the actor type string
     */
    String getType();

    /**
     * Executes a task asynchronously. The actor should:
     * <ol>
     *   <li>Perform the work described by the task and context</li>
     *   <li>Return a TaskResult with the output, cost, and status</li>
     * </ol>
     *
     * @param task the task entity to execute
     * @param context the execution context (working directory, tools, prompts)
     * @return a future that completes with the task result
     */
    CompletableFuture<TaskResult> execute(TaskEntity task, ActorContext context);

    /**
     * Cancels a running task, if possible.
     *
     * @param task the task entity to cancel
     */
    void cancel(TaskEntity task);
}
