package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.api.ActorsResource;
import io.apicurio.axiom.api.beans.Actor;
import io.apicurio.axiom.api.beans.NewActor;
import io.apicurio.axiom.api.beans.Task;
import io.apicurio.axiom.api.beans.TaskSearchResults;
import io.apicurio.axiom.core.entities.ActorEntity;
import io.apicurio.axiom.core.entities.TaskEntity;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementation of the Actors REST API.
 */
@ApplicationScoped
@RunOnVirtualThread
public class ActorsResourceImpl implements ActorsResource {

    /**
     * {@inheritDoc}
     */
    @Override
    public List<Actor> listActors() {
        return ActorEntity.<ActorEntity>listAll()
                .stream()
                .map(this::toBean)
                .toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public Actor createActor(NewActor data) {
        ActorEntity entity = new ActorEntity();
        applyFields(entity, data);
        entity.persist();
        return toBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Actor getActor(long actorId) {
        return toBean(findOrThrow(actorId));
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public Actor updateActor(long actorId, NewActor data) {
        ActorEntity entity = findOrThrow(actorId);
        applyFields(entity, data);
        return toBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void deleteActor(long actorId) {
        ActorEntity entity = findOrThrow(actorId);
        entity.delete();
    }

    // ── Actor Tasks ───────────────────────────────────────────────────

    /**
     * {@inheritDoc}
     */
    @Override
    public TaskSearchResults listActorTasks(long actorId, BigInteger page, BigInteger limit,
                                             String filterActionType, String filterStatus) {
        findOrThrow(actorId);

        int pageNum = page != null ? page.intValue() : 1;
        int pageSize = limit != null ? limit.intValue() : 20;

        StringBuilder hql = new StringBuilder("assignedActor = :actorId");
        Map<String, Object> params = new HashMap<>();
        params.put("actorId", actorId);

        if (filterActionType != null && !filterActionType.isBlank()) {
            hql.append(" and lower(actionType) like :actionType");
            params.put("actionType", "%" + filterActionType.toLowerCase() + "%");
        }
        if (filterStatus != null && !filterStatus.isBlank()) {
            List<String> statuses = Arrays.stream(filterStatus.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList();
            hql.append(" and status in :statuses");
            params.put("statuses", statuses);
        }

        long totalCount = TaskEntity.count(hql.toString(), params);
        List<Task> items = TaskEntity.<TaskEntity>find(hql.toString(),
                        Sort.descending("createdOn"), params)
                .page(Page.of(pageNum - 1, pageSize))
                .list()
                .stream()
                .map(this::toTaskBean)
                .toList();

        TaskSearchResults results = new TaskSearchResults();
        results.setItems(items);
        results.setTotalCount(totalCount);
        results.setPage(pageNum);
        results.setLimit(pageSize);
        return results;
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private void applyFields(ActorEntity entity, NewActor body) {
        entity.name = body.getName();
        entity.description = body.getDescription();
        entity.type = body.getType().value();
        entity.capabilities = body.getCapabilities() != null ? String.join(",", body.getCapabilities()) : null;
        entity.permissions = body.getPermissions() != null ? body.getPermissions().toString() : null;
        entity.configuration = body.getConfiguration() != null ? body.getConfiguration().toString() : null;
    }

    private ActorEntity findOrThrow(long id) {
        ActorEntity entity = ActorEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Actor not found: " + id, 404);
        }
        return entity;
    }

    private Actor toBean(ActorEntity entity) {
        Actor actor = new Actor();
        actor.setId(entity.id);
        actor.setName(entity.name);
        actor.setDescription(entity.description);
        actor.setType(Actor.Type.fromValue(entity.type));
        if (entity.capabilities != null && !entity.capabilities.isEmpty()) {
            actor.setCapabilities(List.of(entity.capabilities.split(",")));
        }
        return actor;
    }

    private Task toTaskBean(TaskEntity entity) {
        Task task = new Task();
        task.setId(entity.id);
        task.setProjectId(entity.projectId);
        task.setEventId(entity.eventId);
        task.setActionType(entity.actionType);
        task.setCreatedBy(Task.CreatedBy.fromValue(entity.createdBy));
        task.setAssignedActor(entity.assignedActor);
        task.setStatus(Task.Status.fromValue(entity.status));
        task.setInput(entity.input);
        task.setOutput(entity.output);
        task.setCreatedOn(Date.from(entity.createdOn));
        if (entity.completedOn != null) {
            task.setCompletedOn(Date.from(entity.completedOn));
        }
        task.setSessionId(entity.sessionId);
        return task;
    }
}
