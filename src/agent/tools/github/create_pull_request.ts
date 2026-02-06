/**
 * CreatePullRequestTool - Create a pull request from current branch
 *
 * This tool creates a pull request via the GitHub API. It assumes the branch
 * has already been pushed to the remote repository.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class CreatePullRequestTool implements Tool {
    name = 'github-create_pull_request';
    description = 'Create a pull request from the current branch to the base branch (assumes branch is already pushed)';
    input_schema = {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Pull request title',
            },
            body: {
                type: 'string',
                description: 'Pull request description (supports Markdown)',
            },
            head: {
                type: 'string',
                description: 'The name of the branch where your changes are (e.g., "feature-branch")',
            },
            base: {
                type: 'string',
                description: 'The name of the branch you want to merge into (default: "main")',
            },
            draft: {
                type: 'boolean',
                description: 'Create as draft pull request (default: false)',
            },
        },
        required: ['title', 'head'],
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
     * @returns Created PR details or error
     */
    async execute(input: { title: string; body?: string; head: string; base?: string; draft?: boolean }): Promise<any> {
        try {
            // Validate input
            if (!input.title || typeof input.title !== 'string') {
                return {
                    error: true,
                    message: 'title parameter is required and must be a string',
                };
            }

            if (!input.head || typeof input.head !== 'string') {
                return {
                    error: true,
                    message: 'head parameter is required and must be a string (branch name)',
                };
            }

            const base = input.base || 'main';

            // Create pull request
            const { data: pr } = await this.octokit.pulls.create({
                owner: this.owner,
                repo: this.repo,
                title: input.title,
                body: input.body || '',
                head: input.head,
                base: base,
                draft: input.draft || false,
            });

            return {
                success: true,
                pr_number: pr.number,
                url: pr.html_url,
                title: pr.title,
                state: pr.state,
                draft: pr.draft,
                head: pr.head.ref,
                base: pr.base.ref,
                created_at: pr.created_at,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to create pull request: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: {
        title: string;
        head: string;
        body?: string;
        base?: string;
        draft?: boolean;
    }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would create pull request',
            title: input.title,
            pr_number: 999,
            url: 'https://github.com/owner/repo/pull/999',
            success: true,
        };
    }
}
