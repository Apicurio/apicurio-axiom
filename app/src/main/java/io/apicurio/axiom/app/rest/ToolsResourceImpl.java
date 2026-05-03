package io.apicurio.axiom.app.rest;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.apicurio.axiom.api.ToolsResource;
import io.apicurio.axiom.api.beans.NewToolDefinition;
import io.apicurio.axiom.api.beans.ToolAiEditRequest;
import io.apicurio.axiom.api.beans.ToolAiEditResponse;
import io.apicurio.axiom.api.beans.ToolDefinition;
import io.apicurio.axiom.api.beans.ToolParameter;
import io.apicurio.axiom.app.ToolAiService;
import io.apicurio.axiom.core.entities.ToolDefinitionEntity;
import io.quarkus.panache.common.Sort;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

import java.math.BigInteger;
import java.util.List;

/**
 * Implementation of the Tools REST API.
 */
@ApplicationScoped
@RunOnVirtualThread
public class ToolsResourceImpl implements ToolsResource {

    @Inject
    ObjectMapper objectMapper;

    @Inject
    ToolAiService toolAiService;

    @Override
    public Response listTools() {
        List<ToolDefinition> tools = ToolDefinitionEntity.<ToolDefinitionEntity>listAll(Sort.ascending("name"))
                .stream()
                .map(this::toBean)
                .toList();
        return Response.ok(tools).build();
    }

    @Override
    @Transactional
    public ToolDefinition createTool(NewToolDefinition data) {
        ToolDefinitionEntity entity = new ToolDefinitionEntity();
        applyFields(entity, data);
        entity.persist();
        return toBean(entity);
    }

    @Override
    public ToolDefinition getTool(BigInteger toolId) {
        return toBean(findOrThrow(toolId.longValue()));
    }

    @Override
    @Transactional
    public ToolDefinition updateTool(BigInteger toolId, NewToolDefinition data) {
        ToolDefinitionEntity entity = findOrThrow(toolId.longValue());
        applyFields(entity, data);
        return toBean(entity);
    }

    @Override
    @Transactional
    public void deleteTool(BigInteger toolId) {
        ToolDefinitionEntity entity = findOrThrow(toolId.longValue());
        entity.delete();
    }

    // ── AI-Assisted Editing ────────────────────────────────────────

    /**
     * {@inheritDoc}
     */
    @Override
    public ToolAiEditResponse aiEditTool(ToolAiEditRequest data) {
        return toolAiService.editTool(data);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private ToolDefinitionEntity findOrThrow(long id) {
        ToolDefinitionEntity entity = ToolDefinitionEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Tool not found: " + id, 404);
        }
        return entity;
    }

    private void applyFields(ToolDefinitionEntity entity, NewToolDefinition data) {
        entity.name = data.getName();
        entity.description = data.getDescription();
        entity.scriptTemplate = data.getScriptTemplate();

        if (data.getParameters() != null) {
            try {
                entity.parameters = objectMapper.writeValueAsString(data.getParameters());
            } catch (Exception e) {
                entity.parameters = null;
            }
        }
    }

    private ToolDefinition toBean(ToolDefinitionEntity entity) {
        ToolDefinition tool = new ToolDefinition();
        tool.setId(entity.id);
        tool.setName(entity.name);
        tool.setDescription(entity.description);
        tool.setScriptTemplate(entity.scriptTemplate);

        if (entity.parameters != null) {
            try {
                List<ToolParameter> params = objectMapper.readValue(entity.parameters,
                        new TypeReference<List<ToolParameter>>() {});
                tool.setParameters(params);
            } catch (Exception e) {
                // ignore
            }
        }

        return tool;
    }
}
