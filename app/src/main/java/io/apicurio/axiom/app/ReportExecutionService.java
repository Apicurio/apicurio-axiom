package io.apicurio.axiom.app;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.apicurio.axiom.core.entities.AiUsageEntity;
import io.apicurio.axiom.core.entities.ReportDefinitionEntity;
import io.apicurio.axiom.core.entities.ReportEntity;
import io.apicurio.axiom.core.entities.RepositoryEntity;
import io.apicurio.axiom.core.services.ToolsetResolver;
import io.apicurio.axiom.engine.spi.AiEngine;
import io.apicurio.axiom.engine.spi.AiEngineConfig;
import io.apicurio.axiom.engine.spi.AiEngineMcpManager;
import io.apicurio.axiom.engine.spi.AiEngineResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Executes report generation by invoking the AI engine with a prompt template,
 * read-only tools, and GitHub MCP tools. Stores the generated markdown content
 * in the ReportEntity.
 */
@ApplicationScoped
public class ReportExecutionService {

    private static final Logger LOG = Logger.getLogger(ReportExecutionService.class);

    @Inject
    ObjectMapper objectMapper;

    @Inject
    AiEngine aiEngine;

    @Inject
    AiEngineMcpManager mcpManager;

    @Inject
    ToolsetResolver toolsetResolver;

    @ConfigProperty(name = "axiom.claude-code.model")
    Optional<String> model;

    @ConfigProperty(name = "axiom.claude-code.timeout-seconds", defaultValue = "600")
    int timeoutSeconds;

    private static final String SYSTEM_PROMPT = """
            You are a report generator for Apicurio Axiom. Your job is to gather \
            information from GitHub repositories and produce a well-formatted markdown \
            report.

            Guidelines:
            - Use the provided tools (gh CLI) to query GitHub for issues, PRs, and activity
            - Format the report as clean, readable markdown with tables, links, and sections
            - Include clickable GitHub links for all issues and PRs: [#N](https://github.com/owner/repo/issues/N)
            - Start with a summary section highlighting key metrics
            - Group information by repository if multiple repos are covered
            - Use emoji for visual status indicators where appropriate
            - Be concise but thorough — highlight what matters
            """;

    private static final List<String> DEFAULT_REPORT_TOOLS = List.of(
            "Read", "Glob", "Grep",
            "Bash(ls *)", "Bash(cat *)", "Bash(head *)", "Bash(tail *)",
            "Bash(find *)", "Bash(wc *)", "Bash(file *)",
            "Bash(gh issue *)", "Bash(gh pr *)", "Bash(gh api *)",
            "Bash(gh repo *)", "Bash(date *)",
            "mcp__axiom-tools__list_github_issues",
            "mcp__axiom-tools__list_github_prs"
    );

    /**
     * Generates a report asynchronously. Updates the ReportEntity with the result.
     *
     * @param definition the report definition
     * @param reportId the report entity ID to update
     */
    public void generateReport(ReportDefinitionEntity definition, Long reportId) {
        LOG.infof("Generating report '%s' (ID: %d)", definition.name, reportId);

        // Compute time range
        Instant now = Instant.now();
        Instant rangeStart = computeTimeRangeStart(definition, now);
        Instant rangeEnd = now;

        // Resolve repositories
        String repoList = resolveRepositories(definition);

        // Build prompt from template
        DateTimeFormatter fmt = DateTimeFormatter.ISO_INSTANT;
        String humanWindow = describeTimeWindow(definition.timeWindow, rangeStart, rangeEnd);

        String prompt = definition.promptTemplate
                .replace("{{repositories}}", repoList)
                .replace("{{timeRangeStart}}", fmt.format(rangeStart))
                .replace("{{timeRangeEnd}}", fmt.format(rangeEnd))
                .replace("{{timeWindow}}", humanWindow);

        // Resolve allowed tools from the definition, falling back to defaults
        List<String> allowedTools = resolveAllowedTools(definition);

        // Generate MCP config with report-related tools
        Map<String, String> env = buildEnvironment();
        Path mcpConfig = mcpManager.configureMcpServers(reportId, env, allowedTools);

        // Build engine-agnostic config
        AiEngineConfig engineConfig = AiEngineConfig.builder()
                .systemPrompt(SYSTEM_PROMPT)
                .allowedTools(allowedTools)
                .timeoutSeconds(timeoutSeconds)
                .maxSteps(30)
                .model(model.orElse(null))
                .environment(env)
                .mcpConfigFile(mcpConfig)
                .build();

        // Mark as generating
        markGenerating(reportId, rangeStart, rangeEnd);

        aiEngine.prompt(engineConfig, prompt)
                .thenAccept(result -> onReportCompleted(reportId, definition.id, result))
                .exceptionally(throwable -> {
                    LOG.errorf(throwable, "Report %d generation failed unexpectedly", reportId);
                    failReport(reportId, "Unexpected error: " + throwable.getMessage());
                    return null;
                });
    }

