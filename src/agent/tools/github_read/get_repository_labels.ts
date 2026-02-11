/**
 * GetRepositoryLabelsTool - List all available labels in the repository
 *
 * This tool fetches all labels defined in the repository, which is useful
 * for understanding what labels are available when labeling issues.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';

export const GetRepositoryLabelsTool: Tool = {
    name: 'github_read-get_repository_labels',
    description: 'Get a list of all labels available in the repository with their names, colors, and descriptions',
    input_schema: {
        type: 'object',
        properties: {},
        required: [],
    },

    /**
     * Execute the tool
     *
     * @param _input Tool parameters (none required)
     * @param context Tool execution context
     * @returns List of repository labels or error
     */
    async execute(_input: any, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.octokit || !context.owner || !context.repo) {
                return {
                    error: true,
                    message: 'Missing required context: octokit, owner, or repo',
                };
            }

            // Get all labels (paginated)
            const labels = await context.octokit.paginate(context.octokit.issues.listLabelsForRepo, {
                owner: context.owner,
                repo: context.repo,
                per_page: 100,
            });

            return {
                labels: labels.map((label: any) => ({
                    name: label.name,
                    description: label.description || '',
                    color: label.color,
                })),
                count: labels.length,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to get repository labels: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: any, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
