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
 * @param maxFiles Maximum number of files to collect (stops early if reached)
 * @returns True if limit was reached
 */
async function listRecursive(
    fullPath: string,
    relativePath: string,
    files: Array<{ name: string; type: string; size?: number; path: string }>,
    maxFiles: number,
): Promise<boolean> {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
        // Check if we've hit the limit
        if (files.length >= maxFiles) {
            return true;
        }

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
            const limitReached = await listRecursive(fullEntryPath, entryPath, files, maxFiles);
            if (limitReached) {
                return true;
            }
        }
    }

    return false;
}

export const ListFilesTool: Tool = {
    name: 'repo_read-list_files',
    description:
        'List files and directories in a path. Returns file names, types (file/directory), and sizes. Limited to 200 files by default to prevent excessive output.',
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
            max_files: {
                type: 'number',
                description: 'Maximum number of files to return (default: 200, max: 500)',
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
    async execute(
        input: { path: string; recursive?: boolean; max_files?: number },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_read-list_files',
                    tool: 'repo_read-list_files',
                };
            }

            // Validate input
            if (!input.path) {
                return {
                    error: true,
                    message: 'path parameter is required',
                };
            }

            // Parse max_files with sensible defaults and limits
            const DEFAULT_MAX_FILES = 200;
            const ABSOLUTE_MAX_FILES = 500;
            const maxFiles = input.max_files
                ? Math.min(input.max_files, ABSOLUTE_MAX_FILES)
                : DEFAULT_MAX_FILES;

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
            let truncated = false;

            if (input.recursive) {
                // Recursive listing
                truncated = await listRecursive(fullPath, input.path, files, maxFiles);
            } else {
                // Non-recursive listing
                const entries = await fs.readdir(fullPath, { withFileTypes: true });
                for (const entry of entries) {
                    // Check limit for non-recursive too
                    if (files.length >= maxFiles) {
                        truncated = true;
                        break;
                    }

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
                truncated: truncated,
                ...(truncated && {
                    message: `Listing truncated at ${maxFiles} files. Use max_files parameter to adjust (max: ${ABSOLUTE_MAX_FILES})`,
                }),
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
    async executeMock(
        input: { path: string; recursive?: boolean; max_files?: number },
        context: ToolContext,
    ): Promise<any> {
        return this.execute(input, context);
    },
};
