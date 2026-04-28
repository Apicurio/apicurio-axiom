package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.api.UsageResource;
import io.apicurio.axiom.api.beans.AiUsage;
import io.apicurio.axiom.api.beans.AiUsageSearchResults;
import io.apicurio.axiom.core.entities.AiUsageEntity;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

import java.math.BigInteger;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementation of the AI Usage REST API.
 */
@ApplicationScoped
@RunOnVirtualThread
public class UsageResourceImpl implements UsageResource {

    @Inject
    EntityManager entityManager;

    /**
     * {@inheritDoc}
     */
    @Override
    public AiUsageSearchResults listUsage(BigInteger page, BigInteger limit,
                                           String filterInvocationType,
                                           BigInteger filterProjectId,
                                           BigInteger filterActorId,
                                           String filterActionType) {
        int pageNum = page != null ? page.intValue() : 1;
        int pageSize = limit != null ? limit.intValue() : 20;

        StringBuilder hql = new StringBuilder("1=1");
        Map<String, Object> params = new HashMap<>();

        if (filterInvocationType != null && !filterInvocationType.isBlank()) {
            hql.append(" and invocationType = :invocationType");
            params.put("invocationType", filterInvocationType);
        }
        if (filterProjectId != null) {
            hql.append(" and projectId = :projectId");
            params.put("projectId", filterProjectId.longValue());
        }
        if (filterActorId != null) {
            hql.append(" and actorId = :actorId");
            params.put("actorId", filterActorId.longValue());
        }
        if (filterActionType != null && !filterActionType.isBlank()) {
            hql.append(" and lower(actionType) like :actionType");
            params.put("actionType", "%" + filterActionType.toLowerCase() + "%");
        }

        long totalCount = AiUsageEntity.count(hql.toString(), params);
        List<AiUsage> items = AiUsageEntity.<AiUsageEntity>find(hql.toString(),
                        Sort.descending("createdOn"), params)
                .page(Page.of(pageNum - 1, pageSize))
                .list()
                .stream()
                .map(this::toBean)
                .toList();

        // Compute aggregates across ALL matching records (not just the current page)
        String aggregateHql = "SELECT COALESCE(SUM(costUsd), 0), "
                + "COALESCE(SUM(inputTokens), 0), "
                + "COALESCE(SUM(outputTokens), 0) "
                + "FROM AiUsageEntity WHERE " + hql;
        Query aggregateQuery = entityManager.createQuery(aggregateHql);
        for (Map.Entry<String, Object> entry : params.entrySet()) {
            aggregateQuery.setParameter(entry.getKey(), entry.getValue());
        }
        Object[] aggregates = (Object[]) aggregateQuery.getSingleResult();

        AiUsageSearchResults results = new AiUsageSearchResults();
        results.setItems(items);
        results.setTotalCount(totalCount);
        results.setPage(pageNum);
        results.setLimit(pageSize);
        results.setTotalCostUsd(((Number) aggregates[0]).doubleValue());
        results.setTotalInputTokens(((Number) aggregates[1]).longValue());
        results.setTotalOutputTokens(((Number) aggregates[2]).longValue());
        return results;
    }

    private AiUsage toBean(AiUsageEntity entity) {
        AiUsage usage = new AiUsage();
        usage.setId(entity.id);
        usage.setInvocationType(entity.invocationType);
        usage.setTaskId(entity.taskId);
        usage.setEventId(entity.eventId);
        usage.setProjectId(entity.projectId);
        usage.setActorId(entity.actorId);
        usage.setActionType(entity.actionType);
        usage.setModel(entity.model);
        usage.setCostUsd(entity.costUsd);
        usage.setInputTokens(entity.inputTokens);
        usage.setOutputTokens(entity.outputTokens);
        usage.setDurationMs(entity.durationMs);
        usage.setCreatedOn(Date.from(entity.createdOn));
        return usage;
    }
}
