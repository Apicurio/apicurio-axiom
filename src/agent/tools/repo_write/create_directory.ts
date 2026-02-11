/**
 * CreateDirectoryTool - Create a new directory in the repository
 *
 * This tool allows the agent to create directories within the work directory.
 * Supports automatic creation of parent directories. Succeeds idempotently
 * if the directory already exists.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const CreateDirectoryTool: Tool = {
    name: 'repo_write-create_directory',
    description:
        'Create a new directory in the repository. Supports creating parent directories automatically. Succeeds if directory already exists.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to directory to create',
            },
            recursive: {
                type: 'boolean',
                description: 'Create parent directories if needed (default: true)',
                default: true,
            },
        },
        required: ['path'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Result or error
     */
    async execute(
        input: {
            path: string;
            recursive?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-create_directory',
                    tool: 'repo_write-create_directory',
                };
            }

            // Validate input
            if (!input.path || typeof input.path !== 'string') {
                return {
                    error: true,
                    message: 'path parameter is required and must be a string',
                    tool: this.name,
                };
            }

            // Construct full path and validate it's within work directory
            const fullPath = path.resolve(context.workDir, input.path);
            const normalizedWorkDir = path.resolve(context.workDir);

            if (!fullPath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: path is outside work directory',
                    tool: this.name,
                };
            }

            // Set defaults
            const recursive = input.recursive !== false; // default true

            // Check if directory already exists
            const alreadyExists = await fse.pathExists(fullPath);

            context.logger.info(
                `Creating directory: ${input.path} (recursive: ${recursive}, exists: ${alreadyExists})`
            );

            // Track which parent directories will be created
            const parentsCreated: string[] = [];

            if (!alreadyExists && recursive) {
                // Check which parent directories don't exist
                const parts = input.path.split(path.sep).filter(p => p.length > 0);
                let currentPath = '';

                for (let i = 0; i < parts.length; i++) {
                    currentPath = path.join(currentPath, parts[i]);
                    const fullCurrentPath = path.resolve(context.workDir, currentPath);
                    const exists = await fse.pathExists(fullCurrentPath);

                    if (!exists) {
                        parentsCreated.push(currentPath);
                    }
                }
            } else if (!alreadyExists && !recursive) {
                // Check if immediate parent exists
                const parentPath = path.dirname(fullPath);
                const parentExists = await fse.pathExists(parentPath);

                if (!parentExists) {
                    return {
                        error: true,
                        message: `Parent directory does not exist: ${path.dirname(input.path)}. Use recursive flag to create parents.`,
                        tool: this.name,
                    };
                }

                parentsCreated.push(input.path);
            }

            // Create the directory (and parents if recursive)
            if (recursive) {
                await fse.ensureDir(fullPath);
            } else {
                if (!alreadyExists) {
                    await fs.mkdir(fullPath);
                }
            }

            context.logger.info(
                `Directory created: ${input.path} (created: ${!alreadyExists}, parents: ${parentsCreated.length})`
            );

            return {
                success: true,
                path: input.path,
                created: !alreadyExists,
                parents_created: parentsCreated,
            };
        } catch (error) {
            context.logger.error(`Error in repo_write-create_directory: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to create directory: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     */
    async executeMock(
        input: {
            path: string;
            recursive?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-create_directory',
                    tool: 'repo_write-create_directory',
                };
            }

            // Validate input
            if (!input.path || typeof input.path !== 'string') {
                return {
                    dry_run: true,
                    error: true,
                    message: 'path parameter is required and must be a string',
                    tool: this.name,
                };
            }

            // Construct full path and validate it's within work directory
            const fullPath = path.resolve(context.workDir, input.path);
            const normalizedWorkDir = path.resolve(context.workDir);

            if (!fullPath.startsWith(normalizedWorkDir)) {
                return {
                    dry_run: true,
                    error: true,
                    message: 'Access denied: path is outside work directory',
                    tool: this.name,
                };
            }

            // Set defaults
            const recursive = input.recursive !== false; // default true

            // Check if directory already exists
            const alreadyExists = await fse.pathExists(fullPath);

            // Simulate which parent directories would be created
            const parentsCreated: string[] = [];

            if (!alreadyExists && recursive) {
                // Check which parent directories don't exist
                const parts = input.path.split(path.sep).filter(p => p.length > 0);
                let currentPath = '';

                for (let i = 0; i < parts.length; i++) {
                    currentPath = path.join(currentPath, parts[i]);
                    const fullCurrentPath = path.resolve(context.workDir, currentPath);
                    const exists = await fse.pathExists(fullCurrentPath);

                    if (!exists) {
                        parentsCreated.push(currentPath);
                    }
                }
            } else if (!alreadyExists && !recursive) {
                // Check if immediate parent exists
                const parentPath = path.dirname(fullPath);
                const parentExists = await fse.pathExists(parentPath);

                if (!parentExists) {
                    return {
                        dry_run: true,
                        error: true,
                        message: `Parent directory does not exist: ${path.dirname(input.path)}. Use recursive flag to create parents.`,
                        tool: this.name,
                    };
                }

                parentsCreated.push(input.path);
            }

            return {
                dry_run: true,
                message: alreadyExists
                    ? `Directory already exists: ${input.path}`
                    : `Would create directory: ${input.path} (${parentsCreated.length} directories)`,
                success: true,
                path: input.path,
                created: !alreadyExists,
                parents_created: parentsCreated,
            };
        } catch (error) {
            return {
                dry_run: true,
                error: true,
                message: `Dry-run validation failed: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },
};
