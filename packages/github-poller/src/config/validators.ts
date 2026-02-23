/**
 * Configuration validators
 */

import type { Config } from '../types/config.js';

/**
 * Validates repository format (owner/repo)
 */
function isValidRepository(repo: string): boolean {
    const repoPattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    return repoPattern.test(repo);
}

/**
 * Validates the configuration
 *
 * @param config Configuration object to validate
 * @throws Error if configuration is invalid
 */
export function validateConfiguration(config: Config): void {
    // Validate GitHub config
    if (!config.github) {
        throw new Error('GitHub configuration is required');
    }

    if (!config.github.token) {
        throw new Error('GitHub token is required');
    }

    // Validate NATS config
    if (!config.nats) {
        throw new Error('NATS configuration is required');
    }

    if (!config.nats.url) {
        throw new Error('NATS URL is required');
    }

    // Validate repositories
    if (!config.repositories || !Array.isArray(config.repositories)) {
        throw new Error('Repositories must be an array');
    }

    if (config.repositories.length === 0) {
        throw new Error('At least one repository must be configured');
    }

    for (const repo of config.repositories) {
        if (!isValidRepository(repo)) {
            throw new Error(`Invalid repository format: ${repo}. Expected format: owner/repo`);
        }
    }
}
