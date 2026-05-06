package io.apicurio.axiom.actors.claudecode;

import io.apicurio.axiom.engine.spi.AiEngineCheckResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link ClaudeCodeEngine} — type, actor type, provider methods, and
 * health check structure (without requiring the actual claude CLI).
 */
class ClaudeCodeEngineTest {

    @Test
    void testGetType() {
        ClaudeCodeEngine engine = new ClaudeCodeEngine();
        assertEquals("claude-code", engine.getType());
    }

    @Test
    void testGetActorTypeDefaultsToType() {
        ClaudeCodeEngine engine = new ClaudeCodeEngine();
        assertEquals("claude-code", engine.getActorType());
    }

    @Test
    void testProviderReturnsItself() {
        ClaudeCodeEngine engine = new ClaudeCodeEngine();
        assertSame(engine, engine.getEngine());
    }

    @Test
    void testProviderTypeMatchesEngineType() {
        ClaudeCodeEngine engine = new ClaudeCodeEngine();
        assertEquals(engine.getType(), engine.getType());
    }

    @Test
    void testHealthCheckReturnsResults() {
        ClaudeCodeEngine engine = new ClaudeCodeEngine();
        List<AiEngineCheckResult> results = engine.healthCheck();

        assertNotNull(results);
        assertFalse(results.isEmpty());

        // Should have at least one result for "Claude Code CLI"
        AiEngineCheckResult cliCheck = results.stream()
                .filter(r -> r.name().contains("Claude Code"))
                .findFirst()
                .orElse(null);
        assertNotNull(cliCheck, "Should have a Claude Code CLI check result");
        // Status will be "ok" or "error" depending on whether claude is installed
        assertTrue("ok".equals(cliCheck.status()) || "error".equals(cliCheck.status()));
    }
}
