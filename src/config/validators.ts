/**
 * Configuration Validators
 *
 * Advanced validation for configuration including action references,
 * tool patterns, repository access, and circular dependencies.
 */

import { Octokit } from '@octokit/rest';
import { ToolIndex } from '../agent/tools/index.js';
import type { AIAgentAction } from '../types/actions.js';
import type { Config } from '../types/config.js';

/**
 * Validation error class for configuration issues
 */
export class ConfigValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigValidationError';
    }
}

/**
 * Validates that all action references in event mappings exist
 *
 * @param config Configuration object
 * @throws ConfigValidationError if any action reference is invalid
 */
export function validateActionReferences(config: Config): void {
    const definedActions = new Set(Object.keys(config.actions || {}));

    for (let i = 0; i < config.eventMappings.length; i++) {
        const mapping = config.eventMappings[i];

        if (!mapping.actions || mapping.actions.length === 0) {
            throw new ConfigValidationError(`Event mapping #${i + 1} (event: ${mapping.event}) has no actions defined`);
        }

        for (const actionName of mapping.actions) {
            if (!definedActions.has(actionName)) {
                throw new ConfigValidationError(
                    `Event mapping #${i + 1} (event: ${mapping.event}) references undefined action: "${actionName}"`,
                );
            }
        }
    }
}

/**
 * Validates tool patterns in AI agent actions
 *
 * @param config Configuration object
 * @throws ConfigValidationError if any tool pattern is invalid
 */
export function validateToolPatterns(config: Config): void {
    // Get valid tools from the authoritative source (ToolIndex)
    const validTools: string[] = ToolIndex.getInstance().getNames();

    // Extract valid prefixes from the tool names
    const prefixSet = new Set<string>();
    for (const tool of validTools) {
        const parts = tool.split('-');
        if (parts.length >= 2) {
            prefixSet.add(`${parts[0]}-`);
        }
    }
    const validToolPrefixes = Array.from(prefixSet).sort();

    for (const [actionName, actionConfig] of Object.entries(config.actions || {})) {
        if (actionConfig.type === 'ai-agent') {
            const aiAction = actionConfig as AIAgentAction;

            if (!aiAction.tools || aiAction.tools.length === 0) {
                throw new ConfigValidationError(`AI agent action "${actionName}" has no tools defined`);
            }

            for (const tool of aiAction.tools) {
                // Check if it's a wildcard pattern
                if (tool.endsWith('-*')) {
                    const prefix = tool.slice(0, -1); // Remove the *
                    if (!validToolPrefixes.includes(prefix)) {
                        throw new ConfigValidationError(
                            `AI agent action "${actionName}" uses invalid tool pattern: "${tool}". ` +
                                `Valid prefixes: ${validToolPrefixes.join(', ')}`,
                        );
                    }
                } else if (tool === '*') {
                    // Allow full wildcard (no validation needed)
                } else {
                    // Check if it's a specific valid tool
                    if (!validTools.includes(tool)) {
                        throw new ConfigValidationError(
                            `AI agent action "${actionName}" references unknown tool: "${tool}". ` +
                                `Use a wildcard pattern (e.g., "github-*") or one of: ${validTools.join(', ')}`,
                        );
                    }
                }
            }
        }
    }
}

/**
 * Validates repository access using GitHub API
 *
 * @param config Configuration object
 * @param skipAccessCheck If true, only validates format without checking access
 * @throws ConfigValidationError if any repository is inaccessible
 */
export async function validateRepositoryAccess(config: Config, skipAccessCheck: boolean = false): Promise<void> {
    if (skipAccessCheck) {
        return;
    }

    const octokit = new Octokit({ auth: config.github.token });

    const errors: string[] = [];

    for (const repo of config.repositories) {
        const [owner, repoName] = repo.split('/');

        try {
            await octokit.repos.get({
                owner,
                repo: repoName,
            });
        } catch (error) {
            if ((error as any).status === 404) {
                errors.push(`Repository "${repo}" not found or not accessible`);
            } else if ((error as any).status === 401) {
                errors.push(`Authentication failed for repository "${repo}"`);
            } else {
                errors.push(`Failed to access repository "${repo}": ${(error as Error).message}`);
            }
        }
    }

    if (errors.length > 0) {
        throw new ConfigValidationError(`Repository access validation failed:\n  - ${errors.join('\n  - ')}`);
    }
}

/**
 * Detects circular dependencies in event mappings
 *
 * While the current implementation doesn't support chaining events directly,
 * this validates that no action could trigger itself through event generation.
 *
 * @param config Configuration object
 * @throws ConfigValidationError if circular dependencies are detected
 */
export function validateNoCircularDependencies(config: Config): void {
    // For now, this is a placeholder as the bot doesn't support actions
    // triggering new events. This would be relevant if actions could
    // create issues/PRs that trigger other actions.

    // We can add a warning if the same action is mapped to multiple
    // related events that could cause rapid firing
    const actionEventCounts = new Map<string, number>();

    for (const mapping of config.eventMappings) {
        for (const actionName of mapping.actions) {
            const count = actionEventCounts.get(actionName) || 0;
            actionEventCounts.set(actionName, count + 1);
        }
    }

    // Warn if an action is used in many mappings (might indicate misconfiguration)
    for (const [actionName, count] of actionEventCounts.entries()) {
        if (count > 10) {
            console.warn(
                `Warning: Action "${actionName}" is used in ${count} event mappings. ` +
                    `This might cause high load if many events occur.`,
            );
        }
    }
}

