package io.apicurio.axiom.manager;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.apicurio.axiom.actors.claudecode.ClaudeCodeCommandBuilder;
import io.apicurio.axiom.actors.claudecode.ClaudeCodeResult;
import io.apicurio.axiom.actors.claudecode.ClaudeCodeSubprocess;
import io.apicurio.axiom.actors.claudecode.ExecutionLogBuilder;
import io.apicurio.axiom.actors.spi.ActorContext;
import io.apicurio.axiom.core.entities.ActionTypeEntity;
import io.apicurio.axiom.core.entities.ActivityLogEntity;
import io.apicurio.axiom.core.entities.AiUsageEntity;
import io.apicurio.axiom.core.entities.ActorEntity;
import io.apicurio.axiom.core.entities.EventEntity;
import io.apicurio.axiom.core.entities.ManagerConfigEntity;
import io.apicurio.axiom.core.entities.ProjectEntity;
import io.apicurio.axiom.core.entities.TaskEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service that invokes the AI Manager to evaluate events and produce decisions.
 * Launches Claude Code as a subprocess with a configurable system prompt and
 * prompt template containing the event, project context, action types, and actors.
 */
@ApplicationScoped
public class ManagerService {

    private static final Logger LOG = Logger.getLogger(ManagerService.class);

    @Inject
    ObjectMapper objectMapper;

    @ConfigProperty(name = "axiom.manager.confidence-threshold", defaultValue = "0.7")
    double confidenceThreshold;

    @ConfigProperty(name = "axiom.manager.timeout-seconds", defaultValue = "120")
    int timeoutSeconds;

    @ConfigProperty(name = "axiom.manager.max-turns", defaultValue = "5")
    int maxTurns;

    @ConfigProperty(name = "axiom.manager.model")
    Optional<String> model;

    /**
     * Evaluates an event and returns the Manager's decisions.
     *
     * @param event the event to evaluate
     * @return a list of decisions (may be empty if the Manager fails)
     */
    public List<ManagerDecision> evaluate(EventEntity event) {
        LOG.infof("Manager evaluating event %d: %s [%s]", event.id, event.eventType, event.issueRef);

        // Load context
        List<ActionTypeEntity> actionTypes = ActionTypeEntity.listAll();
        List<ActorEntity> actors = ActorEntity.listAll();

        // Find existing project for this issue
        ProjectEntity project = null;
        List<TaskEntity> recentTasks = Collections.emptyList();
        if (event.issueRef != null) {
            project = ProjectEntity.find("issueRef", event.issueRef).firstResult();
            if (project != null) {
                recentTasks = TaskEntity.find(
                        "projectId = ?1 order by createdOn desc",
                        project.id).page(0, 10).list();
            }
        }

        // Load manager configuration (system prompt + prompt template)
        String systemPrompt = ManagerPromptBuilder.DEFAULT_SYSTEM_PROMPT;
        String promptTemplate = ManagerPromptBuilder.DEFAULT_PROMPT_TEMPLATE;
        ManagerConfigEntity config = ManagerConfigEntity.<ManagerConfigEntity>findAll()
                .firstResult();
        if (config != null) {
            if (config.systemPrompt != null && !config.systemPrompt.isBlank()) {
                systemPrompt = config.systemPrompt;
            }
            if (config.promptTemplate != null && !config.promptTemplate.isBlank()) {
                promptTemplate = config.promptTemplate;
            }
        }

        // Build user prompt from template with placeholder substitution
        String userPrompt = ManagerPromptBuilder.buildUserPrompt(
                promptTemplate, event, actionTypes, actors, project, recentTasks);
        String jsonSchema = ManagerPromptBuilder.getResponseJsonSchema();

        // Create execution log builder
        ExecutionLogBuilder logBuilder = new ExecutionLogBuilder();
        logBuilder.header(0, "manager-evaluate", Instant.now());
        logBuilder.systemPrompt(systemPrompt);
        logBuilder.prompt(userPrompt);
        logBuilder.allowedTools(List.of("StructuredOutput"));

        // Build command — Manager needs no tools, just reasoning
        ActorContext context = ActorContext.builder()
                .systemPrompt(systemPrompt)
                .allowedTools(List.of("StructuredOutput"))
                .build();

        ClaudeCodeCommandBuilder cmdBuilder = ClaudeCodeCommandBuilder
                .fromContext(userPrompt, context)
                .streamJson(true)
                .maxTurns(maxTurns);

        model.ifPresent(cmdBuilder::model);

        List<String> command = cmdBuilder.build();

        // Add json-schema flag
        command.add("--json-schema");
        command.add(jsonSchema);

        // Execute
        ClaudeCodeSubprocess subprocess = new ClaudeCodeSubprocess(
                command, null, Map.of(),
                Duration.ofSeconds(timeoutSeconds), null,
                logBuilder
        );

        try {
            ClaudeCodeResult result = subprocess.execute().join();
            String executionLog = result.executionLog();

            // Record AI usage for this Manager evaluation
            recordAiUsage(event.id, project != null ? project.id : null,
                    result.totalCostUsd(), result.inputTokens(), result.outputTokens());

            if (!result.isSuccess()) {
                LOG.errorf("Manager subprocess failed (exit %d): %s",
                        result.exitCode(), result.result());
                logManagerActivity(event.id, "manager-error",
                        "Manager failed to evaluate event: " + result.result(),
                        executionLog);
                return Collections.emptyList();
            }

            List<ManagerDecision> decisions = parseDecisions(result.result());

            // Build summary of decisions for the activity log
            StringBuilder summary = new StringBuilder();
            for (ManagerDecision decision : decisions) {
                LOG.infof("Manager decision for event %d: %s (action: %s, confidence: %.2f) — %s",
                        event.id, decision.decision(), decision.actionType(),
                        decision.confidence(), decision.reasoning());
                if (!summary.isEmpty()) summary.append("; ");
                summary.append(decision.decision());
                if (decision.actionType() != null) {
                    summary.append("(").append(decision.actionType()).append(")");
                }
            }

            String summaryText = decisions.isEmpty()
                    ? "Manager returned no decisions for event " + event.id
                    : "Manager decisions for event " + event.id + ": " + summary;
            logManagerActivity(event.id, "manager-evaluated", summaryText, executionLog);

            return decisions;

        } catch (Exception e) {
            LOG.errorf(e, "Manager evaluation failed for event %d", event.id);
            logManagerActivity(event.id, "manager-error",
                    "Manager evaluation error: " + e.getMessage(), null);
            return Collections.emptyList();
        }
    }

