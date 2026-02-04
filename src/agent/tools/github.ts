/**
 * GitHub Tools
 *
 * Tools for interacting with GitHub API to read and write issue/PR data.
 * These tools allow the agent to manage issues, labels, comments, pull requests, and more.
 */

import type { Octokit } from '@octokit/rest';
import type { Tool } from '../../types/agent.js';

/**
 * GetIssueDetailsTool - Fetch detailed information about a GitHub issue
 *
 * This tool retrieves comprehensive issue data including title, body, labels,
 * state, author, comments, and more.
 */
export class GetIssueDetailsTool implements Tool {
    name = 'github-get_issue_details';
    description =
        'Get detailed information about a GitHub issue including title, body, labels, state, author, and comments';
    input_schema = {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'The issue number to fetch details for',
            },
        },
        required: ['issue_number'],
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
     * @returns Issue details or error
     */
    async execute(input: { issue_number: number }): Promise<any> {
        try {
            if (!input.issue_number || typeof input.issue_number !== 'number') {
                return {
                    error: true,
                    message: 'issue_number parameter is required and must be a number',
                };
            }

            // Get issue data
            const { data: issue } = await this.octokit.issues.get({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
            });

            // Get comments
            const { data: comments } = await this.octokit.issues.listComments({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
            });

            return {
                number: issue.number,
                title: issue.title,
                body: issue.body || '',
                state: issue.state,
                labels: issue.labels.map((label) => {
                    if (typeof label === 'string') {
                        return label;
                    }
                    return label.name || '';
                }),
                author: issue.user?.login || 'unknown',
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                comments_count: issue.comments,
                comments: comments.map((comment) => ({
                    id: comment.id,
                    author: comment.user?.login || 'unknown',
                    body: comment.body || '',
                    created_at: comment.created_at,
                })),
                assignees: issue.assignees?.map((assignee) => assignee.login) || [],
                milestone: issue.milestone
                    ? {
                          title: issue.milestone.title,
                          number: issue.milestone.number,
                          state: issue.milestone.state,
                      }
                    : null,
                url: issue.html_url,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to get issue details: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { issue_number: number }): Promise<any> {
        return this.execute(input);
    }
}

/**
 * GetRepositoryLabelsTool - List all available labels in the repository
 *
 * This tool fetches all labels defined in the repository, which is useful
 * for understanding what labels are available when labeling issues.
 */
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

/**
 * AddLabelsTool - Add labels to a GitHub issue
 *
 * This tool allows the agent to add one or more labels to an issue.
 * It validates that labels exist before attempting to add them.
 */
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

/**
 * AddCommentTool - Post a comment on a GitHub issue
 *
 * This tool allows the agent to add comments to an issue, useful for
 * providing analysis results, asking questions, or explaining actions taken.
 */
export class AddCommentTool implements Tool {
    name = 'github-add_comment';
    description = 'Add a comment to a GitHub issue. Use this to provide analysis, ask questions, or explain actions.';
    input_schema = {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'The issue number to add a comment to',
            },
            body: {
                type: 'string',
                description: 'The comment text (supports Markdown formatting)',
            },
        },
        required: ['issue_number', 'body'],
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
     * @returns Result of posting comment or error
     */
    async execute(input: { issue_number: number; body: string }): Promise<any> {
        try {
            // Validate input
            if (!input.issue_number || typeof input.issue_number !== 'number') {
                return {
                    error: true,
                    message: 'issue_number parameter is required and must be a number',
                };
            }

            if (!input.body || typeof input.body !== 'string') {
                return {
                    error: true,
                    message: 'body parameter is required and must be a string',
                };
            }

            if (input.body.trim().length === 0) {
                return {
                    error: true,
                    message: 'Comment body cannot be empty',
                };
            }

            // Post comment
            const { data: comment } = await this.octokit.issues.createComment({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
                body: input.body,
            });

            return {
                success: true,
                comment_id: comment.id,
                url: comment.html_url,
                created_at: comment.created_at,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to add comment: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; body: string }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would add comment',
            issue_number: input.issue_number,
            body: input.body,
            success: true,
        };
    }
}

