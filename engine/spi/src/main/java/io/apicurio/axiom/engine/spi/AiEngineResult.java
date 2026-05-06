package io.apicurio.axiom.engine.spi;

/**
 * Engine-agnostic result of an AI invocation. All engine implementations
 * map their internal result types to this record before returning to callers.
 *
 * @param result       the output text produced by the AI
 * @param sessionId    engine-specific session identifier (for potential resumption)
 * @param costUsd      cost in USD, or null if not tracked
 * @param inputTokens  number of input tokens consumed, or null if not tracked
 * @param outputTokens number of output tokens produced, or null if not tracked
 * @param success      true if the invocation completed successfully
 * @param executionLog human-readable execution transcript, or null if not captured
 */
public record AiEngineResult(
        String result,
        String sessionId,
        Double costUsd,
        Long inputTokens,
        Long outputTokens,
        boolean success,
        String executionLog
) {

    /**
     * Creates a successful result with only the output text.
     */
    public static AiEngineResult success(String result) {
        return new AiEngineResult(result, null, null, null, null, true, null);
    }

    /**
     * Creates a failed result with an error message.
     */
    public static AiEngineResult failure(String errorMessage) {
        return new AiEngineResult(errorMessage, null, null, null, null, false, null);
    }
}
