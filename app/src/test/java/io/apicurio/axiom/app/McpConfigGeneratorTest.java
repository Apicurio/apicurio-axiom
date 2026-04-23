package io.apicurio.axiom.app;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.apicurio.axiom.core.entities.ToolDefinitionEntity;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for the MCP configuration generator. Verifies that the generated
 * MCP config JSON and tools JSON files have the correct structure and content.
 *
 * <p>These tests use the seeded tool data from {@link SeedDataInitializer},
 * which includes three built-in script tools: post_github_comment,
 * add_github_labels, and create_github_pr.</p>
 */
@QuarkusTest
class McpConfigGeneratorTest {

    @Inject
    McpConfigGenerator generator;

    @Inject
    ObjectMapper objectMapper;

    // ── generateMcpConfig with seeded script tools ───────────────────

    @Test
    void testGenerateMcpConfigProducesValidJson() throws Exception {
        Map<String, String> env = Map.of("GH_TOKEN", "test-token-123");

        Path configFile = generator.generateMcpConfig(9001L, env, null);
        assertNotNull(configFile, "Config file should be generated when tools exist");
        assertTrue(Files.exists(configFile), "Config file should exist on disk");

        String content = Files.readString(configFile);
        JsonNode config = objectMapper.readTree(content);

        assertTrue(config.has("mcpServers"), "Config should have mcpServers key");
        JsonNode servers = config.get("mcpServers");
        assertTrue(servers.has("axiom-tools"), "Should have axiom-tools server for script tools");
    }

    @Test
    void testAxiomToolsServerConfig() throws Exception {
        Map<String, String> env = Map.of("GH_TOKEN", "test-token-value");

        Path configFile = generator.generateMcpConfig(9002L, env, null);
        String content = Files.readString(configFile);
        JsonNode config = objectMapper.readTree(content);

        JsonNode axiomTools = config.get("mcpServers").get("axiom-tools");
        assertNotNull(axiomTools, "axiom-tools server should be present");

        // Command should be "node"
        assertEquals("node", axiomTools.get("command").asText());

        // Args should have two entries: server.js path and tools JSON path
        JsonNode args = axiomTools.get("args");
        assertTrue(args.isArray(), "args should be an array");
        assertEquals(2, args.size(), "args should have server.js path and tools JSON path");

        String serverJsPath = args.get(0).asText();
        String toolsJsonPath = args.get(1).asText();

        assertTrue(serverJsPath.endsWith("server.js"), "First arg should be server.js path");
        assertTrue(toolsJsonPath.contains("axiom-tools-9002"), "Second arg should contain task ID");

        // Both files should exist
        assertTrue(Files.exists(Path.of(serverJsPath)), "server.js should exist");
        assertTrue(Files.exists(Path.of(toolsJsonPath)), "tools JSON should exist");
    }

    @Test
    void testEnvironmentVariablesInConfig() throws Exception {
        Map<String, String> env = Map.of(
                "GH_TOKEN", "ghp_test123",
                "GITHUB_TOKEN", "ghp_test456"
        );

        Path configFile = generator.generateMcpConfig(9003L, env, null);
        String content = Files.readString(configFile);
        JsonNode config = objectMapper.readTree(content);

        JsonNode axiomToolsEnv = config.get("mcpServers").get("axiom-tools").get("env");
        assertNotNull(axiomToolsEnv, "env should be present");
        assertEquals("ghp_test123", axiomToolsEnv.get("GH_TOKEN").asText());
        assertEquals("ghp_test456", axiomToolsEnv.get("GITHUB_TOKEN").asText());
    }

    @Test
    void testEmptyEnvironment() throws Exception {
        Map<String, String> env = Map.of();

        Path configFile = generator.generateMcpConfig(9004L, env, null);
        String content = Files.readString(configFile);
        JsonNode config = objectMapper.readTree(content);

        JsonNode axiomToolsEnv = config.get("mcpServers").get("axiom-tools").get("env");
        assertNotNull(axiomToolsEnv, "env key should still be present");
        assertEquals(0, axiomToolsEnv.size(), "env should be empty");
    }

    // ── Tools JSON file content ──────────────────────────────────────

    @Test
    void testToolsJsonContainsSeededTools() throws Exception {
        Path configFile = generator.generateMcpConfig(9005L, Map.of(), null);
        String content = Files.readString(configFile);
        JsonNode config = objectMapper.readTree(content);

        // Read the tools JSON file referenced in the config
        String toolsJsonPath = config.get("mcpServers").get("axiom-tools")
                .get("args").get(1).asText();
        String toolsContent = Files.readString(Path.of(toolsJsonPath));
        JsonNode tools = objectMapper.readTree(toolsContent);

        assertTrue(tools.isArray(), "Tools should be a JSON array");
        assertTrue(tools.size() >= 3, "Should have at least 3 seeded script tools");

        // Verify expected tool names are present
        boolean hasPostComment = false;
        boolean hasAddLabels = false;
        boolean hasCreatePr = false;
        for (JsonNode tool : tools) {
            String name = tool.get("name").asText();
            if ("post_github_comment".equals(name)) hasPostComment = true;
            if ("add_github_labels".equals(name)) hasAddLabels = true;
            if ("create_github_pr".equals(name)) hasCreatePr = true;
        }
        assertTrue(hasPostComment, "Should contain post_github_comment tool");
        assertTrue(hasAddLabels, "Should contain add_github_labels tool");
        assertTrue(hasCreatePr, "Should contain create_github_pr tool");
    }

