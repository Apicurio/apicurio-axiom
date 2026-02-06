/**
 * GetIssueDetailsTool - Fetch detailed information about a GitHub issue
 *
 * This tool retrieves comprehensive issue data including title, body, labels,
 * state, author, comments, and more.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';

export const GetIssueDetailsTool: Tool = {
    name: 'github-get_issue_details',
    description:
        'Get detailed information about a GitHub issue including title, body, labels, state, author, and comments',
    input_schema: {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'The issue number to fetch details for',
            },
        },
        required: ['issue_number'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Issue details or error
     */
    async execute(input: { issue_number: number }, context: ToolContext): Promise<any> {
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

            // Get issue data
            const { data: issue } = await context.octokit.issues.get({
                owner: context.owner,
                repo: context.repo,
                issue_number: input.issue_number,
            });

            // Get comments
            const { data: comments } = await context.octokit.issues.listComments({
                owner: context.owner,
                repo: context.repo,
                issue_number: input.issue_number,
            });

            return {
                number: issue.number,
                title: issue.title,
                body: issue.body || '',
                state: issue.state,
                labels: issue.labels.map((label: any) => {
                    if (typeof label === 'string') {
                        return label;
                    }
                    return label.name || '';
                }),
                author: issue.user?.login || 'unknown',
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                comments_count: issue.comments,
                comments: comments.map((comment: any) => ({
                    id: comment.id,
                    author: comment.user?.login || 'unknown',
                    body: comment.body || '',
                    created_at: comment.created_at,
                })),
                assignees: issue.assignees?.map((assignee: any) => assignee.login) || [],
                milestone: issue.milestone
                    ? {
                          title: issue.milestone.title,
                          number: issue.milestone.number,
                          state: issue.milestone.state,
                      }
                    : null,
                url: issue.html_url,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to get issue details: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { issue_number: number }, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
