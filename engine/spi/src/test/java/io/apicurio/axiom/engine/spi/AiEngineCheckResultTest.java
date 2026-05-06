package io.apicurio.axiom.engine.spi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link AiEngineCheckResult} record.
 */
class AiEngineCheckResultTest {

    @Test
    void testOkResult() {
        AiEngineCheckResult result = new AiEngineCheckResult("Claude Code CLI", "ok",
                "Claude Code CLI is available and working.");

        assertEquals("Claude Code CLI", result.name());
        assertEquals("ok", result.status());
        assertEquals("Claude Code CLI is available and working.", result.message());
    }

    @Test
    void testErrorResult() {
        AiEngineCheckResult result = new AiEngineCheckResult("OpenCode CLI", "error",
                "Not installed");

        assertEquals("OpenCode CLI", result.name());
        assertEquals("error", result.status());
    }

    @Test
    void testRecordEquality() {
        AiEngineCheckResult a = new AiEngineCheckResult("test", "ok", "msg");
        AiEngineCheckResult b = new AiEngineCheckResult("test", "ok", "msg");

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
