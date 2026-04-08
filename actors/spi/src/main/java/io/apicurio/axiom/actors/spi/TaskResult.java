package io.apicurio.axiom.actors.spi;

/**
 * The result produced by an Actor after completing a task.
 */
public class TaskResult {

    private final boolean success;
    private final String output;
    private final String sessionId;
    private final Double costUsd;
    private final Long inputTokens;
    private final Long outputTokens;
    private final String errorMessage;

    private TaskResult(Builder builder) {
        this.success = builder.success;
        this.output = builder.output;
        this.sessionId = builder.sessionId;
        this.costUsd = builder.costUsd;
        this.inputTokens = builder.inputTokens;
        this.outputTokens = builder.outputTokens;
        this.errorMessage = builder.errorMessage;
    }

    /**
     * @return true if the task completed successfully
     */
    public boolean isSuccess() {
        return success;
    }

    /**
     * @return the output text produced by the actor
     */
    public String getOutput() {
        return output;
    }

    /**
     * @return the Claude Code session ID (for potential resumption)
     */
    public String getSessionId() {
        return sessionId;
    }

    /**
     * @return the cost in USD, or null if not tracked
     */
    public Double getCostUsd() {
        return costUsd;
    }

    /**
     * @return the number of input tokens consumed, or null if not tracked
     */
    public Long getInputTokens() {
        return inputTokens;
    }

    /**
     * @return the number of output tokens produced, or null if not tracked
     */
    public Long getOutputTokens() {
        return outputTokens;
    }

    /**
     * @return the error message if the task failed, or null if successful
     */
    public String getErrorMessage() {
        return errorMessage;
    }

    /**
     * Creates a successful result.
     *
     * @return a new builder for a successful result
     */
    public static Builder success(String output) {
        return new Builder(true, output);
    }

    /**
     * Creates a failed result.
     *
     * @return a new builder for a failed result
     */
    public static Builder failure(String errorMessage) {
        return new Builder(false, null).errorMessage(errorMessage);
    }

    public static class Builder {
        private final boolean success;
        private String output;
        private String sessionId;
        private Double costUsd;
        private Long inputTokens;
        private Long outputTokens;
        private String errorMessage;

        private Builder(boolean success, String output) {
            this.success = success;
            this.output = output;
        }

        public Builder sessionId(String sessionId) {
            this.sessionId = sessionId;
            return this;
        }

        public Builder costUsd(Double costUsd) {
            this.costUsd = costUsd;
            return this;
        }

        public Builder inputTokens(Long inputTokens) {
            this.inputTokens = inputTokens;
            return this;
        }

        public Builder outputTokens(Long outputTokens) {
            this.outputTokens = outputTokens;
            return this;
        }

        public Builder errorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
            return this;
        }

        public TaskResult build() {
            return new TaskResult(this);
        }
    }
}
