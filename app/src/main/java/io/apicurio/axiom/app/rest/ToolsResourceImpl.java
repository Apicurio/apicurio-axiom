package io.apicurio.axiom.app.rest;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.apicurio.axiom.api.ToolsResource;
import io.apicurio.axiom.api.beans.NewToolDefinition;
import io.apicurio.axiom.api.beans.ToolDefinition;
import io.apicurio.axiom.api.beans.ToolParameter;
import io.apicurio.axiom.core.entities.ToolDefinitionEntity;
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

    @Override
    public Response listTools() {
        List<ToolDefinition> tools = ToolDefinitionEntity.<ToolDefinitionEntity>listAll()
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
        entity.type = data.getType().value();
        entity.scriptTemplate = data.getScriptTemplate();
        entity.serverCommand = data.getServerCommand();
        entity.serverUrl = data.getServerUrl();

        // Serialize parameters as JSON
        if (data.getParameters() != null) {
            try {
                entity.parameters = objectMapper.writeValueAsString(data.getParameters());
            } catch (Exception e) {
                entity.parameters = null;
            }
        }

        // Serialize server args as JSON
        if (data.getServerArgs() != null) {
            try {
                entity.serverArgs = objectMapper.writeValueAsString(data.getServerArgs());
            } catch (Exception e) {
                entity.serverArgs = null;
            }
        }

        // Serialize server env as JSON
        if (data.getServerEnv() != null) {
            try {
                entity.serverEnv = objectMapper.writeValueAsString(data.getServerEnv());
            } catch (Exception e) {
                entity.serverEnv = null;
            }
        }
    }

    private ToolDefinition toBean(ToolDefinitionEntity entity) {
        ToolDefinition tool = new ToolDefinition();
        tool.setId(entity.id);
        tool.setName(entity.name);
        tool.setDescription(entity.description);
        tool.setType(ToolDefinition.Type.fromValue(entity.type));
        tool.setScriptTemplate(entity.scriptTemplate);
        tool.setServerCommand(entity.serverCommand);
        tool.setServerUrl(entity.serverUrl);

        // Deserialize parameters from JSON
        if (entity.parameters != null) {
            try {
                List<ToolParameter> params = objectMapper.readValue(entity.parameters,
                        new TypeReference<List<ToolParameter>>() {});
                tool.setParameters(params);
            } catch (Exception e) {
                // ignore
            }
        }

        // Deserialize server args from JSON
        if (entity.serverArgs != null) {
            try {
                List<String> args = objectMapper.readValue(entity.serverArgs,
                        new TypeReference<List<String>>() {});
                tool.setServerArgs(args);
            } catch (Exception e) {
                // ignore
            }
        }

        return tool;
    }
}
