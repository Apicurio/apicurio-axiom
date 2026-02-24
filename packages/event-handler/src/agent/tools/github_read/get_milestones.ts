/**
 * GetMilestonesTool - List all repository milestones
 *
 * This tool fetches all milestones in the repository with their states,
 * due dates, and progress information.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';

export const GetMilestonesTool: Tool = {
    name: 'github_read-get_milestones',
    description: 'Get a list of all milestones in the repository with their states, due dates, and progress',
    input_schema: {
        type: 'object',
        properties: {
            state: {
                type: 'string',
                enum: ['open', 'closed', 'all'],
                description: 'Filter by milestone state (default: open)',
            },
        },
        required: [],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns List of milestones or error
     */
    async execute(input: { state?: 'open' | 'closed' | 'all' }, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.octokit || !context.owner || !context.repo) {
                return {
                    error: true,
                    message: 'Missing required context: octokit, owner, or repo',
                };
            }

            const state = input.state || 'open';

            // Get all milestones (paginated)
            const milestones = await context.octokit.paginate(context.octokit.issues.listMilestones, {
                owner: context.owner,
                repo: context.repo,
                state: state,
                per_page: 100,
            });

            return {
                milestones: milestones.map((milestone: any) => ({
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
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { state?: 'open' | 'closed' | 'all' }, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
