package io.apicurio.axiom.app;

import io.apicurio.axiom.actors.spi.Actor;
import io.apicurio.axiom.actors.spi.ActorContext;
import io.apicurio.axiom.actors.spi.TaskResult;
import io.apicurio.axiom.core.entities.ActionTypeEntity;
import io.apicurio.axiom.core.entities.AiUsageEntity;
import io.apicurio.axiom.core.entities.ActivityLogEntity;
import io.apicurio.axiom.core.entities.ActorEntity;
import io.apicurio.axiom.core.entities.EventEntity;
import io.apicurio.axiom.core.entities.EventQueueEntity;
import io.apicurio.axiom.core.entities.ProjectEntity;
import io.apicurio.axiom.core.entities.TaskEntity;
import io.apicurio.axiom.core.entities.ThreadEntryEntity;
import io.apicurio.axiom.core.events.SseEvent;
import io.apicurio.axiom.core.services.ToolsetResolver;
import io.apicurio.axiom.core.services.WorkspaceService;
import io.apicurio.axiom.engine.spi.AiEngine;
import io.apicurio.axiom.engine.spi.AiEngineMcpManager;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
    AiEngine aiEngine;

    @Inject
    AiEngineMcpManager mcpManager;

    @Inject
    WorkspaceService workspaceService;

    @Inject
    ToolsetResolver toolsetResolver;

    @Inject
    Event<SseEvent> sseEvents;

    @Inject
    ScriptExecutionService scriptExecutionService;

    @ConfigProperty(name = "axiom.github.token")
    Optional<String> githubToken;

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
        // Check if this is a script action type
        ActionTypeEntity actionTypeEntity = ActionTypeEntity.find("name", task.actionType).firstResult();
        if (actionTypeEntity != null && "script".equals(actionTypeEntity.executionMode)) {
            scriptExecutionService.executeScript(task);
            return;
        }

        // Find the actor implementation
        Actor actor = resolveActor(task);
        if (actor == null) {
            failTask(task.id, "No actor available for task type: " + task.actionType);
            return;
        }

        // Resolve the actor entity for name and ID
        ActorEntity actorEntity = resolveActorEntity(task);
        String actorName = actorEntity != null ? actorEntity.name : "Unknown Actor";
        Long actorEntityId = actorEntity != null ? actorEntity.id : null;

        // Mark task status based on actor type
        if ("human".equals(actor.getType())) {
            markTaskAwaitingInput(task.id, actorEntityId, actorName);
        } else {
            markTaskInProgress(task.id, actorEntityId, actorName);
        }

        // Build the actor context
        ProjectEntity project = ProjectEntity.findById(task.projectId);
        Path workspace = workspaceService.getWorkspacePath(project);
        Map<String, String> env = buildEnvironment();

        // Generate MCP config filtered to only the tools allowed by this action type
        List<String> allowedTools = getToolsFromActionType(task.actionType);
        Path mcpConfig = mcpManager.configureMcpServers(task.id, env, allowedTools);

        ActorContext context = ActorContext.builder()
                .workingDirectory(workspace)
                .systemPrompt(buildSystemPrompt(task, project))
                .promptTemplate(resolvePromptTemplate(actionTypeEntity, task, project))
                .allowedTools(allowedTools)
                .mcpConfigFile(mcpConfig)
                .environment(env)
                .model(actionTypeEntity != null ? actionTypeEntity.model : null)
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
     * Resolves the Actor implementation for a task. Uses the actor entity
     * resolved by {@link #resolveActorEntity} to find the matching CDI bean.
     */
    private Actor resolveActor(TaskEntity task) {
        ActorEntity actorEntity = resolveActorEntity(task);
        if (actorEntity != null) {
            return findActorByType(actorEntity.type);
        }
        return null;
    }

    /**
     * Resolves the ActorEntity for a task. Priority:
     * 1. Explicitly assigned actor (if set on the task)
     * 2. First actor whose capabilities include the task's action type
     * 3. First AI agent actor (fallback when no capabilities match)
     */
    private ActorEntity resolveActorEntity(TaskEntity task) {
        if (task.assignedActor != null) {
            ActorEntity actorEntity = ActorEntity.findById(task.assignedActor);
            if (actorEntity != null) {
                return actorEntity;
            }
        }

        // Find an actor whose capabilities include this action type
        List<ActorEntity> allActors = ActorEntity.listAll();
        for (ActorEntity actor : allActors) {
            if (actor.capabilities != null && !actor.capabilities.isBlank()) {
                List<String> caps = java.util.Arrays.stream(actor.capabilities.split(","))
                        .map(String::trim)
                        .toList();
                if (caps.contains(task.actionType)) {
                    return actor;
                }
            }
        }

        // Fallback: first AI agent actor regardless of capabilities
        LOG.warnf("No actor with capability '%s' found, falling back to first ai-agent",
                task.actionType);
        return ActorEntity.<ActorEntity>find("type", "ai-agent").firstResult();
    }

    private Actor findActorByType(String type) {
        // Map entity types to actor implementation types using the active AI engine
        String implType = "ai-agent".equals(type) ? aiEngine.getActorType() : type;
        for (Actor actor : actors) {
            if (actor.getType().equals(implType)) {
                return actor;
            }
        }
        return null;
    }

    /**
     * Reads the allowed tools from the ActionTypeEntity's allowedTools field.
     * Falls back to a minimal read-only set if not configured.
     */
    private List<String> getToolsFromActionType(String actionType) {
        ActionTypeEntity actionTypeEntity = ActionTypeEntity.find("name", actionType).firstResult();
        if (actionTypeEntity != null
                && actionTypeEntity.allowedTools != null
                && !actionTypeEntity.allowedTools.isBlank()) {
            return toolsetResolver.resolve(actionTypeEntity.allowedTools);
        }
        // Fallback: minimal read-only tools
        LOG.warnf("No allowed tools configured for action type '%s', using minimal read-only defaults",
                actionType);
        return List.of("Read", "Glob", "Grep");
    }

    /**
     * Builds environment variables to pass to the actor subprocess.
     * Includes the GitHub token so gh CLI commands can authenticate.
     */
    private Map<String, String> buildEnvironment() {
        Map<String, String> env = new HashMap<>();

        // Try config property first, then fall back to env vars directly
        String token = githubToken.orElse(null);
        if (token == null || token.isBlank()) {
            token = System.getenv("AXIOM_GITHUB_TOKEN");
        }
        if (token == null || token.isBlank()) {
            token = System.getenv("GH_TOKEN");
        }
        if (token == null || token.isBlank()) {
            token = System.getenv("GITHUB_TOKEN");
        }

        if (token != null && !token.isBlank()) {
            env.put("GH_TOKEN", token);
            env.put("GITHUB_TOKEN", token);
            LOG.debugf("GH_TOKEN set for subprocess (%d chars)", token.length());
        } else {
            LOG.warnf("No GitHub token configured — gh CLI commands will fail");
        }

        return env;
    }

    /**
     * Resolves the prompt template for the action type, substituting placeholders
     * with values from the task and project. Returns null if no template is configured.
     */
    private String resolvePromptTemplate(ActionTypeEntity actionType, TaskEntity task,
                                          ProjectEntity project) {
        if (actionType == null || actionType.promptTemplate == null
                || actionType.promptTemplate.isBlank()) {
            return null;
        }

        String resolved = actionType.promptTemplate;
        resolved = resolved.replace("{{managerInput}}", task.input != null ? task.input : "");
        resolved = resolved.replace("{{actionType}}", task.actionType != null ? task.actionType : "");
        resolved = resolved.replace("{{issueRef}}", project.issueRef != null ? project.issueRef : "");
        resolved = resolved.replace("{{repository}}", project.repository != null ? project.repository : "");
        resolved = resolved.replace("{{projectName}}", project.name != null ? project.name : "");
        return resolved;
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
    void markTaskInProgress(Long taskId, Long actorEntityId, String actorName) {
        TaskEntity task = TaskEntity.findById(taskId);
        if (task != null) {
            task.status = "InProgress";
            task.assignedActor = actorEntityId;

            // Update project status
            ProjectEntity project = ProjectEntity.findById(task.projectId);
            if (project != null) {
                project.status = "InProgress";
                project.updatedOn = Instant.now();
            }

            // Log to activity
            logActivity(task.projectId, taskId, task.eventId, "task-started",
                    "Task started: " + task.actionType + " (actor: " + actorName + ")");

            // Log to thread
            addThreadEntry(task.projectId, "system", "update",
                    "Task started: " + task.actionType + "\nAssigned to: " + actorName);

            // Fire SSE events
            sseEvents.fire(SseEvent.taskUpdated(task.projectId, taskId, "InProgress"));
            sseEvents.fire(SseEvent.projectUpdated(task.projectId));
            sseEvents.fire(SseEvent.threadEntry(task.projectId));
        }
    }

    @Transactional
    void markTaskAwaitingInput(Long taskId, Long actorEntityId, String actorName) {
        TaskEntity task = TaskEntity.findById(taskId);
        if (task != null) {
            task.status = "AwaitingInput";
            task.assignedActor = actorEntityId;

            // Update project status
            ProjectEntity project = ProjectEntity.findById(task.projectId);
            if (project != null) {
                project.status = "InProgress";
                project.updatedOn = Instant.now();
            }

            // Log to activity
            logActivity(task.projectId, taskId, task.eventId, "task-awaiting-input",
                    "Task awaiting human input: " + task.actionType + " (actor: " + actorName + ")");

            // Log to thread
            addThreadEntry(task.projectId, "system", "update",
                    "Task awaiting human input: " + task.actionType
                            + "\nAssigned to: " + actorName
                            + (task.input != null ? "\n\n" + task.input : ""));

            // Fire SSE events
            sseEvents.fire(SseEvent.taskUpdated(task.projectId, taskId, "AwaitingInput"));
            sseEvents.fire(SseEvent.projectUpdated(task.projectId));
            sseEvents.fire(SseEvent.threadEntry(task.projectId));
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
        task.executionLog = result.getExecutionLog();

        String statusText = result.isSuccess() ? "completed" : "failed";
        LOG.infof("Task %d %s (cost: $%s, tokens: %d/%d)",
                taskId, statusText,
                result.getCostUsd() != null ? String.format("%.4f", result.getCostUsd()) : "n/a",
                result.getInputTokens() != null ? result.getInputTokens() : 0,
                result.getOutputTokens() != null ? result.getOutputTokens() : 0);

        // Record AI usage
        recordAiUsage("task", taskId, task.eventId, task.projectId,
                task.assignedActor, task.actionType,
                result.getCostUsd(), result.getInputTokens(), result.getOutputTokens());

        // Log to activity
        logActivity(task.projectId, taskId, task.eventId, "task-" + statusText,
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

        // Fire SSE events
        sseEvents.fire(SseEvent.taskUpdated(task.projectId, taskId, task.status));
        sseEvents.fire(SseEvent.threadEntry(task.projectId));
        sseEvents.fire(SseEvent.activity("task-" + statusText,
                "Task " + statusText + ": " + task.actionType));
        if (!result.isSuccess()) {
            sseEvents.fire(SseEvent.notification(
                    "Task failed: " + task.actionType, "error"));
        }

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

            logActivity(task.projectId, taskId, task.eventId, "task-failed",
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

        // Update disk usage for the project workspace
        ProjectEntity project = ProjectEntity.findById(projectId);
        if (project != null) {
            project.diskUsageBytes = workspaceService.computeDiskUsage(project);
        }

        if (activeTasks == 0) {
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

    private void logActivity(Long projectId, Long taskId, Long eventId,
                              String entryType, String summary) {
        ActivityLogEntity log = new ActivityLogEntity();
        log.projectId = projectId;
        log.taskId = taskId;
        log.eventId = eventId;
        log.entryType = entryType;
        log.summary = summary != null && summary.length() > 1024
                ? summary.substring(0, 1021) + "..."
                : summary;
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

    private void recordAiUsage(String invocationType, Long taskId, Long eventId,
                                Long projectId, Long actorId, String actionType,
                                Double costUsd, Long inputTokens, Long outputTokens) {
        AiUsageEntity usage = new AiUsageEntity();
        usage.invocationType = invocationType;
        usage.taskId = taskId;
        usage.eventId = eventId;
        usage.projectId = projectId;
        usage.actorId = actorId;
        usage.actionType = actionType;
        usage.costUsd = costUsd;
        usage.inputTokens = inputTokens;
        usage.outputTokens = outputTokens;
        usage.createdOn = Instant.now();
        usage.persist();
    }
}
