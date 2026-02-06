/**
 * ReadFileTool - Read contents of a file from the repository
 *
 * This tool allows the agent to read the contents of any file in the work directory.
 * It's useful for understanding code structure, reading documentation, or examining
 * configuration files.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const ReadFileTool: Tool = {
    name: 'repository-read_file',
    description: 'Read the contents of a file from the repository',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to the file from the repository root',
            },
        },
        required: ['path'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns File contents or error
     */
    async execute(input: { path: string }, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repository-read_file',
                    tool: 'repository-read_file',
                };
            }

            // Validate input
            if (!input.path) {
                return {
                    error: true,
                    message: 'path parameter is required',
                };
            }

            // Construct full path and validate it's within work directory
            const fullPath = path.resolve(context.workDir, input.path);
            const normalizedWorkDir = path.resolve(context.workDir);

            if (!fullPath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: path is outside work directory',
                };
            }

            // Check if file exists
            try {
                const stats = await fs.stat(fullPath);
                if (!stats.isFile()) {
                    return {
                        error: true,
                        message: `Path is not a file: ${input.path}`,
                    };
                }
            } catch (_err) {
                return {
                    error: true,
                    message: `File not found: ${input.path}`,
                };
            }

            // Read file contents
            const contents = await fs.readFile(fullPath, 'utf-8');

            return {
                path: input.path,
                contents: contents,
                size: contents.length,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to read file: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { path: string }, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
