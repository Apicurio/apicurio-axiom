/**
 * AssignIssueTool - Assign users to a GitHub issue
 *
 * This tool assigns one or more users to an issue.
 * Users must have access to the repository to be assigned.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class AssignIssueTool implements Tool {
    name = 'github-assign_issue';
    description = 'Assign one or more users to a GitHub issue. Users must have repository access.';
    input_schema = {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'Issue number to assign',
            },
            assignees: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of GitHub usernames to assign to the issue',
            },
        },
        required: ['issue_number', 'assignees'],
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
     * @returns Assignment result or error
     */
    async execute(input: { issue_number: number; assignees: string[] }): Promise<any> {
        try {
            if (!input.issue_number || typeof input.issue_number !== 'number') {
                return {
                    error: true,
                    message: 'issue_number parameter is required and must be a number',
                };
            }

            // Validate assignees
            if (!input.assignees || !Array.isArray(input.assignees)) {
                return {
                    error: true,
                    message: 'assignees parameter must be an array of usernames',
                };
            }

            if (input.assignees.length === 0) {
                return {
                    error: true,
                    message: 'assignees array cannot be empty',
                };
            }

            // Get current issue to see existing assignees
            const { data: currentIssue } = await this.octokit.issues.get({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
            });

            const existingAssignees = currentIssue.assignees?.map((a) => a.login) || [];

            // Add assignees
            const { data: issue } = await this.octokit.issues.addAssignees({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
                assignees: input.assignees,
            });

            const newAssignees = issue.assignees?.map((a) => a.login) || [];

            return {
                success: true,
                issue_number: issue.number,
                assignees_added: input.assignees,
                existing_assignees: existingAssignees,
                all_assignees: newAssignees,
                url: issue.html_url,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to assign issue: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; assignees: string[] }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would assign issue',
            issue_number: input.issue_number,
            assignees_added: input.assignees,
            existing_assignees: [],
            all_assignees: input.assignees,
            success: true,
        };
    }
}
