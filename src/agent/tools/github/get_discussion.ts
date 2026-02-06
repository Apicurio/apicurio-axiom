/**
 * GetDiscussionTool - Fetch detailed information about a GitHub discussion
 *
 * This tool retrieves discussion data including title, body, category, comments, etc.
 * Note: Uses GraphQL API since discussions are not available in REST API.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class GetDiscussionTool implements Tool {
    name = 'github-get_discussion';
    description = 'Get detailed information about a GitHub discussion including title, body, category, and comments';
    input_schema = {
        type: 'object',
        properties: {
            discussion_number: {
                type: 'number',
                description: 'The discussion number to fetch',
            },
        },
        required: ['discussion_number'],
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
     * @returns Discussion details or error
     */
    async execute(input: { discussion_number: number }): Promise<any> {
        try {
            // Validate input
            if (!input.discussion_number || typeof input.discussion_number !== 'number') {
                return {
                    error: true,
                    message: 'discussion_number parameter is required and must be a number',
                };
            }

            // Use GraphQL API to fetch discussion
            // Fetch the discussion by number directly
            const discussionQuery = `
                query($owner: String!, $repo: String!, $number: Int!) {
                    repository(owner: $owner, name: $repo) {
                        discussion(number: $number) {
                            id
                            number
                            title
                            body
                            createdAt
                            updatedAt
                            author {
                                login
                            }
                            category {
                                name
                                emoji
                            }
                            comments(first: 100) {
                                nodes {
                                    id
                                    body
                                    createdAt
                                    author {
                                        login
                                    }
                                }
                            }
                            url
                        }
                    }
                }
            `;

            const result: any = await this.octokit.graphql(discussionQuery, {
                owner: this.owner,
                repo: this.repo,
                number: input.discussion_number,
            });

            const discussion = result.repository.discussion;

            if (!discussion) {
                return {
                    error: true,
                    message: `Discussion #${input.discussion_number} not found`,
                };
            }

            return {
                number: discussion.number,
                title: discussion.title,
                body: discussion.body || '',
                author: discussion.author?.login || 'unknown',
                category: {
                    name: discussion.category?.name || 'unknown',
                    emoji: discussion.category?.emoji || '',
                },
                created_at: discussion.createdAt,
                updated_at: discussion.updatedAt,
                comments: discussion.comments.nodes.map((comment: any) => ({
                    id: comment.id,
                    author: comment.author?.login || 'unknown',
                    body: comment.body || '',
                    created_at: comment.createdAt,
                })),
                comments_count: discussion.comments.nodes.length,
                url: discussion.url,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to get discussion details: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { discussion_number: number }): Promise<any> {
        return this.execute(input);
    }
}
