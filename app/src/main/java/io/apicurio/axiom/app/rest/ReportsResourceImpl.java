package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.api.ReportsResource;
import io.apicurio.axiom.api.beans.NewReportDefinition;
import io.apicurio.axiom.api.beans.Report;
import io.apicurio.axiom.api.beans.ReportAiEditRequest;
import io.apicurio.axiom.api.beans.ReportAiEditResponse;
import io.apicurio.axiom.api.beans.ReportDefinition;
import io.apicurio.axiom.api.beans.ReportSearchResults;
import io.apicurio.axiom.app.ReportAiService;
import io.apicurio.axiom.app.ReportQueueConsumer;
import io.apicurio.axiom.app.ReportScheduler;
import io.apicurio.axiom.core.entities.ReportDefinitionEntity;
import io.apicurio.axiom.core.entities.ReportEntity;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;

import java.math.BigInteger;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementation of the Reports REST API.
 */
@ApplicationScoped
@RunOnVirtualThread
public class ReportsResourceImpl implements ReportsResource {

    @Inject
    ReportScheduler reportScheduler;

    @Inject
    ReportQueueConsumer reportQueuePoller;

    @Inject
    ReportAiService reportAiService;

    /**
     * {@inheritDoc}
     */
    @Override
    public ReportAiEditResponse aiEditReportPrompt(ReportAiEditRequest data) {
        return reportAiService.editReportPrompt(data);
    }

    // ── Report Definitions CRUD ──────────────────────────────────────

