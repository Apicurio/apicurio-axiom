/**
 * CheckPathExistsTool - Quick path existence check
 *
 * Lightweight check to determine if a path exists and what type it is.
 * Faster alternative to get_file_metadata when full metadata is not needed.
 */

import fs from 'fs-extra';
import * as path from 'node:path';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const CheckPathExistsTool: Tool = {
    name: 'repository-check_path_exists',
    description:
        'Quick existence check for a file or directory. Returns whether the path exists and its type (file, directory, or symlink).',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path from repository root',
            },
        },
        required: ['path'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Existence check result or error
     */
    async execute(input: { path: string }, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repository-check_path_exists',
                    tool: 'repository-check_path_exists',
                };
            }

            // Validate input
            if (!input.path || typeof input.path !== 'string') {
                return {
                    error: true,
                    message: 'path parameter is required and must be a string',
                };
            }

            // Normalize and resolve the path
            const normalizedPath = path.normalize(input.path);
            const fullPath = path.resolve(context.workDir, normalizedPath);

            // Security: Ensure the path is within the work directory
            if (!fullPath.startsWith(context.workDir)) {
                return {
                    error: true,
                    message: 'Path is outside the repository directory',
                };
            }

            // Check if path exists
            const exists = await fs.pathExists(fullPath);

            if (!exists) {
                return {
                    exists: false,
                };
            }

            // Get file stats to determine type
            const stats = await fs.lstat(fullPath);

            let type: 'file' | 'directory' | 'symlink';
            if (stats.isSymbolicLink()) {
                type = 'symlink';
            } else if (stats.isDirectory()) {
                type = 'directory';
            } else {
                type = 'file';
            }

            return {
                exists: true,
                type: type,
            };
        } catch (error) {
            // If we can't stat the file, return exists: false
            // This handles permission errors gracefully
            context.logger.error(`Error in check_path_exists: ${(error as Error).message}`);
            return {
                exists: false,
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
