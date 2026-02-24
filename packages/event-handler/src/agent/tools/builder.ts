/**
 * Tool Builder
 *
 * Utility for building and configuring tool registries based on event context.
 * This bridges the action executor and the tool system by creating properly
 * configured tools for each event.
 */

import * as path from 'node:path';
import { Octokit } from '@octokit/rest';
import type { Logger } from '@axiom/common';
import type { ToolContext } from '../../types/agent.js';
import { ToolIndex } from './index.js';
import { ToolRegistry } from './registry.js';

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

    // Maximum tool output size in tokens (approximate)
    maxToolOutputTokens?: number;
}

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
    const allTools = ToolIndex.getInstance().getNames();
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
    // Create tool context from config
    const context: ToolContext = {
        workDir: config.workDir,
        logger: logger,
        octokit: new Octokit({ auth: config.githubToken }),
        owner: config.owner,
        repo: config.repo,
        dryRun: dryRun,
        maxToolOutputTokens: config.maxToolOutputTokens,
    };

    // Create registry with context
    const registry = new ToolRegistry(context);

    // Expand patterns into concrete tool names
    const expandedToolNames = expandToolPatterns(toolNames);

    // Register requested tools
    for (const toolName of expandedToolNames) {
        const tool = ToolIndex.getInstance().get(toolName);
        if (tool) {
            registry.register(tool);
        } else {
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
    'Repository Read Tools': string[];
    'Repository Write Tools': string[];
    'Git Read Tools': string[];
    'Git Write Tools': string[];
    'GitHub Read Tools': string[];
    'GitHub Write Tools': string[];
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

    const toolNames = ToolIndex.getInstance().getNames().sort();

    // Group tools by category
    const categories: ToolCategories = {
        'Repository Read Tools': [],
        'Repository Write Tools': [],
        'Git Read Tools': [],
        'Git Write Tools': [],
        'GitHub Read Tools': [],
        'GitHub Write Tools': [],
        Other: [],
    };

    for (const toolName of toolNames) {
        if (toolName.startsWith('repo_read-')) {
            categories['Repository Read Tools'].push(toolName);
        } else if (toolName.startsWith('repo_write-')) {
            categories['Repository Write Tools'].push(toolName);
        } else if (toolName.startsWith('git_read-')) {
            categories['Git Read Tools'].push(toolName);
        } else if (toolName.startsWith('git_write-')) {
            categories['Git Write Tools'].push(toolName);
        } else if (toolName.startsWith('github_read-')) {
            categories['GitHub Read Tools'].push(toolName);
        } else if (toolName.startsWith('github_write-')) {
            categories['GitHub Write Tools'].push(toolName);
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
    console.log(`Total: ${toolNames.length} tools available`);
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
