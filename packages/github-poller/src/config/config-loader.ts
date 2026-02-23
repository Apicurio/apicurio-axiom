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
 * @throws Error if configuration is invalid or missing
 */
export async function loadConfig(customPath?: string): Promise<Config> {
    const configPath = customPath ? resolve(customPath) : resolve(process.cwd(), 'config.yaml');

    try {
        const fileContent = await readFile(configPath, 'utf8');
        const config = load(fileContent) as Config;

        // Validate required fields
        validateConfig(config);

        // Process environment variable substitution and collect resolved variables
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
 *
 * This should be called after the application has loaded prompts and other resources.
 *
 * @param config Configuration object
 * @param options Validation options
 * @throws Error if validation fails
 */
export async function validateConfigAdvanced(config: Config): Promise<void> {
    validateConfiguration(config);
}

/**
 * Validates the configuration structure
 *
 * @param config Configuration object to validate
 * @throws Error if configuration is invalid
 */
function validateConfig(config: Config): void {
    if (!config.github) {
        throw new Error('Configuration missing "github" section');
    }

    if (!config.github.token) {
        throw new Error('Configuration missing "github.token"');
    }

    if (!config.repositories || !Array.isArray(config.repositories) || config.repositories.length === 0) {
        throw new Error('Configuration must include at least one repository in "repositories" array');
    }

    // Validate repository format (owner/repo)
    for (const repo of config.repositories) {
        if (!repo.match(/^[\w-]+\/[\w.-]+$/)) {
            throw new Error(`Invalid repository format: ${repo}. Expected format: owner/repo`);
        }
    }

    // Set defaults
    config.github.pollInterval = config.github.pollInterval || 60;
}

/**
 * Processes environment variable substitution in config values
 *
 * Recursively walks through the configuration object and replaces
 * ${VAR_NAME} patterns with environment variable values.
 * Supports both full-value substitution (${VAR}) and partial substitution (${VAR}/path).
 * Throws an error if any referenced environment variable is not set.
 *
 * @param obj Configuration object (or sub-object) to process
 * @param path Current path in the object tree (for error messages)
 * @param resolvedVars Set to collect names of resolved environment variables
 * @throws Error if a referenced environment variable is not set
 */
function processEnvironmentVariables(obj: any, path: string = 'config', resolvedVars: Set<string> = new Set()): void {
    if (obj === null || obj === undefined) {
        return;
    }

    // Process based on type
    if (typeof obj === 'string') {
        // String values can't be modified in place, they need to be replaced by the parent
        // This case only validates; replacement happens in array/object processing below
        validateEnvironmentVariables(obj, path);
        return;
    } else if (Array.isArray(obj)) {
        // Process each array element and replace if needed
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'string') {
                obj[i] = substituteEnvironmentVariables(obj[i], `${path}[${i}]`, resolvedVars);
            } else if (typeof obj[i] === 'object') {
                processEnvironmentVariables(obj[i], `${path}[${i}]`, resolvedVars);
            }
        }
    } else if (typeof obj === 'object') {
        // Process each object property and replace if needed
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
 * Validates that all environment variables referenced in a string are set
 *
 * @param str String to validate
 * @param path Current path in config (for error messages)
 * @throws Error if a referenced environment variable is not set
 */
function validateEnvironmentVariables(str: string, path: string): void {
    const regex = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
    const matches = str.matchAll(regex);

    for (const match of matches) {
        const varName = match[1];
        if (!process.env[varName]) {
            throw new Error(`Environment variable ${varName} referenced in ${path} is not set`);
        }
    }
}

/**
 * Substitutes environment variables in a string
 *
 * Replaces all ${VAR_NAME} patterns with their environment variable values.
 * Supports both full-value substitution (${VAR}) and partial substitution (${VAR}/path).
 *
 * @param str String containing environment variable references
 * @param path Current path in config (for error messages)
 * @param resolvedVars Set to collect names of resolved environment variables
 * @returns String with all environment variables substituted
 * @throws Error if a referenced environment variable is not set
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
