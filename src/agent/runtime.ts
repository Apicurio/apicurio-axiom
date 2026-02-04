/**
 * Agent Runtime
 *
 * Core agent execution loop that orchestrates the interaction between
 * the AI Agent, tools, and safety limits.
 *
 * The runtime:
 * 1. Maintains conversation state
 * 2. Sends messages to the AI Agent
 * 3. Executes tool calls
 * 4. Enforces safety limits
 * 5. Returns final results
 */

import type { Logger } from '../logging/logger.js';
import type { AgentConfig, ExecuteParams, ExecutionResult } from '../types/agent.js';
import type { VertexAISafety } from '../types/config';
import { Conversation } from './conversation.js';
import { SafetyLimits } from './safety.js';
import { ToolRegistry } from './tools/registry.js';
import { VertexClient } from './vertex-client.js';

export class AgentRuntime {
    private vertex: VertexClient;
    private safetyConfig: VertexAISafety;
    private logger: Logger;

    /**
     * Creates a new AgentRuntime instance
     *
     * @param config Configuration object
     * @param logger The logger to use
     */
    constructor(config: AgentConfig, logger: Logger) {
        this.vertex = new VertexClient(config.vertex, logger);
        this.safetyConfig = config.safety || {};
        this.logger = logger;

        this.logger.info('AgentRuntime initialized');
    }

    /**
     * Executes an agent task
     *
     * @param params Execution parameters
     * @returns Execution result
     */
    async execute(params: ExecuteParams): Promise<ExecutionResult> {
        const { systemPrompt, goal, tools, onStep, dryRun = false } = params;

        // Validate inputs
        if (!systemPrompt) {
            throw new Error('System prompt is required');
        }

        if (!goal) {
            throw new Error('Goal is required');
        }

        if (!(tools instanceof ToolRegistry)) {
            throw new Error('Tools must be a ToolRegistry instance');
        }

        // Initialize conversation and safety limits
        const conversation = new Conversation(systemPrompt, goal);
        const limits = new SafetyLimits(this.safetyConfig, this.logger);

        this.logger.info('');
        this.logger.info('=== Agent Execution Started ===');
        if (dryRun) {
            this.logger.info('⚠️  DRY-RUN MODE: Write operations will be simulated');
        }
        this.logger.info(`Goal: ${goal}`);
        this.logger.info(`Tools available: ${tools.getCount()}`);
        this.logger.info(
            `Safety limits: steps=${limits.maxSteps}, toolCalls=${limits.maxToolCalls}, tokens=${limits.maxTokens}`,
        );
        this.logger.info('');

        let stepNumber = 0;

        // Main agent loop
        while (!limits.exceeded() && !conversation.isComplete()) {
            stepNumber++;
            this.logger.info(`--- Step ${stepNumber} ---`);

            try {
                // Build API request
                const request = {
                    system: conversation.getSystemPrompt(),
                    messages: conversation.getMessages(),
                    tools: tools.getSchemas(),
                    max_tokens: Math.min(4096, limits.remainingTokens()),
                };

                // Call AI Agent
                this.logger.info(`Calling AI Agent with ${conversation.getMessageCount()} messages...`);
                const response = await this.vertex.createMessage(request);

                // Track token usage
                limits.addTokens(response.usage.input_tokens, response.usage.output_tokens);
                this.logger.info(
                    `Tokens used: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output`,
                );

                // Add assistant response to conversation
                conversation.addAssistantMessage(response);

                // Notify callback
                if (onStep) {
                    await onStep(stepNumber, conversation, response);
                }

                // Check stop reason
                if (response.stop_reason === 'end_turn') {
                    // Agent provided final answer
                    this.logger.info('Agent completed: end_turn');
                    conversation.markComplete(response);
                    break;
                } else if (response.stop_reason === 'tool_use') {
                    // Agent wants to use tools
                    const toolUses = response.content.filter((block) => block.type === 'tool_use');
                    this.logger.info(`Agent requested ${toolUses.length} tool call(s)`);

                    // Execute each tool call
                    for (const toolUse of toolUses) {
                        if (!toolUse.name || !toolUse.id) {
                            this.logger.warn('Tool use missing name or id, skipping');
                            continue;
                        }

                        this.logger.info(`  - ${toolUse.name}(${JSON.stringify(toolUse.input)})`);

                        const result = await tools.execute(toolUse.name, toolUse.input);
                        conversation.addToolResult(toolUse.id, result);

                        limits.addToolCalls(1);
                    }

                    limits.incrementStep();
                } else if (response.stop_reason === 'max_tokens') {
                    // Hit token limit in single response
                    this.logger.info('Agent stopped: max_tokens reached in response');
                    conversation.markComplete(response);
                    break;
                } else {
                    // Unknown stop reason
                    this.logger.info(`Agent stopped: ${response.stop_reason}`);
                    conversation.markComplete(response);
                    break;
                }
            } catch (error) {
                console.error(`Error in step ${stepNumber}:`, (error as Error).message);
                throw error;
            }
        }

        // Check if we hit safety limits
        if (limits.exceeded()) {
            const exceededLimit = limits.getExceededLimit();
            this.logger.info(`Agent stopped: safety limit exceeded (${exceededLimit})`);
        }

        // Compile final result
        const stats = limits.getStats();
        const result: ExecutionResult = {
            success: conversation.isComplete(),
            stopped_by_limit: limits.exceeded(),
            limit_exceeded: limits.getExceededLimit(),
            steps: stepNumber,
            tool_calls: stats.toolCalls.current,
            tokens: {
                input: stats.tokens.input,
                output: stats.tokens.output,
                total: stats.tokens.total,
            },
            final_text: conversation.getFinalText(),
            conversation: conversation,
        };

        this.logger.info('');
        this.logger.info('=== Agent Execution Complete ===');
        this.logger.info(`Steps: ${result.steps}`);
        this.logger.info(`Tool calls: ${result.tool_calls}`);
        this.logger.info(`Tokens: ${result.tokens.total} (${result.tokens.input} in, ${result.tokens.output} out)`);
        this.logger.info(`Success: ${result.success}`);
        if (result.stopped_by_limit) {
            this.logger.info(`Stopped by limit: ${result.limit_exceeded}`);
        }
        this.logger.info('');

        return result;
    }

    /**
     * Gets information about the runtime configuration
     *
     * @returns Runtime info
     */
    getInfo() {
        return {
            vertex: this.vertex.getInfo(),
            safety: this.safetyConfig,
        };
    }
}
