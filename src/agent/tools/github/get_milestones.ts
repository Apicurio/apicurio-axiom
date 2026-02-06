/**
 * GetMilestonesTool - List all repository milestones
 *
 * This tool fetches all milestones in the repository with their states,
 * due dates, and progress information.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class GetMilestonesTool implements Tool {
    name = 'github-get_milestones';
    description = 'Get a list of all milestones in the repository with their states, due dates, and progress';
    input_schema = {
        type: 'object',
        properties: {
            state: {
                type: 'string',
                enum: ['open', 'closed', 'all'],
                description: 'Filter by milestone state (default: open)',
            },
        },
        required: [],
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
     * @returns List of milestones or error
     */
    async execute(input: { state?: 'open' | 'closed' | 'all' }): Promise<any> {
        try {
            const state = input.state || 'open';

            // Get all milestones (paginated)
            const milestones = await this.octokit.paginate(this.octokit.issues.listMilestones, {
                owner: this.owner,
                repo: this.repo,
                state: state,
                per_page: 100,
            });

            return {
                milestones: milestones.map((milestone) => ({
                    number: milestone.number,
                    title: milestone.title,
                    description: milestone.description || '',
                    state: milestone.state,
                    open_issues: milestone.open_issues,
                    closed_issues: milestone.closed_issues,
                    due_on: milestone.due_on,
                    created_at: milestone.created_at,
                    updated_at: milestone.updated_at,
                    url: milestone.html_url,
                })),
                count: milestones.length,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to get milestones: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { state?: 'open' | 'closed' | 'all' }): Promise<any> {
        return this.execute(input);
    }
}