    @Test
    void testToolJsonStructure() throws Exception {
        Path configFile = generator.generateMcpConfig(9006L, Map.of(), null);
        String content = Files.readString(configFile);
        JsonNode config = objectMapper.readTree(content);

        String toolsJsonPath = config.get("mcpServers").get("axiom-tools")
                .get("args").get(1).asText();
        JsonNode tools = objectMapper.readTree(Files.readString(Path.of(toolsJsonPath)));

        // Find the post_github_comment tool and verify its structure
        JsonNode postCommentTool = null;
        for (JsonNode tool : tools) {
            if ("post_github_comment".equals(tool.get("name").asText())) {
                postCommentTool = tool;
                break;
            }
        }
        assertNotNull(postCommentTool, "post_github_comment tool should exist");
        assertTrue(postCommentTool.has("description"), "Tool should have description");
        assertTrue(postCommentTool.has("scriptTemplate"), "Tool should have scriptTemplate");
        assertTrue(postCommentTool.has("parameters"), "Tool should have parameters");

        // Verify parameters structure
        JsonNode params = postCommentTool.get("parameters");
        assertTrue(params.isArray(), "Parameters should be an array");
        assertTrue(params.size() >= 3, "post_github_comment should have at least 3 parameters");

        // Verify each parameter has required fields
        for (JsonNode param : params) {
            assertTrue(param.has("name"), "Parameter should have name");
            assertTrue(param.has("type"), "Parameter should have type");
            assertTrue(param.has("description"), "Parameter should have description");
            assertTrue(param.has("required"), "Parameter should have required flag");
        }
    }

    // ── MCP server installation ──────────────────────────────────────

    @Test
    void testMcpServerProjectInstalled() throws Exception {
        // Trigger installation by generating config
        generator.generateMcpConfig(9007L, Map.of(), null);

        Path serverDir = Path.of(System.getProperty("user.home"), ".axiom", "mcp-server");
        assertTrue(Files.exists(serverDir), "MCP server directory should exist");
        assertTrue(Files.exists(serverDir.resolve("package.json")), "package.json should exist");
        assertTrue(Files.exists(serverDir.resolve("server.js")), "server.js should exist");
        assertTrue(Files.exists(serverDir.resolve("node_modules")),
                "node_modules should exist after npm install");
    }

    @Test
    void testMultipleCallsReuseInstalledServer() throws Exception {
        // Generate two configs — both should reference the same server.js
        Path config1 = generator.generateMcpConfig(9008L, Map.of(), null);
        Path config2 = generator.generateMcpConfig(9009L, Map.of(), null);

        JsonNode cfg1 = objectMapper.readTree(Files.readString(config1));
        JsonNode cfg2 = objectMapper.readTree(Files.readString(config2));

        String serverJs1 = cfg1.get("mcpServers").get("axiom-tools").get("args").get(0).asText();
        String serverJs2 = cfg2.get("mcpServers").get("axiom-tools").get("args").get(0).asText();
        assertEquals(serverJs1, serverJs2, "Both configs should reference the same server.js");

        // But the tools JSON files should be different (per-task)
        String toolsJson1 = cfg1.get("mcpServers").get("axiom-tools").get("args").get(1).asText();
        String toolsJson2 = cfg2.get("mcpServers").get("axiom-tools").get("args").get(1).asText();
        assertNotEquals(toolsJson1, toolsJson2,
                "Each task should get its own tools JSON file");
    }

    // ── External MCP server tools ────────────────────────────────────

    @Test
    @Transactional
    void testExternalMcpServerStdioInConfig() throws Exception {
        // Create a temporary external MCP server tool
        ToolDefinitionEntity mcpTool = new ToolDefinitionEntity();
        mcpTool.name = "test-external-stdio";
        mcpTool.description = "Test external MCP server (stdio)";
        mcpTool.type = "mcp-server";
        mcpTool.serverCommand = "npx";
        mcpTool.serverArgs = "[\"-y\", \"@test/mcp-server\"]";
        mcpTool.serverEnv = "{\"API_KEY\": \"test-key\"}";
        mcpTool.persist();

        try {
            Path configFile = generator.generateMcpConfig(9010L, Map.of(), null);
            String content = Files.readString(configFile);
            JsonNode config = objectMapper.readTree(content);

            JsonNode servers = config.get("mcpServers");
            assertTrue(servers.has("test-external-stdio"),
                    "Config should include the external MCP server");

            JsonNode extServer = servers.get("test-external-stdio");
            assertEquals("npx", extServer.get("command").asText());

            JsonNode args = extServer.get("args");
            assertTrue(args.isArray());
            assertEquals("-y", args.get(0).asText());
            assertEquals("@test/mcp-server", args.get(1).asText());

            JsonNode env = extServer.get("env");
            assertEquals("test-key", env.get("API_KEY").asText());
        } finally {
            mcpTool.delete();
        }
    }

