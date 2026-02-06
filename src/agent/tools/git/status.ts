/**
 * GitStatusTool - Get git repository status
 *
 * This tool runs git status and returns information about the current branch,
 * staged changes, unstaged changes, and untracked files.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';
import { execAsync } from '../utils.js';

export const GitStatusTool: Tool = {
    name: 'git-status',
    description: 'Get git repository status including current branch, staged/unstaged changes, and untracked files',
    input_schema: {
        type: 'object',
        properties: {},
        required: [],
    },

    /**
     * Execute the tool
     *
     * @param _input Tool parameters (none required)
     * @param context Tool execution context
     * @returns Git status information or error
     */
    async execute(_input: any, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for git-status',
                    tool: 'git-status',
                };
            }

            // Get current branch
            const { stdout: branchOutput } = await execAsync('git branch --show-current', {
                cwd: context.workDir,
            });
            const currentBranch = branchOutput.trim();

            // Get status in porcelain format for easier parsing
            const { stdout: statusOutput } = await execAsync('git status --porcelain', {
                cwd: context.workDir,
            });

            // Parse status output
            const lines = statusOutput
                .trim()
                .split('\n')
                .filter((line) => line.length > 0);
            const stagedFiles: string[] = [];
            const modifiedFiles: string[] = [];
            const untrackedFiles: string[] = [];

            for (const line of lines) {
                const status = line.substring(0, 2);
                const file = line.substring(3);

                // First character is staged status, second is working tree status
                const stagedStatus = status[0];
                const workingStatus = status[1];

                if (stagedStatus !== ' ' && stagedStatus !== '?') {
                    stagedFiles.push(file);
                }

                if (workingStatus === 'M' || workingStatus === 'D') {
                    modifiedFiles.push(file);
                }

                if (status === '??') {
                    untrackedFiles.push(file);
                }
            }

            // Check if working tree is clean
            const isClean = lines.length === 0;

            return {
                current_branch: currentBranch,
                is_clean: isClean,
                staged_files: stagedFiles,
                modified_files: modifiedFiles,
                untracked_files: untrackedFiles,
                total_changes: lines.length,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to get git status: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: any, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
