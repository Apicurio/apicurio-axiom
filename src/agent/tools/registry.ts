/**
 * Tool Registry
 *
 * Manages the allow-list of tools available to the agent.
 * Provides tool schemas to AI Agent and executes tool calls safely.
 */

import type { Tool, ToolContext, ToolResult, ToolSchema } from '../../types/agent.js';

export class ToolRegistry {
    private tools: Map<string, Tool>;
    private context: ToolContext;

    /**
     * Creates a new ToolRegistry instance
     *
     * @param context Tool execution context (includes logger, dryRun, workDir, etc.)
     */
    constructor(context: ToolContext) {
        this.tools = new Map();
        this.context = context;

        if (context.dryRun) {
            context.logger.info('⚠️  ToolRegistry in DRY-RUN mode - write operations will be simulated');
        }
    }

    /**
     * Registers a tool for use by the agent
     *
     * A tool must have:
     * - name: string
     * - description: string
     * - input_schema: object (JSON schema)
     * - execute: async function(input) => result
     *
     * @param tool Tool object
     */
    register(tool: Tool): void {
        if (!tool.name) {
            throw new Error('Tool must have a name');
        }

        if (!tool.description) {
            throw new Error(`Tool "${tool.name}" must have a description`);
        }

        if (!tool.input_schema) {
            throw new Error(`Tool "${tool.name}" must have an input_schema`);
        }

        if (typeof tool.execute !== 'function') {
            throw new Error(`Tool "${tool.name}" must have an execute function`);
        }

        this.tools.set(tool.name, tool);
        this.context.logger.info(`Registered tool: ${tool.name}`);
    }

    /**
     * Gets the schemas for all registered tools
     * (in the format expected by Claude's API)
     *
     * @returns Array of tool schemas
     */
    getSchemas(): ToolSchema[] {
        return Array.from(this.tools.values()).map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
        }));
    }

    /**
     * Truncates a tool result to stay within token limits
     *
     * @param result Tool result (any type)
     * @param maxTokens Maximum tokens allowed (approximate)
     * @returns Truncated result
     */
    private truncateResult(result: any, maxTokens: number): any {
        // If no limit configured, return as-is
        if (!maxTokens || maxTokens <= 0) {
            return result;
        }

        // Approximate: 1 token ≈ 4 characters
        const maxChars = maxTokens * 4;

        // Convert result to string for size checking
        const resultString = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

        // If under limit, return original result
        if (resultString.length <= maxChars) {
            return result;
        }

        // Truncate and add notice
        const truncated = resultString.substring(0, maxChars);
        const removedChars = resultString.length - maxChars;
        const removedTokens = Math.ceil(removedChars / 4);

        // Try to parse back to original type if it was JSON
        if (typeof result !== 'string') {
            try {
                return JSON.parse(
                    truncated + `\n\n[... TRUNCATED: removed ~${removedTokens} tokens (${removedChars} chars) ...]`,
                );
            } catch {
                // If can't parse, return as string with notice
                return truncated + `\n\n[... TRUNCATED: removed ~${removedTokens} tokens (${removedChars} chars) ...]`;
            }
        }

        return truncated + `\n\n[... TRUNCATED: removed ~${removedTokens} tokens (${removedChars} chars) ...]`;
    }

    /**
     * Executes a tool by name
     *
     * In dry-run mode, calls the tool's executeMock method instead of execute.
     *
     * @param name Tool name
     * @param input Tool input parameters
     * @returns Tool execution result
     */
    async execute(name: string, input: any): Promise<any> {
        const tool = this.tools.get(name);

        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }

        try {
            if (this.context.dryRun) {
                this.context.logger.info(`🔸 [DRY-RUN] Simulating tool: ${name}`);
                this.context.logger.info(`🔸 [DRY-RUN] Input: ${JSON.stringify(input, null, 2)}`);
                const result = await tool.executeMock(input, this.context);
                this.context.logger.info(`🔸 [DRY-RUN] Simulated result: ${JSON.stringify(result, null, 2)}`);
                const truncatedResult = this.truncateResult(result, this.context.maxToolOutputTokens || 0);
                return truncatedResult;
            } else {
                this.context.logger.info(`Executing tool: ${name}`);
                const result = await tool.execute(input, this.context);
                this.context.logger.info(`Tool completed: ${name}`);

                // Truncate result if it exceeds token limit
                const truncatedResult = this.truncateResult(result, this.context.maxToolOutputTokens || 0);

                // Log if truncation occurred
                if (this.context.maxToolOutputTokens && this.context.maxToolOutputTokens > 0) {
                    const resultString = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                    const maxChars = this.context.maxToolOutputTokens * 4;
                    if (resultString.length > maxChars) {
                        const removedTokens = Math.ceil((resultString.length - maxChars) / 4);
                        this.context.logger.info(
                            `Tool output truncated: removed ~${removedTokens} tokens to stay within ${this.context.maxToolOutputTokens} token limit`,
                        );
                    }
                }

                return truncatedResult;
            }
        } catch (error) {
            console.error(`Tool execution failed: ${name}`, error);

            // Return error as tool result
            const errorResult: ToolResult = {
                error: true,
                message: (error as Error).message,
                tool: name,
            };
            return errorResult;
        }
    }

    /**
     * Checks if a tool is registered
     *
     * @param name Tool name
     * @returns True if tool exists
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Gets the number of registered tools
     *
     * @returns Tool count
     */
    getCount(): number {
        return this.tools.size;
    }

    /**
     * Gets names of all registered tools
     *
     * @returns Array of tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }
}
