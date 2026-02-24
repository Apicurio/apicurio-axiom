/**
 * Configuration Loader
 *
 * Loads and validates the YAML configuration file.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import type { Config } from '../types/config.js';
import { validateConfiguration } from './validators.js';

/**
 * Loads the configuration from config.yaml
 *
 * @param customPath Optional custom path to config file
 * @returns Parsed configuration object
 */
export async function loadConfig(customPath?: string): Promise<Config> {
    const configPath = customPath ? resolve(customPath) : resolve(process.cwd(), 'config.yaml');

    try {
        const fileContent = await readFile(configPath, 'utf8');
        const config = load(fileContent) as Config;

        // Validate required fields
        validateConfig(config);

        // Process environment variable substitution
        const resolvedVars = new Set<string>();
        processEnvironmentVariables(config, 'config', resolvedVars);

        // Report resolved environment variables
        if (resolvedVars.size > 0) {
            console.log(`Resolved ${resolvedVars.size} environment variable(s):`);
            for (const varName of Array.from(resolvedVars).sort()) {
                console.log(`  - ${varName}`);
            }
        }

        return config;
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            const pathMsg = customPath ? `at ${configPath}` : 'config.yaml';
            throw new Error(
                `Configuration file not found ${pathMsg}. Please create config.yaml from config.example.yaml`,
            );
        }
        throw error;
    }
}

/**
 * Runs advanced configuration validation
 */
export async function validateConfigAdvanced(config: Config): Promise<void> {
    validateConfiguration(config);
}

/**
 * Validates the configuration structure
 */
function validateConfig(config: Config): void {
    // Validate Jira configuration
    if (!config.jira) {
        throw new Error('Configuration missing "jira" section');
    }

    if (!config.jira.url) {
        throw new Error('Configuration missing "jira.url"');
    }

    if (!config.jira.username) {
        throw new Error('Configuration missing "jira.username"');
    }

    if (!config.jira.apiToken) {
        throw new Error('Configuration missing "jira.apiToken"');
    }

    // Validate NATS configuration
    if (!config.nats) {
        throw new Error('Configuration missing "nats" section');
    }

    if (!config.nats.url) {
        throw new Error('Configuration missing "nats.url"');
    }

    // Validate projects
    if (!config.projects || !Array.isArray(config.projects) || config.projects.length === 0) {
        throw new Error('Configuration must include at least one project in "projects" array');
    }

    // Set defaults
    config.jira.pollInterval = config.jira.pollInterval || 120;
}

/**
 * Processes environment variable substitution in config values
 */
function processEnvironmentVariables(obj: any, path: string = 'config', resolvedVars: Set<string> = new Set()): void {
    if (obj === null || obj === undefined) {
        return;
    }

    if (typeof obj === 'string') {
        return;
    } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'string') {
                obj[i] = substituteEnvironmentVariables(obj[i], `${path}[${i}]`, resolvedVars);
            } else if (typeof obj[i] === 'object') {
                processEnvironmentVariables(obj[i], `${path}[${i}]`, resolvedVars);
            }
        }
    } else if (typeof obj === 'object') {
        for (const key in obj) {
            if (Object.hasOwn(obj, key)) {
                const value = obj[key];
                const currentPath = `${path}.${key}`;

                if (typeof value === 'string') {
                    obj[key] = substituteEnvironmentVariables(value, currentPath, resolvedVars);
                } else if (typeof value === 'object') {
                    processEnvironmentVariables(value, currentPath, resolvedVars);
                }
            }
        }
    }
}

/**
 * Substitutes environment variables in a string
 */
function substituteEnvironmentVariables(str: string, path: string, resolvedVars: Set<string>): string {
    const regex = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

    return str.replace(regex, (_match, varName) => {
        const value = process.env[varName];
        if (!value) {
            throw new Error(`Environment variable ${varName} referenced in ${path} is not set`);
        }
        resolvedVars.add(varName);
        return value;
    });
}
