/**
 * Safety Limits
 *
 * Enforces hard limits on agent execution to prevent runaway costs,
 * infinite loops, and other problematic behaviors.
 */

import type { Logger } from '../logging/logger.js';
import type { SafetyConfig, SafetyStats } from '../types/agent.js';

export class SafetyLimits {
    public maxSteps: number;
    public maxToolCalls: number;
    public maxTokens: number;
    private currentSteps: number;
    private currentToolCalls: number;
    private currentInputTokens: number;
    private currentOutputTokens: number;
    private logger: Logger;

    /**
     * Creates a new SafetyLimits instance
     *
     * @param config Configuration object
     * @param logger The logger to use
     */
    constructor(config: SafetyConfig = {}, logger: Logger) {
        this.maxSteps = config.maxSteps || 20;
        this.maxToolCalls = config.maxToolCalls || 50;
        this.maxTokens = config.maxTokens || 100000;

        // Current counters
        this.currentSteps = 0;
        this.currentToolCalls = 0;
        this.currentInputTokens = 0;
        this.currentOutputTokens = 0;

        this.logger = logger;

        this.logger.info(
            `SafetyLimits initialized: maxSteps=${this.maxSteps}, maxToolCalls=${this.maxToolCalls}, maxTokens=${this.maxTokens}`,
        );
    }

    /**
     * Checks if any limits have been exceeded
     *
     * @returns True if limits exceeded
     */
    exceeded(): boolean {
        const totalTokens = this.currentInputTokens + this.currentOutputTokens;

        if (this.currentSteps >= this.maxSteps) {
            return true;
        }

        if (this.currentToolCalls >= this.maxToolCalls) {
            return true;
        }

        if (totalTokens >= this.maxTokens) {
            return true;
        }

        return false;
    }

    /**
     * Gets which limit was exceeded (if any)
     *
     * @returns Name of exceeded limit or null
     */
    getExceededLimit(): string | null {
        const totalTokens = this.currentInputTokens + this.currentOutputTokens;

        if (this.currentSteps >= this.maxSteps) {
            return `steps (${this.currentSteps}/${this.maxSteps})`;
        }

        if (this.currentToolCalls >= this.maxToolCalls) {
            return `tool_calls (${this.currentToolCalls}/${this.maxToolCalls})`;
        }

        if (totalTokens >= this.maxTokens) {
            return `tokens (${totalTokens}/${this.maxTokens})`;
        }

        return null;
    }

    /**
     * Increments the step counter
     */
    incrementStep(): void {
        this.currentSteps++;
    }

    /**
     * Increments the tool call counter
     *
     * @param count Number of tool calls to add
     */
    addToolCalls(count: number = 1): void {
        this.currentToolCalls += count;
    }

    /**
     * Adds token usage
     *
     * @param inputTokens Input tokens used
     * @param outputTokens Output tokens used
     */
    addTokens(inputTokens: number, outputTokens: number): void {
        this.currentInputTokens += inputTokens;
        this.currentOutputTokens += outputTokens;
    }

    /**
     * Gets current usage statistics
     *
     * @returns Current usage stats
     */
    getStats(): SafetyStats {
        return {
            steps: {
                current: this.currentSteps,
                max: this.maxSteps,
                remaining: Math.max(0, this.maxSteps - this.currentSteps),
            },
            toolCalls: {
                current: this.currentToolCalls,
                max: this.maxToolCalls,
                remaining: Math.max(0, this.maxToolCalls - this.currentToolCalls),
            },
            tokens: {
                input: this.currentInputTokens,
                output: this.currentOutputTokens,
                total: this.currentInputTokens + this.currentOutputTokens,
                current: this.currentInputTokens + this.currentOutputTokens,
                max: this.maxTokens,
                remaining: Math.max(0, this.maxTokens - (this.currentInputTokens + this.currentOutputTokens)),
            },
        };
    }

    /**
     * Calculates remaining tokens for next request
     *
     * @returns Remaining token budget
     */
    remainingTokens(): number {
        const used = this.currentInputTokens + this.currentOutputTokens;
        return Math.max(0, this.maxTokens - used);
    }

    /**
     * Resets all counters
     */
    reset(): void {
        this.currentSteps = 0;
        this.currentToolCalls = 0;
        this.currentInputTokens = 0;
        this.currentOutputTokens = 0;
    }
}