/**
 * Validates that AI agent actions reference valid prompts
 *
 * @param config Configuration object
 * @param availablePrompts Set of available prompt names
 * @throws ConfigValidationError if any prompt reference is invalid
 */
export function validatePromptReferences(config: Config, availablePrompts: Set<string>): void {
    for (const [actionName, actionConfig] of Object.entries(config.actions || {})) {
        if (actionConfig.type === 'ai-agent') {
            const aiAction = actionConfig as AIAgentAction;

            if (!aiAction.prompt) {
                throw new ConfigValidationError(`AI agent action "${actionName}" has no prompt defined`);
            }

            if (!availablePrompts.has(aiAction.prompt)) {
                throw new ConfigValidationError(
                    `AI agent action "${actionName}" references undefined prompt: "${aiAction.prompt}". ` +
                        `Available prompts: ${Array.from(availablePrompts).join(', ')}`,
                );
            }
        }
    }
}

/**
 * Validates event type patterns
 *
 * @param config Configuration object
 * @throws ConfigValidationError if any event pattern is invalid
 */
export function validateEventPatterns(config: Config): void {
    const validEventTypes = [
        'issue.opened',
        'issue.closed',
        'issue.reopened',
        'issue.labeled',
        'issue.unlabeled',
        'issue.assigned',
        'issue.unassigned',
        'issue.edited',
        'issue.deleted',
        'issue.transferred',
        'issue.pinned',
        'issue.unpinned',
        'issue.locked',
        'issue.unlocked',
        'pull_request.opened',
        'pull_request.closed',
        'pull_request.reopened',
        'pull_request.synchronize',
        'pull_request.labeled',
        'pull_request.unlabeled',
        'pull_request.assigned',
        'pull_request.unassigned',
        'pull_request.edited',
        'pull_request.ready_for_review',
        'pull_request.converted_to_draft',
        'pull_request.review_requested',
        'pull_request.review_request_removed',
        'issue_comment.created',
        'issue_comment.edited',
        'issue_comment.deleted',
        'pull_request_review.submitted',
        'pull_request_review.edited',
        'pull_request_review.dismissed',
        'pull_request_review_comment.created',
        'pull_request_review_comment.edited',
        'pull_request_review_comment.deleted',
        'discussion.created',
        'discussion.edited',
        'discussion.deleted',
        'discussion.answered',
        'discussion.unanswered',
        'discussion.labeled',
        'discussion.unlabeled',
        'discussion.locked',
        'discussion.unlocked',
        'discussion.pinned',
        'discussion.unpinned',
        'discussion.transferred',
        'discussion.category_changed',
        'push',
        'release.published',
        'release.created',
        'release.edited',
        'release.deleted',
        'release.prereleased',
        'release.released',
    ];

    const validWildcards = [
        '*',
        'issue.*',
        'pull_request.*',
        'issue_comment.*',
        'pull_request_review.*',
        'pull_request_review_comment.*',
        'discussion.*',
        'release.*',
    ];

    for (let i = 0; i < config.eventMappings.length; i++) {
        const mapping = config.eventMappings[i];
        const eventPattern = mapping.event;

        // Check if it's a wildcard
        if (eventPattern.includes('*')) {
            if (!validWildcards.includes(eventPattern)) {
                throw new ConfigValidationError(
                    `Event mapping #${i + 1} uses invalid wildcard pattern: "${eventPattern}". ` +
                        `Valid wildcards: ${validWildcards.join(', ')}`,
                );
            }
        } else {
            // Check if it's a valid specific event type
            if (!validEventTypes.includes(eventPattern)) {
                console.warn(
                    `Warning: Event mapping #${i + 1} uses unrecognized event type: "${eventPattern}". ` +
                        `This might be valid but is not in the known event types list.`,
                );
            }
        }
    }
}

/**
 * Runs all configuration validations
 *
 * @param config Configuration object
 * @param options Validation options
 * @throws ConfigValidationError if any validation fails
 */
export async function validateConfiguration(
    config: Config,
    options: {
        skipRepositoryAccess?: boolean;
        availablePrompts?: Set<string>;
    } = {},
): Promise<void> {
    const errors: string[] = [];

    try {
        validateActionReferences(config);
    } catch (error) {
        errors.push((error as Error).message);
    }

    try {
        validateToolPatterns(config);
    } catch (error) {
        errors.push((error as Error).message);
    }

    try {
        validateEventPatterns(config);
    } catch (error) {
        errors.push((error as Error).message);
    }

    if (options.availablePrompts) {
        try {
            validatePromptReferences(config, options.availablePrompts);
        } catch (error) {
            errors.push((error as Error).message);
        }
    }

    try {
        validateNoCircularDependencies(config);
    } catch (error) {
        errors.push((error as Error).message);
    }

    try {
        await validateRepositoryAccess(config, options.skipRepositoryAccess || false);
    } catch (error) {
        errors.push((error as Error).message);
    }

    if (errors.length > 0) {
        throw new ConfigValidationError(`Configuration validation failed:\n\n${errors.join('\n\n')}`);
    }
}
