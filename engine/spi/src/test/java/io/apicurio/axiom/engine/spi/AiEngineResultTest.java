package io.apicurio.axiom.engine.spi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link AiEngineResult} record — factories, field access, and semantics.
 */
class AiEngineResultTest {

    @Test
    void testSuccessFactory() {
        AiEngineResult result = AiEngineResult.success("hello world");

        assertTrue(result.success());
        assertEquals("hello world", result.result());
        assertNull(result.sessionId());
        assertNull(result.costUsd());
        assertNull(result.inputTokens());
        assertNull(result.outputTokens());
        assertNull(result.executionLog());
    }

    @Test
    void testFailureFactory() {
        AiEngineResult result = AiEngineResult.failure("something went wrong");

        assertFalse(result.success());
        assertEquals("something went wrong", result.result());
        assertNull(result.sessionId());
        assertNull(result.costUsd());
        assertNull(result.inputTokens());
        assertNull(result.outputTokens());
        assertNull(result.executionLog());
    }

    @Test
    void testFullConstructor() {
        AiEngineResult result = new AiEngineResult(
                "output text", "session-123", 0.0542, 1200L, 800L, true, "=== Log ===");

        assertTrue(result.success());
        assertEquals("output text", result.result());
        assertEquals("session-123", result.sessionId());
        assertEquals(0.0542, result.costUsd());
        assertEquals(1200L, result.inputTokens());
        assertEquals(800L, result.outputTokens());
        assertEquals("=== Log ===", result.executionLog());
    }

    @Test
    void testNullResult() {
        AiEngineResult result = AiEngineResult.success(null);

        assertTrue(result.success());
        assertNull(result.result());
    }

    @Test
    void testFailedWithNullMessage() {
        AiEngineResult result = AiEngineResult.failure(null);

        assertFalse(result.success());
        assertNull(result.result());
    }

    @Test
    void testRecordEquality() {
        AiEngineResult a = new AiEngineResult("x", "s1", 1.0, 10L, 20L, true, null);
        AiEngineResult b = new AiEngineResult("x", "s1", 1.0, 10L, 20L, true, null);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
