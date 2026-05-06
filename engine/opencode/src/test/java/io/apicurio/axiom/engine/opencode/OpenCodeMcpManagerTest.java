package io.apicurio.axiom.engine.opencode;

import io.apicurio.axiom.engine.opencode.OpenCodeMcpManager.McpServerConfig;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link OpenCodeMcpManager} — delegate pattern, McpServerConfig
 * record, and behavior without a running server.
 */
class OpenCodeMcpManagerTest {

    // --- McpServerConfig record tests ---

    @Test
    void testLocalServerConfig() {
        McpServerConfig config = McpServerConfig.local(
                "axiom-tools",
                List.of("node", "/path/server.js", "/path/tools.json"),
                Map.of("GH_TOKEN", "ghp_xxx")
        );

        assertEquals("axiom-tools", config.name());
        assertEquals("local", config.type());
        assertEquals(List.of("node", "/path/server.js", "/path/tools.json"), config.command());
        assertEquals(Map.of("GH_TOKEN", "ghp_xxx"), config.environment());
        assertNull(config.url());
    }

    @Test
    void testRemoteServerConfig() {
        McpServerConfig config = McpServerConfig.remote(
                "external-mcp", "https://mcp.example.com/mcp"
        );

        assertEquals("external-mcp", config.name());
        assertEquals("remote", config.type());
        assertNull(config.command());
        assertNull(config.environment());
        assertEquals("https://mcp.example.com/mcp", config.url());
    }

    @Test
    void testLocalServerConfigWithEmptyEnv() {
        McpServerConfig config = McpServerConfig.local(
                "test-server", List.of("python", "server.py"), Map.of()
        );

        assertEquals("test-server", config.name());
        assertTrue(config.environment().isEmpty());
    }

    // --- Delegate pattern tests ---

    @Test
    void testConfigureWithoutDelegateReturnsNull() {
        OpenCodeMcpManager manager = new OpenCodeMcpManager();
        // No delegate set — should return null gracefully
        Path result = manager.configureMcpServers(1L, Map.of(), List.of("Read"));

        assertNull(result, "Should return null when no delegate is set");
    }

    @Test
    void testCleanupDoesNotThrow() {
        OpenCodeMcpManager manager = new OpenCodeMcpManager();
        // Cleanup should be a no-op and not throw
        assertDoesNotThrow(() -> manager.cleanup(1L));
    }

    @Test
    void testSetDelegate() {
        OpenCodeMcpManager manager = new OpenCodeMcpManager();

        // Set a delegate that returns an empty list
        manager.setDelegate((taskId, env, tools) -> List.of());

        // configureMcpServers will call the delegate but can't register
        // (no engine/client available in unit test), so it returns null
        Path result = manager.configureMcpServers(1L, Map.of(), List.of());
        assertNull(result);
    }

    @Test
    void testConfigureWithNullAllowedTools() {
        OpenCodeMcpManager manager = new OpenCodeMcpManager();
        manager.setDelegate((taskId, env, tools) -> List.of());

        // Should handle null allowed tools gracefully
        Path result = manager.configureMcpServers(1L, Map.of(), null);
        assertNull(result);
    }

    // --- McpServerConfig equality ---

    @Test
    void testConfigRecordEquality() {
        McpServerConfig a = McpServerConfig.remote("s1", "http://example.com");
        McpServerConfig b = McpServerConfig.remote("s1", "http://example.com");

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void testConfigRecordInequality() {
        McpServerConfig a = McpServerConfig.remote("s1", "http://a.com");
        McpServerConfig b = McpServerConfig.remote("s1", "http://b.com");

        assertNotEquals(a, b);
    }
}
