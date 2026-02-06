/**
 * CloseIssueTool - Close a GitHub issue
 *
 * This tool closes an issue with an optional comment explaining why.
 * Supports specifying whether the issue was completed or not planned.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';

export const CloseIssueTool: Tool = {
    name: 'github-close_issue',
    description: 'Close a GitHub issue with optional comment and state reason (completed or not_planned)',
    input_schema: {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'Issue number to close',
            },
            comment: {
                type: 'string',
                description: 'Optional comment to add when closing the issue',
            },
            state_reason: {
                type: 'string',
                enum: ['completed', 'not_planned'],
                description: 'Reason for closing (completed or not_planned, default: completed)',
            },
        },
        required: ['issue_number'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Close result or error
     */
    async execute(
        input: {
            issue_number: number;
            comment?: string;
            state_reason?: 'completed' | 'not_planned';
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.octokit || !context.owner || !context.repo) {
                return {
                    error: true,
                    message: 'Missing required context: octokit, owner, or repo',
                };
            }

            if (!input.issue_number || typeof input.issue_number !== 'number') {
                return {
                    error: true,
                    message: 'issue_number parameter is required and must be a number',
                };
            }

            // Add comment if provided
            if (input.comment && input.comment.trim().length > 0) {
                context.logger.info(`Adding closing comment to issue #${input.issue_number}`);
                await context.octokit.issues.createComment({
                    owner: context.owner,
                    repo: context.repo,
                    issue_number: input.issue_number,
                    body: input.comment,
                });
            }

            // Close the issue
            const stateReason = input.state_reason || 'completed';
            context.logger.info(`Closing issue #${input.issue_number} as ${stateReason}`);
            const { data: issue } = await context.octokit.issues.update({
                owner: context.owner,
                repo: context.repo,
                issue_number: input.issue_number,
                state: 'closed',
                state_reason: stateReason,
            });
            context.logger.info(`Issue #${input.issue_number} closed successfully`);

            return {
                success: true,
                issue_number: issue.number,
                state: issue.state,
                state_reason: input.state_reason || 'completed',
                comment_added: !!input.comment,
                url: issue.html_url,
                closed_at: issue.closed_at,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to close issue: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(
        input: { issue_number: number; comment?: string; state_reason?: string },
        _context: ToolContext,
    ): Promise<any> {
        return {
            dry_run: true,
            message: 'Would close issue',
            issue_number: input.issue_number,
            state_reason: input.state_reason || 'completed',
            success: true,
        };
    },
};
