package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.api.ActionResource;
import io.apicurio.axiom.api.beans.ActionType;
import io.apicurio.axiom.api.beans.NewActionType;
import io.apicurio.axiom.core.entities.ActionTypeEntity;
import io.apicurio.axiom.core.entities.ToolDefinitionEntity;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

import java.math.BigInteger;
import java.util.List;

/**
 * Implementation of the Action Types REST API.
 */
@ApplicationScoped
@RunOnVirtualThread
public class ActionResourceImpl implements ActionResource {

    /**
     * {@inheritDoc}
     */
    @Override
    public List<ActionType> listActionTypes() {
        return ActionTypeEntity.<ActionTypeEntity>listAll()
                .stream()
                .map(this::toBean)
                .toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public ActionType createActionType(NewActionType data) {
        ActionTypeEntity entity = new ActionTypeEntity();
        applyFields(entity, data);
        entity.persist();
        return toBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public ActionType getActionType(long actionTypeId) {
        return toBean(findOrThrow(actionTypeId));
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public ActionType updateActionType(long actionTypeId, NewActionType data) {
        ActionTypeEntity entity = findOrThrow(actionTypeId);
        applyFields(entity, data);
        return toBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void deleteActionType(long actionTypeId) {
        ActionTypeEntity entity = findOrThrow(actionTypeId);
        entity.delete();
    }

    private void applyFields(ActionTypeEntity entity, NewActionType data) {
        entity.name = data.getName();
        entity.description = data.getDescription();
        entity.executionMode = data.getExecutionMode().value();
        entity.userTriggerable = data.getUserTriggerable() != null ? data.getUserTriggerable() : false;
        entity.inputSchema = data.getInputSchema();
        entity.allowedTools = data.getAllowedTools() != null
                ? String.join(", ", data.getAllowedTools()) : null;
        entity.promptTemplate = data.getPromptTemplate();
        entity.emitsEvent = data.getEmitsEvent() != null ? data.getEmitsEvent() : false;
    }

    private ActionTypeEntity findOrThrow(long id) {
        ActionTypeEntity entity = ActionTypeEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Action type not found: " + id, 404);
        }
        return entity;
    }

    private ActionType toBean(ActionTypeEntity entity) {
        ActionType actionType = new ActionType();
        actionType.setId(entity.id);
        actionType.setName(entity.name);
        actionType.setDescription(entity.description);
        actionType.setExecutionMode(ActionType.ExecutionMode.fromValue(entity.executionMode));
        actionType.setUserTriggerable(entity.userTriggerable);
        actionType.setInputSchema(entity.inputSchema);
        if (entity.allowedTools != null && !entity.allowedTools.isBlank()) {
            actionType.setAllowedTools(java.util.Arrays.stream(entity.allowedTools.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList());
        }
        actionType.setPromptTemplate(entity.promptTemplate);
        actionType.setEmitsEvent(entity.emitsEvent);
        return actionType;
    }

    // ── Action Type Tool Associations (deprecated — use allowedTools) ──

    @Override
    public Response listActionTypeTools(BigInteger actionTypeId) {
        // All tools are always available — access controlled by allowedTools
        findOrThrow(actionTypeId.longValue());
        List<ToolDefinitionEntity> allTools = ToolDefinitionEntity.listAll();
        return Response.ok(allTools).build();
    }

    @Override
    @Transactional
    public void updateActionTypeTools(BigInteger actionTypeId) {
        // No-op: tool access is controlled by the action type's allowedTools field
    }
}
