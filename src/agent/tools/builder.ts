/**
 * Tool Builder
 *
 * Utility for building and configuring tool registries based on event context.
 * This bridges the action executor and the tool system by creating properly
 * configured tools for each event.
 */

import * as path from 'node:path';
import { Octokit } from '@octokit/rest';
import type { Logger } from '../../logging/logger.js';
import { OpenPullRequestTool } from './composite.js';
import {
    AddCommentTool,
    AddDiscussionResponseTool,
    AddLabelsTool,
    AssignIssueTool,
    CloseIssueTool,
    CreateIssueTool,
    CreatePullRequestTool,
    GetDiscussionTool,
    GetIssueDetailsTool,
    GetMilestonesTool,
    GetRepositoryLabelsTool,
    SetIssueMilestoneTool,
} from './github.js';
import { ToolRegistry } from './registry.js';
import {
    GitCreateBranchTool,
    GitDiffTool,
    GitLogTool,
    GitStatusTool,
    ListFilesTool,
    ReadFileTool,
    SearchCodeTool,
} from './repository.js';

/**
 * Tool Builder Configuration
 */
export interface ToolBuilderConfig {
    // GitHub configuration
    githubToken: string;
    owner: string;
    repo: string;

    // Work directory for repository tools
    workDir?: string;
}

/**
 * Available tool names
 */
export const AvailableTools = {
    // Repository file tools
    READ_FILE: 'repository-read_file',
    LIST_FILES: 'repository-list_files',
    SEARCH_CODE: 'repository-search_code',

    // Git operation tools
    GIT_STATUS: 'git-status',
    GIT_DIFF: 'git-diff',
    GIT_CREATE_BRANCH: 'git-create_branch',
    GIT_LOG: 'git-log',

    // GitHub read tools
    GET_ISSUE_DETAILS: 'github-get_issue_details',
    GET_REPOSITORY_LABELS: 'github-get_repository_labels',
    GET_DISCUSSION: 'github-get_discussion',
    GET_MILESTONES: 'github-get_milestones',

    // GitHub write tools
    ADD_LABELS: 'github-add_labels',
    ADD_COMMENT: 'github-add_comment',
    ADD_DISCUSSION_RESPONSE: 'github-add_discussion_response',
    CREATE_ISSUE: 'github-create_issue',
    CREATE_PULL_REQUEST: 'github-create_pull_request',
    CLOSE_ISSUE: 'github-close_issue',
    ASSIGN_ISSUE: 'github-assign_issue',
    SET_ISSUE_MILESTONE: 'github-set_issue_milestone',

    // Composite tools
    OPEN_PULL_REQUEST: 'github-open_pull_request',
} as const;

export type ToolName = (typeof AvailableTools)[keyof typeof AvailableTools];

/**
 * Expand tool patterns into concrete tool names
 *
 * Supports glob patterns like:
 * - "github.*" -> all GitHub tools
 * - "git.*" -> all git tools
 * - "repository.*" -> all repository tools
 * - "*.read_file" -> all read_file tools
 *
 * @param patterns Array of tool names or patterns
 * @returns Array of concrete tool names
 */
function expandToolPatterns(patterns: string[]): string[] {
    const allTools = Object.values(AvailableTools);
    const expandedTools = new Set<string>();

    for (const pattern of patterns) {
        if (pattern.includes('*')) {
            // It's a glob pattern - match against all available tools
            const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
            const matches = allTools.filter((tool) => regex.test(tool));
            matches.forEach((tool) => {
                expandedTools.add(tool);
            });
        } else {
            // It's a concrete tool name
            expandedTools.add(pattern);
        }
    }

    return Array.from(expandedTools);
}

/**
 * Build a ToolRegistry with specified tools
 *
 * @param config Tool builder configuration
 * @param toolNames Array of tool names or patterns to include (supports glob patterns like "github.*")
 * @param logger The logger to use
 * @param dryRun If true, write tools will be simulated
 * @returns Configured ToolRegistry
 */
