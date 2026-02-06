/**
 * ListFilesTool - List files in a directory
 *
 * This tool allows the agent to explore the repository structure by listing
 * files and directories. Useful for understanding project organization.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Tool, ToolContext } from '../../../types/agent.js';

/**
 * Recursively list files in a directory
 *
 * @param fullPath Absolute path to directory
 * @param relativePath Relative path from work directory
 * @param files Array to accumulate results
 */
async function listRecursive(
    fullPath: string,
    relativePath: string,
    files: Array<{ name: string; type: string; size?: number; path: string }>,
): Promise<void> {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
        // Skip .git directory
        if (entry.name === '.git') {
            continue;
        }

        const entryPath = path.join(relativePath, entry.name);
        const fullEntryPath = path.join(fullPath, entry.name);
        const stats = await fs.stat(fullEntryPath);

        files.push({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: entry.isFile() ? stats.size : undefined,
            path: entryPath,
        });

        if (entry.isDirectory()) {
            await listRecursive(fullEntryPath, entryPath, files);
        }
    }
}

export const ListFilesTool: Tool = {
    name: 'repository-list_files',
    description: 'List files and directories in a path. Returns file names, types (file/directory), and sizes.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to the directory from the repository root (use "." for root)',
            },
            recursive: {
                type: 'boolean',
                description: 'If true, list files recursively (default: false)',
            },
        },
        required: ['path'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns List of files or error
     */
    async execute(input: { path: string; recursive?: boolean }, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repository-list_files',
                    tool: 'repository-list_files',
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

            // Check if directory exists
            try {
                const stats = await fs.stat(fullPath);
                if (!stats.isDirectory()) {
                    return {
                        error: true,
                        message: `Path is not a directory: ${input.path}`,
                    };
                }
            } catch (_err) {
                return {
                    error: true,
                    message: `Directory not found: ${input.path}`,
                };
            }

            // List files
            const files: Array<{ name: string; type: string; size?: number; path: string }> = [];

            if (input.recursive) {
                // Recursive listing
                await listRecursive(fullPath, input.path, files);
            } else {
                // Non-recursive listing
                const entries = await fs.readdir(fullPath, { withFileTypes: true });
                for (const entry of entries) {
                    const entryPath = path.join(input.path, entry.name);
                    const fullEntryPath = path.join(fullPath, entry.name);
                    const stats = await fs.stat(fullEntryPath);

                    files.push({
                        name: entry.name,
                        type: entry.isDirectory() ? 'directory' : 'file',
                        size: entry.isFile() ? stats.size : undefined,
                        path: entryPath,
                    });
                }
            }

            return {
                path: input.path,
                files: files,
                count: files.length,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to list files: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { path: string; recursive?: boolean }, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
