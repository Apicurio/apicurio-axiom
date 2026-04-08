package io.apicurio.axiom.app;

import io.apicurio.axiom.actors.spi.Actor;
import io.apicurio.axiom.actors.spi.ActorContext;
import io.apicurio.axiom.actors.spi.TaskResult;
import io.apicurio.axiom.core.entities.ActionTypeEntity;
import io.apicurio.axiom.core.entities.ActivityLogEntity;
import io.apicurio.axiom.core.entities.ActorEntity;
import io.apicurio.axiom.core.entities.EventEntity;
import io.apicurio.axiom.core.entities.EventQueueEntity;
import io.apicurio.axiom.core.entities.ProjectEntity;
import io.apicurio.axiom.core.entities.TaskEntity;
import io.apicurio.axiom.core.entities.ThreadEntryEntity;
import io.apicurio.axiom.core.services.WorkspaceService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

/**
 * Orchestrates task execution. Resolves the appropriate Actor implementation,
 * enforces project-level task serialization, manages the task lifecycle, and
 * records results.
 */
@ApplicationScoped
public class TaskExecutionService {

    private static final Logger LOG = Logger.getLogger(TaskExecutionService.class);

    @Inject
    Instance<Actor> actors;

    @Inject
    WorkspaceService workspaceService;

    /**
     * Attempts to execute the next pending task for the given project.
     * Does nothing if there is already an active task for the project.
     *
     * @param projectId the project to check for pending tasks
     */
    public void executeNextTask(Long projectId) {
        // Check for active tasks (serialization enforcement)
        long activeTasks = TaskEntity.count(
                "projectId = ?1 and (status = 'InProgress' or status = 'AwaitingInput')",
                projectId);
        if (activeTasks > 0) {
            LOG.debugf("Project %d has an active task, skipping", projectId);
            return;
        }

        // Find the next pending task
        TaskEntity task = TaskEntity.find(
                "projectId = ?1 and status = 'Pending' order by createdOn asc",
                projectId).firstResult();
        if (task == null) {
            return;
        }

        executeTask(task);
    }

    /**
     * Executes a specific task.
     *
     * @param task the task to execute
     */
    public void executeTask(TaskEntity task) {
        // Find the actor implementation
        Actor actor = resolveActor(task);
        if (actor == null) {
            failTask(task.id, "No actor available for task type: " + task.actionType);
            return;
        }

        // Mark task as in progress
        markTaskInProgress(task.id);

        // Build the actor context
        ProjectEntity project = ProjectEntity.findById(task.projectId);
        Path workspace = workspaceService.getWorkspacePath(project);
        ActorContext context = ActorContext.builder()
                .workingDirectory(workspace)
                .systemPrompt(buildSystemPrompt(task, project))
                .build();

        // Execute asynchronously
        actor.execute(task, context)
                .thenAccept(result -> onTaskCompleted(task.id, result))
                .exceptionally(throwable -> {
                    LOG.errorf(throwable, "Task %d execution failed unexpectedly", task.id);
                    failTask(task.id, "Unexpected error: " + throwable.getMessage());
                    return null;
                });
    }

    /**
     * Resolves the Actor implementation for a task.
     */
    private Actor resolveActor(TaskEntity task) {
        // If an actor is explicitly assigned, find its type
        if (task.assignedActor != null) {
            ActorEntity actorEntity = ActorEntity.findById(task.assignedActor);
            if (actorEntity != null) {
                return findActorByType(actorEntity.type);
            }
        }

        // Default to the first available AI agent actor
        for (Actor actor : actors) {
            if ("claude-code".equals(actor.getType())) {
                return actor;
            }
        }

        // Fall back to any available actor
        return actors.stream().findFirst().orElse(null);
    }

    private Actor findActorByType(String type) {
        for (Actor actor : actors) {
            if (actor.getType().equals(type)) {
                return actor;
            }
        }
        return null;
    }

