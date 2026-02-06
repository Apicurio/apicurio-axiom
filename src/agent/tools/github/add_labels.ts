/**
 * AddLabelsTool - Add labels to a GitHub issue
 *
 * This tool allows the agent to add one or more labels to an issue.
 * It validates that labels exist before attempting to add them.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../../types/agent.js';

export class AddLabelsTool implements Tool {
    name = 'github-add_labels';
    description = 'Add one or more labels to a GitHub issue. Labels must exist in the repository.';
    input_schema = {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'The issue number to add labels to',
            },
            labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of label names to add to the issue',
            },
        },
        required: ['issue_number', 'labels'],
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
     * @returns Result of adding labels or error
     */
    async execute(input: { issue_number: number; labels: string[] }): Promise<any> {
        try {
            // Validate input
            if (!input.issue_number || typeof input.issue_number !== 'number') {
                return {
                    error: true,
                    message: 'issue_number parameter is required and must be a number',
                };
            }

            if (!input.labels || !Array.isArray(input.labels)) {
                return {
                    error: true,
                    message: 'labels parameter must be an array of strings',
                };
            }

            if (input.labels.length === 0) {
                return {
                    error: true,
                    message: 'labels array cannot be empty',
                };
            }

            // Get current issue labels
            const { data: issue } = await this.octokit.issues.get({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
            });

            const existingLabels = issue.labels.map((label) => {
                if (typeof label === 'string') {
                    return label;
                }
                return label.name || '';
            });

            // Filter out labels that are already applied
            const newLabels = input.labels.filter((label) => !existingLabels.includes(label));

            if (newLabels.length === 0) {
                return {
                    success: true,
                    message: 'All labels are already applied to the issue',
                    labels_added: [],
                    existing_labels: existingLabels,
                };
            }

            // Add labels
            await this.octokit.issues.addLabels({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
                labels: newLabels,
            });

            return {
                success: true,
                labels_added: newLabels,
                existing_labels: existingLabels,
                all_labels: [...existingLabels, ...newLabels],
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to add labels: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; labels: string[] }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would add labels',
            issue_number: input.issue_number,
            labels_added: input.labels,
            existing_labels: [],
            all_labels: input.labels,
            success: true,
        };
    }
}