    /**
     * Checks whether a decision meets the confidence threshold.
     *
     * @param decision the decision to check
     * @return true if the confidence is at or above the threshold
     */
    public boolean meetsConfidenceThreshold(ManagerDecision decision) {
        return decision.confidence() >= confidenceThreshold;
    }

    /**
     * Parses the Manager's JSON output into a list of decisions.
     */
    List<ManagerDecision> parseDecisions(String jsonOutput) {
        if (jsonOutput == null || jsonOutput.isBlank()) {
            return Collections.emptyList();
        }

        try {
            JsonNode root = objectMapper.readTree(jsonOutput);

            JsonNode decisionsNode = root.path("decisions");
            if (decisionsNode.isMissingNode() || !decisionsNode.isArray()) {
                if (root.has("result")) {
                    String resultText = root.get("result").asText();
                    return parseDecisions(resultText);
                }
                LOG.warnf("Manager output missing 'decisions' array: %s",
                        jsonOutput.substring(0, Math.min(jsonOutput.length(), 200)));
                return Collections.emptyList();
            }

            List<ManagerDecision> decisions = new ArrayList<>();
            for (JsonNode node : decisionsNode) {
                ManagerDecision decision = new ManagerDecision(
                        node.path("decision").asText("ignore"),
                        node.path("actionType").asText(null),
                        node.path("actorHint").asText(null),
                        node.path("inputContext").asText(null),
                        node.path("confidence").asDouble(0.5),
                        node.path("reasoning").asText("")
                );
                decisions.add(decision);
            }

            return decisions;

        } catch (Exception e) {
            LOG.errorf(e, "Failed to parse Manager output: %s",
                    jsonOutput.substring(0, Math.min(jsonOutput.length(), 200)));
            return Collections.emptyList();
        }
    }

    /**
     * Logs a manager activity entry with optional execution log details.
     *
     * @param eventId the event ID
     * @param entryType the activity log entry type
     * @param summary a brief summary
     * @param details the full execution log (may be null)
     */
    @Transactional
    void logManagerActivity(Long eventId, String entryType, String summary, String details) {
        ActivityLogEntity log = new ActivityLogEntity();
        log.eventId = eventId;
        log.entryType = entryType;
        log.summary = summary != null && summary.length() > 1024
                ? summary.substring(0, 1021) + "..."
                : summary;
        log.details = details;
        log.createdOn = Instant.now();
        log.persist();
    }

    @Transactional
    void recordAiUsage(Long eventId, Long projectId,
                        Double costUsd, Long inputTokens, Long outputTokens) {
        AiUsageEntity usage = new AiUsageEntity();
        usage.invocationType = "manager";
        usage.eventId = eventId;
        usage.projectId = projectId;
        usage.actionType = "manager-evaluate";
        usage.costUsd = costUsd;
        usage.inputTokens = inputTokens;
        usage.outputTokens = outputTokens;
        usage.createdOn = Instant.now();
        usage.persist();
    }
}
