/**
 * AssignIssueTool - Assign users to a GitHub issue
 *
 * This tool assigns one or more users to an issue.
 * Users must have access to the repository to be assigned.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';

export const AssignIssueTool: Tool = {
    name: 'github-assign_issue',
    description: 'Assign one or more users to a GitHub issue. Users must have repository access.',
    input_schema: {
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
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Assignment result or error
     */
    async execute(input: { issue_number: number; assignees: string[] }, context: ToolContext): Promise<any> {
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
            const { data: currentIssue } = await context.octokit.issues.get({
                owner: context.owner,
                repo: context.repo,
                issue_number: input.issue_number,
            });

            const existingAssignees = currentIssue.assignees?.map((a: any) => a.login) || [];

            // Add assignees
            context.logger.info(`Assigning issue #${input.issue_number} to: ${input.assignees.join(', ')}`);
            const { data: issue } = await context.octokit.issues.addAssignees({
                owner: context.owner,
                repo: context.repo,
                issue_number: input.issue_number,
                assignees: input.assignees,
            });
            context.logger.info(`Issue #${input.issue_number} assigned successfully`);

            const newAssignees = issue.assignees?.map((a: any) => a.login) || [];

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
    },

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; assignees: string[] }, _context: ToolContext): Promise<any> {
        return {
            dry_run: true,
            message: 'Would assign issue',
            issue_number: input.issue_number,
            assignees_added: input.assignees,
            existing_assignees: [],
            all_assignees: input.assignees,
            success: true,
        };
    },
};
