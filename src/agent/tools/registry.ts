/**
 * Tool Registry
 *
 * Manages the allow-list of tools available to the agent.
 * Provides tool schemas to AI Agent and executes tool calls safely.
 */

import type { Logger } from '../../logging/logger.js';
import type { Tool, ToolResult, ToolSchema } from '../../types/agent.js';

export class ToolRegistry {
    private tools: Map<string, Tool>;
    private dryRun: boolean;
    private logger: Logger;

    /**
     * Creates a new ToolRegistry instance
     *
     * @param dryRun If true, write tools will be simulated instead of executed
     * @param logger The logger to use for logging
     */
    constructor(dryRun: boolean = false, logger: Logger) {
        this.tools = new Map();
        this.dryRun = dryRun;
        this.logger = logger;

        if (dryRun) {
            this.logger.info('⚠️  ToolRegistry in DRY-RUN mode - write operations will be simulated');
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
        this.logger.info(`Registered tool: ${tool.name}`);
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
            if (this.dryRun) {
                this.logger.info(`🔸 [DRY-RUN] Simulating tool: ${name}`);
                this.logger.info(`🔸 [DRY-RUN] Input: ${JSON.stringify(input, null, 2)}`);
                const result = await tool.executeMock(input);
                this.logger.info(`🔸 [DRY-RUN] Simulated result: ${JSON.stringify(result, null, 2)}`);
                return result;
            } else {
                this.logger.info(`Executing tool: ${name}`);
                const result = await tool.execute(input);
                this.logger.info(`Tool completed: ${name}`);
                return result;
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
