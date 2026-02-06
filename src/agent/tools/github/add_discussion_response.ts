/**
 * AddDiscussionResponseTool - Add a comment/reply to a GitHub discussion
 *
 * This tool posts a comment to a discussion thread.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class AddDiscussionResponseTool implements Tool {
    name = 'github-add_discussion_response';
    description =
        'Add a comment/response to a GitHub discussion. Use this to provide insights, ask questions, or participate in discussions.';
    input_schema = {
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
    async execute(input: { discussion_number: number; body: string }): Promise<any> {
        try {
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

            const discussionResult: any = await this.octokit.graphql(discussionQuery, {
                owner: this.owner,
                repo: this.repo,
                number: input.discussion_number,
            });

            const discussionId = discussionResult.repository.discussion.id;

            // Post comment to discussion using GraphQL
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

            const result: any = await this.octokit.graphql(mutation, {
                discussionId: discussionId,
                body: input.body,
            });

            const comment = result.addDiscussionComment.comment;

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
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { discussion_number: number; body: string }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would add discussion comment',
            discussion_number: input.discussion_number,
            body: input.body,
            success: true,
        };
    }
}