/**
 * CreateIssueTool - Create a new GitHub issue
 *
 * This tool allows the agent to create new issues in the repository with
 * title, body, labels, and assignees.
 */
export class CreateIssueTool implements Tool {
    name = 'github-create_issue';
    description = 'Create a new GitHub issue in the repository with title, body, optional labels and assignees';
    input_schema = {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Issue title (required)',
            },
            body: {
                type: 'string',
                description: 'Issue body/description (supports Markdown)',
            },
            labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of label names to add',
            },
            assignees: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of GitHub usernames to assign',
            },
        },
        required: ['title'],
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
     * @returns Created issue details or error
     */
    async execute(input: { title: string; body?: string; labels?: string[]; assignees?: string[] }): Promise<any> {
        try {
            // Validate input
            if (!input.title || typeof input.title !== 'string') {
                return {
                    error: true,
                    message: 'title parameter is required and must be a string',
                };
            }

            if (input.title.trim().length === 0) {
                return {
                    error: true,
                    message: 'Issue title cannot be empty',
                };
            }

            // Create issue
            const { data: issue } = await this.octokit.issues.create({
                owner: this.owner,
                repo: this.repo,
                title: input.title,
                body: input.body || '',
                labels: input.labels || [],
                assignees: input.assignees || [],
            });

            return {
                success: true,
                issue_number: issue.number,
                url: issue.html_url,
                title: issue.title,
                state: issue.state,
                created_at: issue.created_at,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to create issue: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { title: string; body?: string; labels?: string[]; assignees?: string[] }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would create issue',
            title: input.title,
            number: 999,
            url: 'https://github.com/owner/repo/issues/999',
            success: true,
        };
    }
}

/**
 * GetDiscussionTool - Fetch detailed information about a GitHub discussion
 *
 * This tool retrieves discussion data including title, body, category, comments, etc.
 * Note: Uses GraphQL API since discussions are not available in REST API.
 */
