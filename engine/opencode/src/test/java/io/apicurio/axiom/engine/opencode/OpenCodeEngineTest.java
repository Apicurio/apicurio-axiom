package io.apicurio.axiom.engine.opencode;

import io.apicurio.axiom.engine.spi.AiEngineCheckResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link OpenCodeEngine} — type identifiers, provider methods, and
 * health check structure (without requiring a running OpenCode server).
 */
class OpenCodeEngineTest {

    @Test
    void testGetType() {
        OpenCodeEngine engine = new OpenCodeEngine();
        assertEquals("opencode", engine.getType());
    }

    @Test
    void testGetActorType() {
        OpenCodeEngine engine = new OpenCodeEngine();
        assertEquals("opencode", engine.getActorType());
    }

    @Test
    void testProviderReturnsItself() {
        OpenCodeEngine engine = new OpenCodeEngine();
        assertSame(engine, engine.getEngine());
    }

    @Test
    void testHealthCheckReturnsResults() {
        OpenCodeEngine engine = new OpenCodeEngine();
        List<AiEngineCheckResult> results = engine.healthCheck();

        assertNotNull(results);
        assertFalse(results.isEmpty());

        // Should have at least one result for "OpenCode CLI"
        AiEngineCheckResult cliCheck = results.stream()
                .filter(r -> r.name().contains("OpenCode"))
                .findFirst()
                .orElse(null);
        assertNotNull(cliCheck, "Should have an OpenCode CLI check result");
        // Status will be "ok" or "error" depending on whether opencode is installed
        assertTrue("ok".equals(cliCheck.status()) || "error".equals(cliCheck.status()));
    }
}
