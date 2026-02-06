/**
 * CloseIssueTool - Close a GitHub issue
 *
 * This tool closes an issue with an optional comment explaining why.
 * Supports specifying whether the issue was completed or not planned.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class CloseIssueTool implements Tool {
    name = 'github-close_issue';
    description = 'Close a GitHub issue with optional comment and state reason (completed or not_planned)';
    input_schema = {
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
    };

    constructor(
        private octokit: Octokit,
        private owner: string,
        private repo: string,
    ) {}

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @returns Close result or error
     */
    async execute(input: {
        issue_number: number;
        comment?: string;
        state_reason?: 'completed' | 'not_planned';
    }): Promise<any> {
        try {
            if (!input.issue_number || typeof input.issue_number !== 'number') {
                return {
                    error: true,
                    message: 'issue_number parameter is required and must be a number',
                };
            }

            // Add comment if provided
            if (input.comment && input.comment.trim().length > 0) {
                await this.octokit.issues.createComment({
                    owner: this.owner,
                    repo: this.repo,
                    issue_number: input.issue_number,
                    body: input.comment,
                });
            }

            // Close the issue
            const { data: issue } = await this.octokit.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
                state: 'closed',
                state_reason: input.state_reason || 'completed',
            });

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
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; comment?: string; state_reason?: string }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would close issue',
            issue_number: input.issue_number,
            state_reason: input.state_reason || 'completed',
            success: true,
        };
    }
}
