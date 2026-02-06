/**
 * AddCommentTool - Post a comment on a GitHub issue
 *
 * This tool allows the agent to add comments to an issue, useful for
 * providing analysis results, asking questions, or explaining actions taken.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class AddCommentTool implements Tool {
    name = 'github-add_comment';
    description = 'Add a comment to a GitHub issue. Use this to provide analysis, ask questions, or explain actions.';
    input_schema = {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'The issue number to add a comment to',
            },
            body: {
                type: 'string',
                description: 'The comment text (supports Markdown formatting)',
            },
        },
        required: ['issue_number', 'body'],
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
     * @returns Result of posting comment or error
     */
    async execute(input: { issue_number: number; body: string }): Promise<any> {
        try {
            // Validate input
            if (!input.issue_number || typeof input.issue_number !== 'number') {
                return {
                    error: true,
                    message: 'issue_number parameter is required and must be a number',
                };
            }

            if (!input.body || typeof input.body !== 'string') {
                return {
                    error: true,
                    message: 'body parameter is required and must be a string',
                };
            }

            if (input.body.trim().length === 0) {
                return {
                    error: true,
                    message: 'Comment body cannot be empty',
                };
            }

            // Post comment
            const { data: comment } = await this.octokit.issues.createComment({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
                body: input.body,
            });

            return {
                success: true,
                comment_id: comment.id,
                url: comment.html_url,
                created_at: comment.created_at,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to add comment: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; body: string }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would add comment',
            issue_number: input.issue_number,
            body: input.body,
            success: true,
        };
    }
}