    @Test
    @Transactional
    void testExternalMcpServerHttpInConfig() throws Exception {
        ToolDefinitionEntity mcpTool = new ToolDefinitionEntity();
        mcpTool.name = "test-external-http";
        mcpTool.description = "Test external MCP server (HTTP)";
        mcpTool.type = "mcp-server";
        mcpTool.serverUrl = "http://localhost:8080/mcp";
        mcpTool.persist();

        try {
            Path configFile = generator.generateMcpConfig(9011L, Map.of(), null);
            String content = Files.readString(configFile);
            JsonNode config = objectMapper.readTree(content);

            JsonNode servers = config.get("mcpServers");
            assertTrue(servers.has("test-external-http"),
                    "Config should include the HTTP MCP server");

            JsonNode extServer = servers.get("test-external-http");
            assertEquals("http", extServer.get("type").asText());
            assertEquals("http://localhost:8080/mcp", extServer.get("url").asText());
        } finally {
            mcpTool.delete();
        }
    }

    // ── Edge cases ───────────────────────────────────────────────────

    @Test
    @Transactional
    void testNoToolsReturnsNull() throws Exception {
        // Temporarily remove all tools
        long originalCount = ToolDefinitionEntity.count();
        List<ToolDefinitionEntity> saved = ToolDefinitionEntity.<ToolDefinitionEntity>listAll()
                .stream().toList();

        ToolDefinitionEntity.deleteAll();
        try {
            Path configFile = generator.generateMcpConfig(9012L, Map.of(), null);
            assertNull(configFile, "Should return null when no tools are defined");
        } finally {
            // Restore tools
            for (ToolDefinitionEntity tool : saved) {
                ToolDefinitionEntity restored = new ToolDefinitionEntity();
                restored.name = tool.name;
                restored.description = tool.description;
                restored.type = tool.type;
                restored.parameters = tool.parameters;
                restored.scriptTemplate = tool.scriptTemplate;
                restored.serverCommand = tool.serverCommand;
                restored.serverArgs = tool.serverArgs;
                restored.serverEnv = tool.serverEnv;
                restored.serverUrl = tool.serverUrl;
                restored.persist();
            }
        }
    }

    @Test
    @Transactional
    void testOnlyExternalMcpServersNoAxiomTools() throws Exception {
        // Temporarily remove all tools and add only an MCP server
        List<ToolDefinitionEntity> saved = ToolDefinitionEntity.<ToolDefinitionEntity>listAll()
                .stream().toList();
        ToolDefinitionEntity.deleteAll();

        ToolDefinitionEntity mcpOnly = new ToolDefinitionEntity();
        mcpOnly.name = "test-mcp-only";
        mcpOnly.description = "Only MCP server, no script tools";
        mcpOnly.type = "mcp-server";
        mcpOnly.serverUrl = "http://localhost:9999/mcp";
        mcpOnly.persist();

        try {
            Path configFile = generator.generateMcpConfig(9013L, Map.of(), null);
            assertNotNull(configFile, "Should generate config for MCP server tools");

            String content = Files.readString(configFile);
            JsonNode config = objectMapper.readTree(content);
            JsonNode servers = config.get("mcpServers");

            assertFalse(servers.has("axiom-tools"),
                    "Should NOT have axiom-tools when no script tools exist");
            assertTrue(servers.has("test-mcp-only"),
                    "Should have the external MCP server");
        } finally {
            ToolDefinitionEntity.deleteAll();
            for (ToolDefinitionEntity tool : saved) {
                ToolDefinitionEntity restored = new ToolDefinitionEntity();
                restored.name = tool.name;
                restored.description = tool.description;
                restored.type = tool.type;
                restored.parameters = tool.parameters;
                restored.scriptTemplate = tool.scriptTemplate;
                restored.serverCommand = tool.serverCommand;
                restored.serverArgs = tool.serverArgs;
                restored.serverEnv = tool.serverEnv;
                restored.serverUrl = tool.serverUrl;
                restored.persist();
            }
        }
    }

    @Test
    void testUniqueConfigFilePerTask() throws Exception {
        Path config1 = generator.generateMcpConfig(9014L, Map.of(), null);
        Path config2 = generator.generateMcpConfig(9015L, Map.of(), null);

        assertNotEquals(config1, config2, "Each task should get a unique config file");
        assertTrue(config1.getFileName().toString().contains("9014"),
                "Config filename should contain task ID");
        assertTrue(config2.getFileName().toString().contains("9015"),
                "Config filename should contain task ID");
    }
}
