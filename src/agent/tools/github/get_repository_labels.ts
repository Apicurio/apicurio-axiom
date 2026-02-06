/**
 * GetRepositoryLabelsTool - List all available labels in the repository
 *
 * This tool fetches all labels defined in the repository, which is useful
 * for understanding what labels are available when labeling issues.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class GetRepositoryLabelsTool implements Tool {
    name = 'github-get_repository_labels';
    description = 'Get a list of all labels available in the repository with their names, colors, and descriptions';
    input_schema = {
        type: 'object',
        properties: {},
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
     * @param _input Tool parameters (none required)
     * @returns List of repository labels or error
     */
    async execute(_input: any): Promise<any> {
        try {
            // Get all labels (paginated)
            const labels = await this.octokit.paginate(this.octokit.issues.listLabelsForRepo, {
                owner: this.owner,
                repo: this.repo,
                per_page: 100,
            });

            return {
                labels: labels.map((label) => ({
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
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: any): Promise<any> {
        return this.execute(input);
    }
}
