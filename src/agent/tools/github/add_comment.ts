/**
 * AddCommentTool - Post a comment on a GitHub issue
 *
 * This tool allows the agent to add comments to an issue, useful for
 * providing analysis results, asking questions, or explaining actions taken.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';

export const AddCommentTool: Tool = {
    name: 'github-add_comment',
    description: 'Add a comment to a GitHub issue. Use this to provide analysis, ask questions, or explain actions.',
    input_schema: {
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
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Result of posting comment or error
     */
    async execute(input: { issue_number: number; body: string }, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.octokit || !context.owner || !context.repo) {
                return {
                    error: true,
                    message: 'Missing required context: octokit, owner, or repo',
                };
            }

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
            context.logger.info(`Adding comment to issue #${input.issue_number} (${input.body.length} characters)`);
            const { data: comment } = await context.octokit.issues.createComment({
                owner: context.owner,
                repo: context.repo,
                issue_number: input.issue_number,
                body: input.body,
            });
            context.logger.info(`Comment posted successfully: ${comment.html_url}`);

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
    },

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; body: string }, _context: ToolContext): Promise<any> {
        return {
            dry_run: true,
            message: 'Would add comment',
            issue_number: input.issue_number,
            body: input.body,
            success: true,
        };
    },
};