    private String buildSystemPrompt(TaskEntity task, ProjectEntity project) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are working on project: ").append(project.name).append("\n");
        sb.append("Issue: ").append(project.issueRef).append("\n");
        sb.append("Action type: ").append(task.actionType).append("\n");
        if (project.description != null) {
            sb.append("Project description: ").append(project.description).append("\n");
        }
        return sb.toString();
    }

    @Transactional
    void markTaskInProgress(Long taskId) {
        TaskEntity task = TaskEntity.findById(taskId);
        if (task != null) {
            task.status = "InProgress";

            // Update project status
            ProjectEntity project = ProjectEntity.findById(task.projectId);
            if (project != null) {
                project.status = "InProgress";
                project.updatedOn = Instant.now();
            }

            // Log to activity
            logActivity(task.projectId, taskId, "task-started",
                    "Task started: " + task.actionType);

            // Log to thread
            addThreadEntry(task.projectId, "system", "update",
                    "Task started: " + task.actionType);
        }
    }

    @Transactional
    void onTaskCompleted(Long taskId, TaskResult result) {
        TaskEntity task = TaskEntity.findById(taskId);
        if (task == null) {
            return;
        }

        task.status = result.isSuccess() ? "Completed" : "Failed";
        task.output = result.getOutput();
        task.completedOn = Instant.now();
        task.sessionId = result.getSessionId();
        task.costUsd = result.getCostUsd();
        task.inputTokens = result.getInputTokens();
        task.outputTokens = result.getOutputTokens();

        String statusText = result.isSuccess() ? "completed" : "failed";
        LOG.infof("Task %d %s (cost: $%s, tokens: %d/%d)",
                taskId, statusText,
                result.getCostUsd() != null ? String.format("%.4f", result.getCostUsd()) : "n/a",
                result.getInputTokens() != null ? result.getInputTokens() : 0,
                result.getOutputTokens() != null ? result.getOutputTokens() : 0);

        // Log to activity
        logActivity(task.projectId, taskId, "task-" + statusText,
                "Task " + statusText + ": " + task.actionType);

        // Log to thread
        String threadContent = "Task " + statusText + ": " + task.actionType;
        if (result.getOutput() != null && !result.getOutput().isEmpty()) {
            threadContent += "\n\nResult:\n" + result.getOutput();
        }
        if (result.getErrorMessage() != null) {
            threadContent += "\n\nError: " + result.getErrorMessage();
        }
        addThreadEntry(task.projectId, "system", "result", threadContent);

        // Update project status back to Idle if no more active tasks
        updateProjectStatusAfterTask(task.projectId);

        // Emit internal event if configured
        emitInternalEventIfNeeded(task);
    }

    @Transactional
    void failTask(Long taskId, String reason) {
        TaskEntity task = TaskEntity.findById(taskId);
        if (task != null) {
            task.status = "Failed";
            task.output = reason;
            task.completedOn = Instant.now();

            logActivity(task.projectId, taskId, "task-failed",
                    "Task failed: " + task.actionType + " — " + reason);
            addThreadEntry(task.projectId, "system", "result",
                    "Task failed: " + task.actionType + "\n\nError: " + reason);

            updateProjectStatusAfterTask(task.projectId);
        }
    }

    private void updateProjectStatusAfterTask(Long projectId) {
        long activeTasks = TaskEntity.count(
                "projectId = ?1 and (status = 'InProgress' or status = 'AwaitingInput')",
                projectId);
        long pendingTasks = TaskEntity.count(
                "projectId = ?1 and status = 'Pending'", projectId);

        if (activeTasks == 0) {
            ProjectEntity project = ProjectEntity.findById(projectId);
            if (project != null && "InProgress".equals(project.status)) {
                project.status = "Idle";
                project.updatedOn = Instant.now();
            }

            // If there are pending tasks, trigger the next one
            if (pendingTasks > 0) {
                executeNextTask(projectId);
            }
        }
    }

    private void emitInternalEventIfNeeded(TaskEntity task) {
        ActionTypeEntity actionType = ActionTypeEntity.find("name", task.actionType).firstResult();
        if (actionType != null && actionType.emitsEvent) {
            EventEntity event = new EventEntity();
            event.source = "internal";
            event.eventType = task.status.equals("Completed") ? "task-completed" : "task-failed";
            event.projectId = task.projectId;
            event.taskId = task.id;
            event.payload = task.output != null ? task.output : "";
            event.receivedAt = Instant.now();
            event.persist();

            EventQueueEntity queueEntry = new EventQueueEntity();
            queueEntry.eventId = event.id;
            queueEntry.status = "pending";
            queueEntry.enqueuedAt = Instant.now();
            queueEntry.persist();

            LOG.infof("Emitted internal %s event for task %d", event.eventType, task.id);
        }
    }

    private void logActivity(Long projectId, Long taskId, String entryType, String summary) {
        ActivityLogEntity log = new ActivityLogEntity();
        log.projectId = projectId;
        log.taskId = taskId;
        log.entryType = entryType;
        log.summary = summary;
        log.createdOn = Instant.now();
        log.persist();
    }

    private void addThreadEntry(Long projectId, String authorType, String entryType,
                                String content) {
        ThreadEntryEntity entry = new ThreadEntryEntity();
        entry.projectId = projectId;
        entry.authorType = authorType;
        entry.entryType = entryType;
        entry.content = content;
        entry.createdOn = Instant.now();
        entry.persist();
    }
}
