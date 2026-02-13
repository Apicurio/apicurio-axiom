/**
 * FindFilesTool - Find files matching glob patterns
 *
 * More powerful and flexible than list_files. Supports complex glob patterns,
 * exclusion filters, and result limiting. Uses fast-glob for high-performance
 * pattern matching across the repository.
 */

import * as path from 'node:path';
import fg from 'fast-glob';
import fs from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const FindFilesTool: Tool = {
    name: 'repo_read-find_files',
    description:
        'Find files matching glob patterns across the repository. Supports complex patterns (e.g., "**/*.java", "src/**/Test*.ts"), exclusion filters, and result limiting.',
    input_schema: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Glob pattern (e.g., "**/*.java", "src/**/Test*.ts")',
            },
            path: {
                type: 'string',
                description: 'Starting directory (default: repository root)',
            },
            exclude: {
                type: 'array',
                items: { type: 'string' },
                description: 'Patterns to exclude',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of results to return (default: 200, max: 500)',
                minimum: 1,
            },
        },
        required: ['pattern'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Matching files or error
     */
    async execute(
        input: { pattern: string; path?: string; exclude?: string[]; max_results?: number },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_read-find_files',
                    tool: 'repo_read-find_files',
                };
            }

            // Validate input
            if (!input.pattern || typeof input.pattern !== 'string') {
                return {
                    error: true,
                    message: 'pattern parameter is required and must be a string',
                    tool: this.name,
                };
            }

            // Set defaults and limits
            const DEFAULT_MAX_RESULTS = 200;
            const ABSOLUTE_MAX_RESULTS = 500;
            const maxResults = input.max_results
                ? Math.min(input.max_results, ABSOLUTE_MAX_RESULTS)
                : DEFAULT_MAX_RESULTS;
            const startPath = input.path || '.';
            const excludePatterns = input.exclude || [];

            // Normalize and resolve the starting path
            const normalizedStartPath = path.normalize(startPath);
            const fullStartPath = path.resolve(context.workDir, normalizedStartPath);

            // Security: Ensure the path is within the work directory
            if (!fullStartPath.startsWith(context.workDir)) {
                return {
                    error: true,
                    message: 'Starting path is outside the repository directory',
                    tool: this.name,
                };
            }

            // Check if start path exists
            const startPathExists = await fs.pathExists(fullStartPath);
            if (!startPathExists) {
                return {
                    error: true,
                    message: `Starting path does not exist: ${startPath}`,
                    tool: this.name,
                };
            }

            // Log the search operation
            context.logger.info(`Searching for files matching pattern: ${input.pattern} in ${startPath}`);

            // Build ignore patterns - always exclude .git directory
            const ignorePatterns = ['.git/**', ...excludePatterns];

            // Execute glob search using fast-glob
            try {
                const files = await fg(input.pattern, {
                    cwd: fullStartPath,
                    ignore: ignorePatterns,
                    absolute: false, // Return relative paths
                    onlyFiles: true,
                    dot: false, // Don't match dotfiles by default
                });

                // Get total count before truncating
                const totalCount = files.length;
                const truncated = totalCount > maxResults;

                // Limit results if needed
                const limitedFiles = files.slice(0, maxResults);

                // Convert paths to be relative to repository root (not just the start path)
                const relativePaths = limitedFiles.map((file) => {
                    if (normalizedStartPath === '.') {
                        return file;
                    }
                    return path.join(normalizedStartPath, file);
                });

                context.logger.info(
                    `Found ${totalCount} files matching pattern${truncated ? ` (limited to ${maxResults})` : ''}`,
                );

                return {
                    files: relativePaths,
                    count: totalCount,
                    truncated: truncated,
                };
            } catch (error) {
                // Handle invalid glob pattern errors
                return {
                    error: true,
                    message: `Invalid glob pattern: ${(error as Error).message}`,
                    tool: this.name,
                };
            }
        } catch (error) {
            context.logger.error(`Error in repo_read-find_files: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to find files: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(
        input: { pattern: string; path?: string; exclude?: string[]; max_results?: number },
        context: ToolContext,
    ): Promise<any> {
        return this.execute(input, context);
    },
};