export function buildToolRegistry(
    config: ToolBuilderConfig,
    toolNames: string[],
    logger: Logger,
    dryRun: boolean = false,
): ToolRegistry {
    const registry = new ToolRegistry(dryRun, logger);

    // Create Octokit client for GitHub tools
    const octokit = new Octokit({
        auth: config.githubToken,
    });

    // Expand patterns into concrete tool names
    const expandedToolNames = expandToolPatterns(toolNames);

    // Register requested tools
    for (const toolName of expandedToolNames) {
        switch (toolName) {
            // Repository tools
            case AvailableTools.READ_FILE:
                if (!config.workDir) {
                    throw new Error('workDir is required for read_file tool');
                }
                registry.register(new ReadFileTool(config.workDir));
                break;

            case AvailableTools.LIST_FILES:
                if (!config.workDir) {
                    throw new Error('workDir is required for list_files tool');
                }
                registry.register(new ListFilesTool(config.workDir));
                break;

            case AvailableTools.SEARCH_CODE:
                if (!config.workDir) {
                    throw new Error('workDir is required for search_code tool');
                }
                registry.register(new SearchCodeTool(config.workDir));
                break;

            // GitHub read tools
            case AvailableTools.GET_ISSUE_DETAILS:
                registry.register(new GetIssueDetailsTool(octokit, config.owner, config.repo));
                break;

            case AvailableTools.GET_REPOSITORY_LABELS:
                registry.register(new GetRepositoryLabelsTool(octokit, config.owner, config.repo));
                break;

            // GitHub write tools
            case AvailableTools.ADD_LABELS:
                registry.register(new AddLabelsTool(octokit, config.owner, config.repo));
                break;

            case AvailableTools.ADD_COMMENT:
                registry.register(new AddCommentTool(octokit, config.owner, config.repo));
                break;

            case AvailableTools.ADD_DISCUSSION_RESPONSE:
                registry.register(new AddDiscussionResponseTool(octokit, config.owner, config.repo));
                break;

            // Git operation tools
            case AvailableTools.GIT_STATUS:
                if (!config.workDir) {
                    throw new Error('workDir is required for git_status tool');
                }
                registry.register(new GitStatusTool(config.workDir));
                break;

            case AvailableTools.GIT_DIFF:
                if (!config.workDir) {
                    throw new Error('workDir is required for git_diff tool');
                }
                registry.register(new GitDiffTool(config.workDir));
                break;

            case AvailableTools.GIT_CREATE_BRANCH:
                if (!config.workDir) {
                    throw new Error('workDir is required for git_create_branch tool');
                }
                registry.register(new GitCreateBranchTool(config.workDir));
                break;

            case AvailableTools.GIT_LOG:
                if (!config.workDir) {
                    throw new Error('workDir is required for git_log tool');
                }
                registry.register(new GitLogTool(config.workDir));
                break;

            // GitHub read tools (additional)
            case AvailableTools.GET_DISCUSSION:
                registry.register(new GetDiscussionTool(octokit, config.owner, config.repo));
                break;

            case AvailableTools.GET_MILESTONES:
                registry.register(new GetMilestonesTool(octokit, config.owner, config.repo));
                break;

            // GitHub write tools (additional)
            case AvailableTools.CREATE_ISSUE:
                registry.register(new CreateIssueTool(octokit, config.owner, config.repo));
                break;

            case AvailableTools.CREATE_PULL_REQUEST:
                registry.register(new CreatePullRequestTool(octokit, config.owner, config.repo));
                break;

            case AvailableTools.CLOSE_ISSUE:
                registry.register(new CloseIssueTool(octokit, config.owner, config.repo));
                break;

            case AvailableTools.ASSIGN_ISSUE:
                registry.register(new AssignIssueTool(octokit, config.owner, config.repo));
                break;

            case AvailableTools.SET_ISSUE_MILESTONE:
                registry.register(new SetIssueMilestoneTool(octokit, config.owner, config.repo));
                break;

            // Composite tools
            case AvailableTools.OPEN_PULL_REQUEST:
                if (!config.workDir) {
                    throw new Error('workDir is required for open_pull_request tool');
                }
                registry.register(new OpenPullRequestTool(octokit, config.owner, config.repo, config.workDir));
                break;

            default:
                logger.warn(`Unknown tool requested: ${toolName}`);
        }
    }

    logger.info(`Built tool registry with ${registry.getCount()} tools: ${registry.getToolNames().join(', ')}`);

    return registry;
}

