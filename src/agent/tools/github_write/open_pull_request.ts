/**
 * OpenPullRequestTool - Complete workflow to open a pull request
 *
 * This tool orchestrates the entire PR workflow:
 * 1. Validates current branch (not main/master)
 * 2. Adds all changes to git (git add -A)
 * 3. Commits changes with provided message
 * 4. Pushes branch to remote
 * 5. Creates pull request via GitHub API
 *
 * This is a high-level tool that automates the complete process.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';
import { execAsync } from '../utils.js';

export const OpenPullRequestTool: Tool = {
    name: 'github_write-open_pull_request',
    description: 'Complete workflow to open a pull request: add changes, commit, push branch, and create PR on GitHub',
    input_schema: {
        type: 'object',
        properties: {
            commit_message: {
                type: 'string',
                description: 'Commit message for the changes',
            },
            pr_title: {
                type: 'string',
                description: 'Title for the pull request',
            },
            pr_body: {
                type: 'string',
                description: 'Description/body for the pull request (supports Markdown)',
            },
            base_branch: {
                type: 'string',
                description: 'Base branch to merge into (default: "main")',
            },
            draft: {
                type: 'boolean',
                description: 'Create as draft pull request (default: false)',
            },
        },
        required: ['commit_message', 'pr_title'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns PR creation result or error
     */
    async execute(
        input: {
            commit_message: string;
            pr_title: string;
            pr_body?: string;
            base_branch?: string;
            draft?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.octokit || !context.owner || !context.repo) {
                return {
                    error: true,
                    message: 'Missing required context: octokit, owner, or repo',
                };
            }

            if (!context.workDir) {
                return {
                    error: true,
                    message: 'Missing required context: workDir',
                };
            }

            // Validate input
            if (!input.commit_message || typeof input.commit_message !== 'string') {
                return {
                    error: true,
                    message: 'commit_message parameter is required and must be a string',
                };
            }

            if (!input.pr_title || typeof input.pr_title !== 'string') {
                return {
                    error: true,
                    message: 'pr_title parameter is required and must be a string',
                };
            }

            const baseBranch = input.base_branch || 'main';

            context.logger.info(`Starting PR workflow: "${input.pr_title}"`);

            // Step 1: Get current branch
            const { stdout: branchOutput } = await execAsync('git branch --show-current', {
                cwd: context.workDir,
            });
            const currentBranch = branchOutput.trim();
            context.logger.info(`Current branch: ${currentBranch}`);

            if (!currentBranch) {
                return {
                    error: true,
                    message: 'Not on a branch (detached HEAD state)',
                };
            }

            // Step 2: Validate we're not on the base branch
            if (currentBranch === baseBranch || currentBranch === 'master') {
                return {
                    error: true,
                    message: `Cannot create PR from ${currentBranch} branch. Please create a feature branch first.`,
                };
            }

            // Step 3: Check if there are changes to commit
            const { stdout: statusOutput } = await execAsync('git status --porcelain', {
                cwd: context.workDir,
            });

            const hasChanges = statusOutput.trim().length > 0;

            if (!hasChanges) {
                return {
                    error: true,
                    message: 'No changes to commit. Working directory is clean.',
                };
            }

            // Step 4: Add all changes
            context.logger.info('Adding all changes to git...');
            await execAsync('git add -A', {
                cwd: context.workDir,
            });

            // Step 5: Commit changes
            context.logger.info(`Committing changes: "${input.commit_message}"`);
            // Use heredoc to safely handle multi-line commit messages
            const escapedMessage = input.commit_message.replace(/'/g, "'\\''");
            await execAsync(`git commit -m '${escapedMessage}'`, {
                cwd: context.workDir,
            });

            // Step 6: Push branch to remote
            // First, check if remote branch exists
            let remoteBranchExists = false;
            try {
                await execAsync(`git ls-remote --heads origin ${currentBranch}`, {
                    cwd: context.workDir,
                });
                remoteBranchExists = true;
            } catch {
                // Remote branch doesn't exist, will create it
                remoteBranchExists = false;
            }

            // Push with appropriate flags
            context.logger.info(`Pushing branch "${currentBranch}" to remote...`);
            if (remoteBranchExists) {
                await execAsync(`git push origin ${currentBranch}`, {
                    cwd: context.workDir,
                });
            } else {
                // First push, set upstream
                await execAsync(`git push -u origin ${currentBranch}`, {
                    cwd: context.workDir,
                });
            }
            context.logger.info('Branch pushed successfully');

            // Step 7: Create pull request via GitHub API
            context.logger.info(`Creating pull request: "${input.pr_title}" (${currentBranch} -> ${baseBranch})`);
            const { data: pr } = await context.octokit.pulls.create({
                owner: context.owner,
                repo: context.repo,
                title: input.pr_title,
                body: input.pr_body || '',
                head: currentBranch,
                base: baseBranch,
                draft: input.draft || false,
            });
            context.logger.info(`Pull request #${pr.number} created successfully: ${pr.html_url}`);

            return {
                success: true,
                pr_number: pr.number,
                pr_url: pr.html_url,
                branch: currentBranch,
                base_branch: baseBranch,
                commit_message: input.commit_message,
                pr_title: pr.title,
                draft: pr.draft,
                created_at: pr.created_at,
                steps_completed: [
                    'Validated branch',
                    'Added changes (git add -A)',
                    `Committed changes: "${input.commit_message}"`,
                    `Pushed branch "${currentBranch}" to remote`,
                    `Created pull request #${pr.number}`,
                ],
            };
        } catch (error) {
            // Try to provide helpful error messages
            if ((error as Error).message.includes('nothing to commit')) {
                return {
                    error: true,
                    message: 'No changes to commit. All changes may already be committed.',
                };
            }

            if ((error as Error).message.includes('failed to push')) {
                return {
                    error: true,
                    message: 'Failed to push branch to remote. Check permissions and network connection.',
                };
            }

            if ((error as Error).message.includes('A pull request already exists')) {
                return {
                    error: true,
                    message: `A pull request already exists for branch "${(error as Error).message.match(/for ([\w-]+)/)?.[1]}"`,
                };
            }

            return {
                error: true,
                message: `Failed to open pull request: ${(error as Error).message}`,
                details:
                    'This is a multi-step operation. The error may have occurred during: add, commit, push, or PR creation.',
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(
        input: {
            commit_message: string;
            pr_title: string;
            pr_body?: string;
            base_branch?: string;
            draft?: boolean;
        },
        _context: ToolContext,
    ): Promise<any> {
        return {
            dry_run: true,
            message: 'Would commit changes, push, and create PR',
            commit_message: input.commit_message,
            pr_title: input.pr_title,
            pr_number: 999,
            pr_url: 'https://github.com/owner/repo/pull/999',
            steps_completed: [
                'add changes (git add -A)',
                'commit changes',
                'push branch to remote',
                'create pull request',
            ],
            success: true,
        };
    },
};
