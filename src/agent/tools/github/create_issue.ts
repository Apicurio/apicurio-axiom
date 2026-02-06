/**
 * CreateIssueTool - Create a new GitHub issue
 *
 * This tool allows the agent to create new issues in the repository with
 * title, body, labels, and assignees.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class CreateIssueTool implements Tool {
    name = 'github-create_issue';
    description = 'Create a new GitHub issue in the repository with title, body, optional labels and assignees';
    input_schema = {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Issue title (required)',
            },
            body: {
                type: 'string',
                description: 'Issue body/description (supports Markdown)',
            },
            labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of label names to add',
            },
            assignees: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of GitHub usernames to assign',
            },
        },
        required: ['title'],
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
     * @returns Created issue details or error
     */
    async execute(input: { title: string; body?: string; labels?: string[]; assignees?: string[] }): Promise<any> {
        try {
            // Validate input
            if (!input.title || typeof input.title !== 'string') {
                return {
                    error: true,
                    message: 'title parameter is required and must be a string',
                };
            }

            if (input.title.trim().length === 0) {
                return {
                    error: true,
                    message: 'Issue title cannot be empty',
                };
            }

            // Create issue
            const { data: issue } = await this.octokit.issues.create({
                owner: this.owner,
                repo: this.repo,
                title: input.title,
                body: input.body || '',
                labels: input.labels || [],
                assignees: input.assignees || [],
            });

            return {
                success: true,
                issue_number: issue.number,
                url: issue.html_url,
                title: issue.title,
                state: issue.state,
                created_at: issue.created_at,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to create issue: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { title: string; body?: string; labels?: string[]; assignees?: string[] }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would create issue',
            title: input.title,
            number: 999,
            url: 'https://github.com/owner/repo/issues/999',
            success: true,
        };
    }
}