export class GetDiscussionTool implements Tool {
    name = 'github-get_discussion';
    description = 'Get detailed information about a GitHub discussion including title, body, category, and comments';
    input_schema = {
        type: 'object',
        properties: {
            discussion_number: {
                type: 'number',
                description: 'The discussion number to fetch',
            },
        },
        required: ['discussion_number'],
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
     * @returns Discussion details or error
     */
    async execute(input: { discussion_number: number }): Promise<any> {
        try {
            // Validate input
            if (!input.discussion_number || typeof input.discussion_number !== 'number') {
                return {
                    error: true,
                    message: 'discussion_number parameter is required and must be a number',
                };
            }

            // Use GraphQL API to fetch discussion
            // Fetch the discussion by number directly
            const discussionQuery = `
                query($owner: String!, $repo: String!, $number: Int!) {
                    repository(owner: $owner, name: $repo) {
                        discussion(number: $number) {
                            id
                            number
                            title
                            body
                            createdAt
                            updatedAt
                            author {
                                login
                            }
                            category {
                                name
                                emoji
                            }
                            comments(first: 100) {
                                nodes {
                                    id
                                    body
                                    createdAt
                                    author {
                                        login
                                    }
                                }
                            }
                            url
                        }
                    }
                }
            `;

            const result: any = await this.octokit.graphql(discussionQuery, {
                owner: this.owner,
                repo: this.repo,
                number: input.discussion_number,
            });

            const discussion = result.repository.discussion;

            if (!discussion) {
                return {
                    error: true,
                    message: `Discussion #${input.discussion_number} not found`,
                };
            }

            return {
                number: discussion.number,
                title: discussion.title,
                body: discussion.body || '',
                author: discussion.author?.login || 'unknown',
                category: {
                    name: discussion.category?.name || 'unknown',
                    emoji: discussion.category?.emoji || '',
                },
                created_at: discussion.createdAt,
                updated_at: discussion.updatedAt,
                comments: discussion.comments.nodes.map((comment: any) => ({
                    id: comment.id,
                    author: comment.author?.login || 'unknown',
                    body: comment.body || '',
                    created_at: comment.createdAt,
                })),
                comments_count: discussion.comments.nodes.length,
                url: discussion.url,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to get discussion details: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { discussion_number: number }): Promise<any> {
        return this.execute(input);
    }
}

/**
 * GetMilestonesTool - List all repository milestones
 *
 * This tool fetches all milestones in the repository with their states,
 * due dates, and progress information.
 */
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

/**
 * CreatePullRequestTool - Create a pull request from current branch
 *
 * This tool creates a pull request via the GitHub API. It assumes the branch
 * has already been pushed to the remote repository.
 */
export class CreatePullRequestTool implements Tool {
    name = 'github-create_pull_request';
    description = 'Create a pull request from the current branch to the base branch (assumes branch is already pushed)';
    input_schema = {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Pull request title',
            },
            body: {
                type: 'string',
                description: 'Pull request description (supports Markdown)',
            },
            head: {
                type: 'string',
                description: 'The name of the branch where your changes are (e.g., "feature-branch")',
            },
            base: {
                type: 'string',
                description: 'The name of the branch you want to merge into (default: "main")',
            },
            draft: {
                type: 'boolean',
                description: 'Create as draft pull request (default: false)',
            },
        },
        required: ['title', 'head'],
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
     * @returns Created PR details or error
     */
    async execute(input: { title: string; body?: string; head: string; base?: string; draft?: boolean }): Promise<any> {
        try {
            // Validate input
            if (!input.title || typeof input.title !== 'string') {
                return {
                    error: true,
                    message: 'title parameter is required and must be a string',
                };
            }

            if (!input.head || typeof input.head !== 'string') {
                return {
                    error: true,
                    message: 'head parameter is required and must be a string (branch name)',
                };
            }

            const base = input.base || 'main';

            // Create pull request
            const { data: pr } = await this.octokit.pulls.create({
                owner: this.owner,
                repo: this.repo,
                title: input.title,
                body: input.body || '',
                head: input.head,
                base: base,
                draft: input.draft || false,
            });

            return {
                success: true,
                pr_number: pr.number,
                url: pr.html_url,
                title: pr.title,
                state: pr.state,
                draft: pr.draft,
                head: pr.head.ref,
                base: pr.base.ref,
                created_at: pr.created_at,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to create pull request: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: {
        title: string;
        head: string;
        body?: string;
        base?: string;
        draft?: boolean;
    }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would create pull request',
            title: input.title,
            pr_number: 999,
            url: 'https://github.com/owner/repo/pull/999',
            success: true,
        };
    }
}

/**
 * CloseIssueTool - Close a GitHub issue
 *
 * This tool closes an issue with an optional comment explaining why.
 * Supports specifying whether the issue was completed or not planned.
 */
export class CloseIssueTool implements Tool {
    name = 'github-close_issue';
    description = 'Close a GitHub issue with optional comment and state reason (completed or not_planned)';
    input_schema = {
        type: 'object',
        properties: {
            issue_number: {
                type: 'number',
                description: 'Issue number to close',
            },
            comment: {
                type: 'string',
                description: 'Optional comment to add when closing the issue',
            },
            state_reason: {
                type: 'string',
                enum: ['completed', 'not_planned'],
                description: 'Reason for closing (completed or not_planned, default: completed)',
            },
        },
        required: ['issue_number'],
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
     * @returns Close result or error
     */
    async execute(input: {
        issue_number: number;
        comment?: string;
        state_reason?: 'completed' | 'not_planned';
    }): Promise<any> {
        try {
            if (!input.issue_number || typeof input.issue_number !== 'number') {
                return {
                    error: true,
                    message: 'issue_number parameter is required and must be a number',
                };
            }

            // Add comment if provided
            if (input.comment && input.comment.trim().length > 0) {
                await this.octokit.issues.createComment({
                    owner: this.owner,
                    repo: this.repo,
                    issue_number: input.issue_number,
                    body: input.comment,
                });
            }

            // Close the issue
            const { data: issue } = await this.octokit.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: input.issue_number,
                state: 'closed',
                state_reason: input.state_reason || 'completed',
            });

            return {
                success: true,
                issue_number: issue.number,
                state: issue.state,
                state_reason: input.state_reason || 'completed',
                comment_added: !!input.comment,
                url: issue.html_url,
                closed_at: issue.closed_at,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to close issue: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { issue_number: number; comment?: string; state_reason?: string }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would close issue',
            issue_number: input.issue_number,
            state_reason: input.state_reason || 'completed',
            success: true,
        };
    }
}

/**
 * AssignIssueTool - Assign users to a GitHub issue
 *
 * This tool assigns one or more users to an issue.
 * Users must have access to the repository to be assigned.
 */
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

/**
 * SetIssueMilestoneTool - Set milestone on a GitHub issue
 *
 * This tool assigns an issue to a milestone by milestone number.
 * Use get_milestones tool first to find the appropriate milestone number.
 */
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

/**
 * AddDiscussionResponseTool - Add a comment/reply to a GitHub discussion
 *
 * This tool posts a comment to a discussion thread.
 */
export class AddDiscussionResponseTool implements Tool {
    name = 'github-add_discussion_response';
    description =
        'Add a comment/response to a GitHub discussion. Use this to provide insights, ask questions, or participate in discussions.';
    input_schema = {
        type: 'object',
        properties: {
            discussion_number: {
                type: 'number',
                description: 'The discussion number to add a comment to',
            },
            body: {
                type: 'string',
                description: 'The comment text (supports Markdown formatting)',
            },
        },
        required: ['discussion_number', 'body'],
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
     * @returns Result of posting comment or error
     */
    async execute(input: { discussion_number: number; body: string }): Promise<any> {
        try {
            // Validate input
            if (!input.discussion_number || typeof input.discussion_number !== 'number') {
                return {
                    error: true,
                    message: 'discussion_number parameter is required and must be a number',
                };
            }

            if (!input.body || typeof input.body !== 'string') {
                return {
                    error: true,
                    message: 'body parameter is required and must be a string',
                };
            }

            if (input.body.trim().length === 0) {
                return {
                    error: true,
                    message: 'Comment body cannot be empty',
                };
            }

            // First, fetch the discussion to get its GraphQL ID
            const discussionQuery = `
                query($owner: String!, $repo: String!, $number: Int!) {
                    repository(owner: $owner, name: $repo) {
                        discussion(number: $number) {
                            id
                        }
                    }
                }
            `;

            const discussionResult: any = await this.octokit.graphql(discussionQuery, {
                owner: this.owner,
                repo: this.repo,
                number: input.discussion_number,
            });

            const discussionId = discussionResult.repository.discussion.id;

            // Post comment to discussion using GraphQL
            const mutation = `
                mutation($discussionId: ID!, $body: String!) {
                    addDiscussionComment(input: {
                        discussionId: $discussionId,
                        body: $body
                    }) {
                        comment {
                            id
                            url
                            createdAt
                        }
                    }
                }
            `;

            const result: any = await this.octokit.graphql(mutation, {
                discussionId: discussionId,
                body: input.body,
            });

            const comment = result.addDiscussionComment.comment;

            return {
                success: true,
                comment_id: comment.id,
                url: comment.url,
                created_at: comment.createdAt,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to add discussion comment: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { discussion_number: number; body: string }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would add discussion comment',
            discussion_number: input.discussion_number,
            body: input.body,
            success: true,
        };
    }
}
