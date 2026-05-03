package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.api.EventsResource;
import io.apicurio.axiom.api.beans.Event;
import io.apicurio.axiom.api.beans.EventSearchResults;
import io.apicurio.axiom.core.entities.EventEntity;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.WebApplicationException;

import java.math.BigInteger;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementation of the Events REST API. Provides paginated, filterable
 * access to raw events received by the system.
 */
@ApplicationScoped
@RunOnVirtualThread
public class EventsResourceImpl implements EventsResource {

    /**
     * {@inheritDoc}
     */
    @Override
    public EventSearchResults listEvents(BigInteger page, BigInteger limit,
                                          String filterSource, String filterEventType,
                                          String filterRepository) {
        int pageNum = page != null ? page.intValue() : 1;
        int pageSize = limit != null ? limit.intValue() : 20;

        StringBuilder hql = new StringBuilder("1=1");
        Map<String, Object> params = new HashMap<>();

        if (filterSource != null && !filterSource.isBlank()) {
            hql.append(" and lower(source) like :source");
            params.put("source", "%" + filterSource.toLowerCase() + "%");
        }
        if (filterEventType != null && !filterEventType.isBlank()) {
            hql.append(" and lower(eventType) like :eventType");
            params.put("eventType", "%" + filterEventType.toLowerCase() + "%");
        }
        if (filterRepository != null && !filterRepository.isBlank()) {
            hql.append(" and lower(repository) like :repository");
            params.put("repository", "%" + filterRepository.toLowerCase() + "%");
        }

        long totalCount = EventEntity.count(hql.toString(), params);
        List<Event> items = EventEntity.<EventEntity>find(
                        hql.toString(), Sort.descending("receivedAt"), params)
                .page(Page.of(pageNum - 1, pageSize))
                .list()
                .stream()
                .map(this::toBean)
                .toList();

        EventSearchResults results = new EventSearchResults();
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
    public Event getEvent(long eventId) {
        EventEntity entity = EventEntity.findById(eventId);
        if (entity == null) {
            throw new WebApplicationException("Event not found: " + eventId, 404);
        }
        return toBean(entity);
    }

    private Event toBean(EventEntity entity) {
        Event event = new Event();
        event.setId(entity.id);
        event.setSource(entity.source);
        event.setEventType(entity.eventType);
        event.setIssueRef(entity.issueRef);
        event.setRepository(entity.repository);
        event.setProjectId(entity.projectId);
        event.setTaskId(entity.taskId);
        event.setPayload(entity.payload);
        event.setReceivedAt(Date.from(entity.receivedAt));
        return event;
    }
}
