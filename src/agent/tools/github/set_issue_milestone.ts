/**
 * SetIssueMilestoneTool - Set milestone on a GitHub issue
 *
 * This tool assigns an issue to a milestone by milestone number.
 * Use get_milestones tool first to find the appropriate milestone number.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';

export const SetIssueMilestoneTool: Tool = {
    name: 'github-set_issue_milestone',
    description: 'Set or update the milestone for a GitHub issue using milestone number',
    input_schema: {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'Issue number to update',
            },
            milestone_number: {
                type: 'number',
                description: 'Milestone number to assign (use get_milestones to find the right one)',
            },
        },
        required: ['issue_number', 'milestone_number'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Milestone assignment result or error
     */
    async execute(input: { issue_number: number; milestone_number: number }, context: ToolContext): Promise<any> {
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

            // Validate milestone_number
            if (!input.milestone_number || typeof input.milestone_number !== 'number') {
                return {
                    error: true,
                    message: 'milestone_number parameter is required and must be a number',
                };
            }

            // Verify milestone exists
            try {
                const { data: milestone } = await context.octokit.issues.getMilestone({
                    owner: context.owner,
                    repo: context.repo,
                    milestone_number: input.milestone_number,
                });

                // Update issue with milestone
                context.logger.info(`Setting milestone "${milestone.title}" on issue #${input.issue_number}`);
                const { data: issue } = await context.octokit.issues.update({
                    owner: context.owner,
                    repo: context.repo,
                    issue_number: input.issue_number,
                    milestone: input.milestone_number,
                });
                context.logger.info(`Milestone set successfully on issue #${input.issue_number}`);

                return {
                    success: true,
                    issue_number: issue.number,
                    milestone: {
                        number: milestone.number,
                        title: milestone.title,
                        state: milestone.state,
                        due_on: milestone.due_on,
                    },
                    url: issue.html_url,
                };
            } catch (error) {
                if ((error as any).status === 404) {
                    return {
                        error: true,
                        message: `Milestone #${input.milestone_number} not found. Use get_milestones to find valid milestones.`,
                    };
                }
                throw error;
            }
        } catch (error) {
            return {
                error: true,
                message: `Failed to set milestone: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; milestone_number: number }, _context: ToolContext): Promise<any> {
        return {
            dry_run: true,
            message: 'Would set milestone',
            issue_number: input.issue_number,
            milestone_number: input.milestone_number,
            success: true,
        };
    },
};