    /**
     * {@inheritDoc}
     */
    @Override
    public List<ReportDefinition> listReportDefinitions() {
        return ReportDefinitionEntity.<ReportDefinitionEntity>listAll(Sort.ascending("name"))
                .stream().map(this::toDefinitionBean).toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public ReportDefinition createReportDefinition(NewReportDefinition data) {
        ReportDefinitionEntity entity = new ReportDefinitionEntity();
        applyDefinitionFields(entity, data);
        entity.createdOn = Instant.now();
        entity.updatedOn = Instant.now();
        entity.persist();
        return toDefinitionBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public ReportDefinition getReportDefinition(long definitionId) {
        return toDefinitionBean(findDefinitionOrThrow(definitionId));
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public ReportDefinition updateReportDefinition(long definitionId, NewReportDefinition data) {
        ReportDefinitionEntity entity = findDefinitionOrThrow(definitionId);
        applyDefinitionFields(entity, data);
        entity.updatedOn = Instant.now();
        return toDefinitionBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void deleteReportDefinition(long definitionId) {
        ReportDefinitionEntity entity = findDefinitionOrThrow(definitionId);
        // Delete associated reports
        ReportEntity.delete("definitionId", definitionId);
        entity.delete();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Report runReportDefinition(long definitionId) {
        // Step 1: create the report (transactional — commits before enqueue)
        Long reportId = createReportForRun(definitionId);

        // Step 2: enqueue after transaction has committed
        reportQueuePoller.enqueue(reportId);

        return getReport(reportId);
    }

    @Transactional
    Long createReportForRun(long definitionId) {
        ReportDefinitionEntity definition = findDefinitionOrThrow(definitionId);
        return reportScheduler.createReportAndScheduleNext(definition);
    }

    // ── Reports (read-only) ──────────────────────────────────────────

    /**
     * {@inheritDoc}
     */
    @Override
    public ReportSearchResults listReports(BigInteger page, BigInteger limit,
                                            BigInteger filterDefinitionId,
                                            String filterStatus, String filterTitle) {
        int pageNum = page != null ? page.intValue() : 1;
        int pageSize = limit != null ? limit.intValue() : 20;

        StringBuilder hql = new StringBuilder("1=1");
        Map<String, Object> params = new HashMap<>();

        if (filterDefinitionId != null) {
            hql.append(" and definitionId = :defId");
            params.put("defId", filterDefinitionId.longValue());
        }
        if (filterStatus != null && !filterStatus.isBlank()) {
            java.util.List<String> statuses = java.util.Arrays.stream(filterStatus.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList();
            hql.append(" and status in :statuses");
            params.put("statuses", statuses);
        }
        if (filterTitle != null && !filterTitle.isBlank()) {
            hql.append(" and lower(title) like :title");
            params.put("title", "%" + filterTitle.toLowerCase() + "%");
        }

        long totalCount = ReportEntity.count(hql.toString(), params);
        List<Report> items = ReportEntity.<ReportEntity>find(hql.toString(),
                        Sort.descending("createdOn"), params)
                .page(Page.of(pageNum - 1, pageSize))
                .list().stream().map(this::toReportBean).toList();

        ReportSearchResults results = new ReportSearchResults();
        results.setItems(items);
        results.setTotalCount(totalCount);
        results.setPage(pageNum);
        results.setLimit(pageSize);
        return results;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getReportExecutionLog(long reportId) {
        ReportEntity entity = ReportEntity.findById(reportId);
        if (entity == null) {
            throw new WebApplicationException("Report not found: " + reportId, 404);
        }
        if (entity.executionLog == null || entity.executionLog.isEmpty()) {
            throw new WebApplicationException(
                    "No execution log available for report: " + reportId, 404);
        }
        return entity.executionLog;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Report getReport(long reportId) {
        ReportEntity entity = ReportEntity.findById(reportId);
        if (entity == null) {
            throw new WebApplicationException("Report not found: " + reportId, 404);
        }
        return toReportBean(entity);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private ReportDefinitionEntity findDefinitionOrThrow(long id) {
        ReportDefinitionEntity entity = ReportDefinitionEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Report definition not found: " + id, 404);
        }
        return entity;
    }

    private void applyDefinitionFields(ReportDefinitionEntity entity, NewReportDefinition data) {
        entity.name = data.getName();
        entity.description = data.getDescription();
        entity.schedule = data.getSchedule();
        entity.scheduleTime = data.getScheduleTime();
        entity.timeWindow = data.getTimeWindow();
        entity.repositories = data.getRepositories();
        entity.promptTemplate = data.getPromptTemplate();
        entity.allowedTools = data.getAllowedTools() != null
                ? String.join(",", data.getAllowedTools()) : null;
        entity.enabled = data.getEnabled() != null ? data.getEnabled() : false;

        // Compute nextRunAt when enabled (or schedule/time changes)
        if (entity.enabled) {
            entity.nextRunAt = reportScheduler.computeInitialNextRunAt(entity);
        } else {
            entity.nextRunAt = null;
        }
    }

    private ReportDefinition toDefinitionBean(ReportDefinitionEntity entity) {
        ReportDefinition def = new ReportDefinition();
        def.setId(entity.id);
        def.setName(entity.name);
        def.setDescription(entity.description);
        def.setSchedule(entity.schedule);
        def.setScheduleTime(entity.scheduleTime);
        def.setTimeWindow(entity.timeWindow);
        def.setRepositories(entity.repositories);
        def.setPromptTemplate(entity.promptTemplate);
        if (entity.allowedTools != null && !entity.allowedTools.isBlank()) {
            def.setAllowedTools(java.util.Arrays.stream(entity.allowedTools.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList());
        }
        def.setEnabled(entity.enabled);
        if (entity.nextRunAt != null) def.setNextRunAt(Date.from(entity.nextRunAt));
        if (entity.lastRunAt != null) def.setLastRunAt(Date.from(entity.lastRunAt));
        def.setCreatedOn(Date.from(entity.createdOn));
        def.setUpdatedOn(Date.from(entity.updatedOn));
        return def;
    }

    private Report toReportBean(ReportEntity entity) {
        Report report = new Report();
        report.setId(entity.id);
        report.setDefinitionId(entity.definitionId);
        report.setStatus(entity.status);
        report.setTitle(entity.title);
        report.setContent(entity.content);
        if (entity.timeRangeStart != null) report.setTimeRangeStart(Date.from(entity.timeRangeStart));
        if (entity.timeRangeEnd != null) report.setTimeRangeEnd(Date.from(entity.timeRangeEnd));
        report.setCostUsd(entity.costUsd);
        report.setCreatedOn(Date.from(entity.createdOn));
        if (entity.completedOn != null) report.setCompletedOn(Date.from(entity.completedOn));
        return report;
    }
}
