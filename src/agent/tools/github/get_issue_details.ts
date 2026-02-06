/**
 * GetIssueDetailsTool - Fetch detailed information about a GitHub issue
 *
 * This tool retrieves comprehensive issue data including title, body, labels,
 * state, author, comments, and more.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class GetIssueDetailsTool implements Tool {
    name = 'github-get_issue_details';
    description =
        'Get detailed information about a GitHub issue including title, body, labels, state, author, and comments';
    input_schema = {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'The issue number to fetch details for',
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
     * @returns Issue details or error
     */
    async execute(input: { issue_number: number }): Promise<any> {
        try {
            if (!input.issue_number || typeof input.issue_number !== 'number') {
                return {
                    error: true,
                    message: 'issue_number parameter is required and must be a number',
                };
            }

            // Get issue data
            const { data: issue } = await this.octokit.issues.get({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
            });

            // Get comments
            const { data: comments } = await this.octokit.issues.listComments({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
            });

            return {
                number: issue.number,
                title: issue.title,
                body: issue.body || '',
                state: issue.state,
                labels: issue.labels.map((label) => {
                    if (typeof label === 'string') {
                        return label;
                    }
                    return label.name || '';
                }),
                author: issue.user?.login || 'unknown',
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                comments_count: issue.comments,
                comments: comments.map((comment) => ({
                    id: comment.id,
                    author: comment.user?.login || 'unknown',
                    body: comment.body || '',
                    created_at: comment.created_at,
                })),
                assignees: issue.assignees?.map((assignee) => assignee.login) || [],
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
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { issue_number: number }): Promise<any> {
        return this.execute(input);
    }
}
