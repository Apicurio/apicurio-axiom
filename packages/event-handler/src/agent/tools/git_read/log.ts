/**
 * GitLogTool - Get git commit history
 *
 * This tool retrieves commit history with various filtering options.
 * Useful for understanding project history, generating changelogs, and finding related changes.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';
import { execAsync } from '../utils.js';

export const GitLogTool: Tool = {
    name: 'git_read-log',
    description: 'Get git commit history with optional filtering by count, date range, author, or file path',
    input_schema: {
        type: 'object',
        properties: {
            max_count: {
                type: 'number',
                description: 'Maximum number of commits to return (default: 10)',
            },
            since: {
                type: 'string',
                description: 'Show commits more recent than this date (e.g., "2 weeks ago", "2024-01-01")',
            },
            until: {
                type: 'string',
                description: 'Show commits older than this date',
            },
            author: {
                type: 'string',
                description: 'Filter commits by author name or email',
            },
            ref: {
                type: 'string',
                description: 'Git reference (branch, tag, commit) to show history for (default: current branch)',
            },
            file_path: {
                type: 'string',
                description: 'Show only commits that affected this file or directory',
            },
            grep: {
                type: 'string',
                description: 'Filter commits by commit message content',
            },
        },
        required: [],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Commit history or error
     */
    async execute(
        input: {
            max_count?: number;
            since?: string;
            until?: string;
            author?: string;
            ref?: string;
            file_path?: string;
            grep?: string;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for git_read-log',
                    tool: 'git_read-log',
                };
            }

            // Build git log command
            const maxCount = input.max_count || 10;
            let logCmd = `git log -n ${maxCount}`;

            // Add format for structured output
            logCmd += ' --pretty=format:"%H|||%an|||%ae|||%aI|||%s|||%b"';

            // Add filters
            if (input.since) {
                logCmd += ` --since="${input.since}"`;
            }

            if (input.until) {
                logCmd += ` --until="${input.until}"`;
            }

            if (input.author) {
                logCmd += ` --author="${input.author}"`;
            }

            if (input.grep) {
                logCmd += ` --grep="${input.grep}"`;
            }

            // Add ref if specified
            if (input.ref) {
                logCmd += ` ${input.ref}`;
            }

            // Add file path if specified
            if (input.file_path) {
                logCmd += ` -- ${input.file_path}`;
            }

            // Execute command
            const { stdout } = await execAsync(logCmd, {
                cwd: context.workDir,
            });

            // Parse output
            const commits = [];
            const lines = stdout
                .trim()
                .split('\n')
                .filter((line) => line.length > 0);

            for (const line of lines) {
                const parts = line.split('|||');
                if (parts.length >= 5) {
                    commits.push({
                        sha: parts[0],
                        author_name: parts[1],
                        author_email: parts[2],
                        date: parts[3],
                        subject: parts[4],
                        body: parts[5] || '',
                    });
                }
            }

            return {
                commits: commits,
                count: commits.length,
                filters: {
                    max_count: maxCount,
                    since: input.since || null,
                    until: input.until || null,
                    author: input.author || null,
                    ref: input.ref || 'current branch',
                    file_path: input.file_path || null,
                    grep: input.grep || null,
                },
            };
        } catch (error) {
            // git log might exit with error if no commits match
            if ((error as Error).message.includes('does not have any commits yet')) {
                return {
                    commits: [],
                    count: 0,
                    message: 'Repository has no commits yet',
                };
            }

            return {
                error: true,
                message: `Failed to get git log: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(
        input: {
            max_count?: number;
            since?: string;
            until?: string;
            author?: string;
            ref?: string;
            file_path?: string;
            grep?: string;
        },
        context: ToolContext,
    ): Promise<any> {
        return this.execute(input, context);
    },
};
