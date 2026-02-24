/**
 * GitCreateBranchTool - Create a new git branch
 *
 * This tool creates a new branch from the current branch or a specified reference.
 * Useful for automated feature branch creation workflows.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';
import { execAsync } from '../utils.js';

export const GitCreateBranchTool: Tool = {
    name: 'git_write-create_branch',
    description: 'Create a new git branch from current branch or specified ref (tag, commit, branch)',
    input_schema: {
        type: 'object',
        properties: {
            branch_name: {
                type: 'string',
                description: 'Name of the new branch to create',
            },
            from_ref: {
                type: 'string',
                description: 'Optional: reference to create branch from (default: current branch)',
            },
            checkout: {
                type: 'boolean',
                description: 'If true, checkout the new branch after creating it (default: true)',
            },
        },
        required: ['branch_name'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Branch creation result or error
     */
    async execute(
        input: { branch_name: string; from_ref?: string; checkout?: boolean },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for git_write-create_branch',
                    tool: 'git_write-create_branch',
                };
            }

            // Validate input
            if (!input.branch_name || typeof input.branch_name !== 'string') {
                return {
                    error: true,
                    message: 'branch_name parameter is required and must be a string',
                };
            }

            // Sanitize branch name (no spaces, special chars)
            const sanitizedName = input.branch_name.trim();
            if (!/^[a-zA-Z0-9/_-]+$/.test(sanitizedName)) {
                return {
                    error: true,
                    message:
                        'Branch name contains invalid characters. Use only letters, numbers, hyphens, underscores, and slashes.',
                };
            }

            // Check if branch already exists
            try {
                await execAsync(`git rev-parse --verify ${sanitizedName}`, {
                    cwd: context.workDir,
                });
                return {
                    error: true,
                    message: `Branch "${sanitizedName}" already exists`,
                };
            } catch {
                // Branch doesn't exist, good to proceed
            }

            // Build create command
            const checkout = input.checkout !== false; // Default to true
            let createCmd = checkout ? 'git checkout -b' : 'git branch';
            createCmd += ` ${sanitizedName}`;

            if (input.from_ref) {
                createCmd += ` ${input.from_ref}`;
            }

            // Create branch
            const fromRef = input.from_ref || 'current branch';
            context.logger.info(
                `Creating branch "${sanitizedName}" from ${fromRef}${checkout ? ' and checking out' : ''}`,
            );
            await execAsync(createCmd, {
                cwd: context.workDir,
            });

            // Get current branch to confirm
            const { stdout: currentBranch } = await execAsync('git branch --show-current', {
                cwd: context.workDir,
            });
            context.logger.info(`Branch "${sanitizedName}" created successfully`);

            return {
                success: true,
                branch_name: sanitizedName,
                from_ref: input.from_ref || 'current branch',
                checked_out: checkout,
                current_branch: currentBranch.trim(),
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to create branch: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(
        input: { branch_name: string; from_ref?: string; checkout?: boolean },
        _context: ToolContext,
    ): Promise<any> {
        return {
            dry_run: true,
            message: 'Would create branch',
            branch_name: input.branch_name,
            from_ref: input.from_ref || 'HEAD',
            checked_out: input.checkout !== false,
            current_branch: input.checkout !== false ? input.branch_name : 'current-branch',
            success: true,
        };
    },
};
