/**
 * SetIssueMilestoneTool - Set milestone on a GitHub issue
 *
 * This tool assigns an issue to a milestone by milestone number.
 * Use get_milestones tool first to find the appropriate milestone number.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class SetIssueMilestoneTool implements Tool {
    name = 'github-set_issue_milestone';
    description = 'Set or update the milestone for a GitHub issue using milestone number';
    input_schema = {
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
     * @returns Milestone assignment result or error
     */
    async execute(input: { issue_number: number; milestone_number: number }): Promise<any> {
        try {
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
                const { data: milestone } = await this.octokit.issues.getMilestone({
                    owner: this.owner,
                    repo: this.repo,
                    milestone_number: input.milestone_number,
                });

                // Update issue with milestone
                const { data: issue } = await this.octokit.issues.update({
                    owner: this.owner,
                    repo: this.repo,
                    issue_number: input.issue_number,
                    milestone: input.milestone_number,
                });

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
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; milestone_number: number }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would set milestone',
            issue_number: input.issue_number,
            milestone_number: input.milestone_number,
            success: true,
        };
    }
}
