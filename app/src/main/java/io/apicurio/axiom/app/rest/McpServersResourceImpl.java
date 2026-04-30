package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.api.McpResource;
import io.apicurio.axiom.api.beans.McpServer;
import io.apicurio.axiom.api.beans.NewMcpServer;
import io.apicurio.axiom.core.entities.McpServerEntity;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;

import java.util.List;

/**
 * Implementation of the MCP Servers REST API.
 */
@ApplicationScoped
@RunOnVirtualThread
public class McpServersResourceImpl implements McpResource {

    /**
     * {@inheritDoc}
     */
    @Override
    public List<McpServer> listMcpServers() {
        return McpServerEntity.<McpServerEntity>listAll()
                .stream().map(this::toBean).toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public McpServer createMcpServer(NewMcpServer data) {
        McpServerEntity entity = new McpServerEntity();
        applyFields(entity, data);
        entity.persist();
        return toBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public McpServer getMcpServer(long mcpServerId) {
        return toBean(findOrThrow(mcpServerId));
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public McpServer updateMcpServer(long mcpServerId, NewMcpServer data) {
        McpServerEntity entity = findOrThrow(mcpServerId);
        applyFields(entity, data);
        return toBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void deleteMcpServer(long mcpServerId) {
        McpServerEntity entity = findOrThrow(mcpServerId);
        entity.delete();
    }

    private McpServerEntity findOrThrow(long id) {
        McpServerEntity entity = McpServerEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("MCP server not found: " + id, 404);
        }
        return entity;
    }

    private void applyFields(McpServerEntity entity, NewMcpServer data) {
        entity.name = data.getName();
        entity.description = data.getDescription();
        entity.serverCommand = data.getServerCommand();
        entity.serverUrl = data.getServerUrl();
        // Store args and env as JSON strings
        if (data.getServerArgs() != null) {
            try {
                entity.serverArgs = new com.fasterxml.jackson.databind.ObjectMapper()
                        .writeValueAsString(data.getServerArgs());
            } catch (Exception e) {
                entity.serverArgs = null;
            }
        }
        if (data.getServerEnv() != null) {
            try {
                entity.serverEnv = new com.fasterxml.jackson.databind.ObjectMapper()
                        .writeValueAsString(data.getServerEnv());
            } catch (Exception e) {
                entity.serverEnv = null;
            }
        }
    }

    private McpServer toBean(McpServerEntity entity) {
        McpServer server = new McpServer();
        server.setId(entity.id);
        server.setName(entity.name);
        server.setDescription(entity.description);
        server.setServerCommand(entity.serverCommand);
        server.setServerUrl(entity.serverUrl);
        if (entity.serverArgs != null) {
            try {
                server.setServerArgs(new com.fasterxml.jackson.databind.ObjectMapper()
                        .readValue(entity.serverArgs,
                                new com.fasterxml.jackson.core.type.TypeReference<java.util.List<String>>() {}));
            } catch (Exception e) { /* ignore */ }
        }
        return server;
    }
}
