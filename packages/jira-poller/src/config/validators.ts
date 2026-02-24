/**
 * Configuration validators
 */

import type { Config } from '../types/config.js';

/**
 * Validates project format (uppercase alphanumeric with underscores)
 */
function isValidProject(project: string): boolean {
    const projectPattern = /^[A-Z][A-Z0-9_]*$/;
    return projectPattern.test(project);
}

/**
 * Validates the configuration
 *
 * @param config Configuration object to validate
 * @throws Error if configuration is invalid
 */
export function validateConfiguration(config: Config): void {
    // Validate Jira config
    if (!config.jira) {
        throw new Error('Jira configuration is required');
    }

    if (!config.jira.url) {
        throw new Error('Jira URL is required');
    }

    if (!config.jira.username) {
        throw new Error('Jira username is required');
    }

    if (!config.jira.apiToken) {
        throw new Error('Jira API token is required');
    }

    // Validate NATS config
    if (!config.nats) {
        throw new Error('NATS configuration is required');
    }

    if (!config.nats.url) {
        throw new Error('NATS URL is required');
    }

    // Validate projects
    if (!config.projects || !Array.isArray(config.projects)) {
        throw new Error('Projects must be an array');
    }

    if (config.projects.length === 0) {
        throw new Error('At least one project must be configured');
    }

    for (const project of config.projects) {
        if (!isValidProject(project)) {
            throw new Error(
                `Invalid project format: ${project}. Expected uppercase alphanumeric with underscores (e.g., "APICURIO")`,
            );
        }
    }
}