    @Transactional
    void markGenerating(Long reportId, Instant rangeStart, Instant rangeEnd) {
        ReportEntity report = ReportEntity.findById(reportId);
        if (report != null) {
            report.status = "Generating";
            report.timeRangeStart = rangeStart;
            report.timeRangeEnd = rangeEnd;
        }
    }

    @Transactional
    void onReportCompleted(Long reportId, Long definitionId, AiEngineResult result) {
        ReportEntity report = ReportEntity.findById(reportId);
        if (report == null) return;

        if (result.success()) {
            report.status = "Completed";
            report.content = result.result();
            report.title = extractTitle(result.result());
        } else {
            report.status = "Failed";
            report.content = "Report generation failed: " + result.result();
        }
        report.executionLog = result.executionLog();
        report.costUsd = result.costUsd();
        report.completedOn = Instant.now();

        LOG.infof("Report %d %s (cost: $%s)",
                reportId, report.status,
                result.costUsd() != null ? String.format("%.4f", result.costUsd()) : "n/a");

        // Record AI usage
        AiUsageEntity usage = new AiUsageEntity();
        usage.invocationType = "report";
        usage.actionType = "generate-report";
        usage.costUsd = result.costUsd();
        usage.inputTokens = result.inputTokens();
        usage.outputTokens = result.outputTokens();
        usage.createdOn = Instant.now();
        usage.persist();
    }

    @Transactional
    void failReport(Long reportId, String reason) {
        ReportEntity report = ReportEntity.findById(reportId);
        if (report != null) {
            report.status = "Failed";
            report.content = reason;
            report.completedOn = Instant.now();
        }
    }

    private Instant computeTimeRangeStart(ReportDefinitionEntity definition, Instant now) {
        if (definition.lastRunAt != null && "since-last-run".equals(definition.timeWindow)) {
            return definition.lastRunAt;
        }
        return switch (definition.timeWindow) {
            case "last-24h", "since-last-run" -> now.minus(24, ChronoUnit.HOURS);
            case "last-7d" -> now.minus(7, ChronoUnit.DAYS);
            case "last-30d" -> now.minus(30, ChronoUnit.DAYS);
            default -> now.minus(24, ChronoUnit.HOURS);
        };
    }

    /**
     * Resolves the allowed tools for a report definition, expanding any
     * {@code @ToolsetName} references into their constituent tools.
     * Falls back to default report tools if none are configured.
     */
    private List<String> resolveAllowedTools(ReportDefinitionEntity definition) {
        if (definition.allowedTools != null && !definition.allowedTools.isBlank()) {
            return toolsetResolver.resolve(definition.allowedTools);
        }
        return DEFAULT_REPORT_TOOLS;
    }

    private String resolveRepositories(ReportDefinitionEntity definition) {
        if (definition.repositories != null && !definition.repositories.isEmpty()) {
            return String.join(", ", definition.repositories);
        }
        // All repositories
        List<RepositoryEntity> all = RepositoryEntity.listAll();
        return all.stream()
                .map(r -> r.owner + "/" + r.name)
                .reduce((a, b) -> a + ", " + b)
                .orElse("(no repositories configured)");
    }

    private String describeTimeWindow(String timeWindow, Instant start, Instant end) {
        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("MMMM d, yyyy")
                .withZone(ZoneId.systemDefault());
        return switch (timeWindow) {
            case "last-24h" -> "Last 24 hours (" + dateFmt.format(start) + " — " + dateFmt.format(end) + ")";
            case "last-7d" -> "Last 7 days (" + dateFmt.format(start) + " — " + dateFmt.format(end) + ")";
            case "last-30d" -> "Last 30 days (" + dateFmt.format(start) + " — " + dateFmt.format(end) + ")";
            case "since-last-run" -> "Since last run (" + dateFmt.format(start) + " — " + dateFmt.format(end) + ")";
            default -> dateFmt.format(start) + " — " + dateFmt.format(end);
        };
    }

    private String extractTitle(String markdownContent) {
        if (markdownContent == null) return "Untitled Report";
        for (String line : markdownContent.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("# ")) {
                return trimmed.substring(2).trim();
            }
        }
        return "Report";
    }

    private Map<String, String> buildEnvironment() {
        String token = System.getenv("AXIOM_GITHUB_TOKEN");
        if (token == null || token.isBlank()) token = System.getenv("GH_TOKEN");
        if (token == null || token.isBlank()) token = System.getenv("GITHUB_TOKEN");

        if (token != null && !token.isBlank()) {
            return Map.of("GH_TOKEN", token, "GITHUB_TOKEN", token);
        }
        return Map.of();
    }
}
