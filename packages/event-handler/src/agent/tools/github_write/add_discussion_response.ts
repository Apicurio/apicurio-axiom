/**
 * AddDiscussionResponseTool - Add a comment/reply to a GitHub discussion
 *
 * This tool posts a comment to a discussion thread.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';

export const AddDiscussionResponseTool: Tool = {
    name: 'github_write-add_discussion_response',
    description:
        'Add a comment/response to a GitHub discussion. Use this to provide insights, ask questions, or participate in discussions.',
    input_schema: {
        type: 'object',
        properties: {
            discussion_number: {
                type: 'number',
                description: 'The discussion number to add a comment to',
            },
            body: {
                type: 'string',
                description: 'The comment text (supports Markdown formatting)',
            },
        },
        required: ['discussion_number', 'body'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Result of posting comment or error
     */
    async execute(input: { discussion_number: number; body: string }, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.octokit || !context.owner || !context.repo) {
                return {
                    error: true,
                    message: 'Missing required context: octokit, owner, or repo',
                };
            }

            // Validate input
            if (!input.discussion_number || typeof input.discussion_number !== 'number') {
                return {
                    error: true,
                    message: 'discussion_number parameter is required and must be a number',
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

            // First, fetch the discussion to get its GraphQL ID
            const discussionQuery = `
                query($owner: String!, $repo: String!, $number: Int!) {
                    repository(owner: $owner, name: $repo) {
                        discussion(number: $number) {
                            id
                        }
                    }
                }
            `;

            const discussionResult: any = await context.octokit.graphql(discussionQuery, {
                owner: context.owner,
                repo: context.repo,
                number: input.discussion_number,
            });

            const discussionId = discussionResult.repository.discussion.id;

            // Post comment to discussion using GraphQL
            context.logger.info(
                `Adding comment to discussion #${input.discussion_number} (${input.body.length} characters)`,
            );
            const mutation = `
                mutation($discussionId: ID!, $body: String!) {
                    addDiscussionComment(input: {
                        discussionId: $discussionId,
                        body: $body
                    }) {
                        comment {
                            id
                            url
                            createdAt
                        }
                    }
                }
            `;

            const result: any = await context.octokit.graphql(mutation, {
                discussionId: discussionId,
                body: input.body,
            });

            const comment = result.addDiscussionComment.comment;
            context.logger.info(`Discussion comment posted successfully: ${comment.url}`);

            return {
                success: true,
                comment_id: comment.id,
                url: comment.url,
                created_at: comment.createdAt,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to add discussion comment: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { discussion_number: number; body: string }, _context: ToolContext): Promise<any> {
        return {
            dry_run: true,
            message: 'Would add discussion comment',
            discussion_number: input.discussion_number,
            body: input.body,
            success: true,
        };
    },
};