/**
 * Helper function to parse repository owner/name from full repository string
 *
 * @param repository Repository string in format "owner/repo"
 * @returns Object with owner and repo
 */
export function parseRepository(repository: string): { owner: string; repo: string } {
    const parts = repository.split('/');
    if (parts.length !== 2) {
        throw new Error(`Invalid repository format: ${repository}. Expected "owner/repo"`);
    }

    return {
        owner: parts[0],
        repo: parts[1],
    };
}

/**
 * Helper function to get work directory path for an event
 *
 * @param baseWorkDir Base work directory path
 * @param eventType Type of event (issue, pull_request, etc.)
 * @param eventNumber Event number (issue number, PR number, etc.)
 * @returns Work directory path
 */
export function getWorkDirPath(baseWorkDir: string, eventType: string, eventNumber?: number): string {
    if (!eventNumber) {
        return path.join(baseWorkDir, 'repository');
    }

    // Use issue-N or pr-N format
    const prefix = eventType.includes('pull_request') ? 'pr' : 'issue';
    return path.join(baseWorkDir, `${prefix}-${eventNumber}`, 'repository');
}

/**
 * Tool categories for organizing tool output
 */
interface ToolCategories {
    'Repository Tools': string[];
    'Git Tools': string[];
    'GitHub Read Tools': string[];
    'GitHub Write Tools': string[];
    'Composite Tools': string[];
    Other: string[];
}

/**
 * Lists all available AI Agent tools with categorization
 *
 * Prints a formatted list of all available tools organized by category,
 * along with usage examples for config.yaml
 */
export function listAvailableTools(): void {
    console.log('Available AI Agent Tools:\n');
    console.log('='.repeat(80));
    console.log();

    const toolEntries = Object.entries(AvailableTools).sort((a, b) => a[1].localeCompare(b[1]));

    // Group tools by category
    const categories: ToolCategories = {
        'Repository Tools': [],
        'Git Tools': [],
        'GitHub Read Tools': [],
        'GitHub Write Tools': [],
        'Composite Tools': [],
        Other: [],
    };

    for (const [_key, toolName] of toolEntries) {
        if (toolName.startsWith('repository-')) {
            categories['Repository Tools'].push(toolName);
        } else if (toolName.startsWith('git-')) {
            categories['Git Tools'].push(toolName);
        } else if (toolName.startsWith('github-get_') || toolName.startsWith('github-get-')) {
            categories['GitHub Read Tools'].push(toolName);
        } else if (toolName.startsWith('github-')) {
            if (toolName.includes('open_pull_request')) {
                categories['Composite Tools'].push(toolName);
            } else {
                categories['GitHub Write Tools'].push(toolName);
            }
        } else {
            categories.Other.push(toolName);
        }
    }

    for (const [category, tools] of Object.entries(categories)) {
        if (tools.length > 0) {
            console.log(`${category}:`);
            for (const tool of tools) {
                console.log(`  - ${tool}`);
            }
            console.log();
        }
    }

    console.log('='.repeat(80));
    console.log(`Total: ${toolEntries.length} tools available`);
    console.log();
    console.log('Usage in config.yaml:');
    console.log('  actions:');
    console.log('    my-action:');
    console.log('      type: ai-agent');
    console.log('      prompt: my-prompt');
    console.log('      tools:');
    console.log('        - github-get_issue_details');
    console.log('        - github-add_comment');
    console.log('        - repository-*  # Wildcard patterns supported');
    console.log();
}
