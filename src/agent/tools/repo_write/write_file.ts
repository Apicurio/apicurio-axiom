/**
 * WriteFileTool - Write content to a file (create or overwrite)
 *
 * This tool allows the agent to write content to a file in the work directory,
 * creating it if it doesn't exist or overwriting if it does. It supports creating
 * parent directories, backing up existing files, and custom encoding.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const WriteFileTool: Tool = {
    name: 'repo_write-write_file',
    description:
        "Write content to a file, creating it if it doesn't exist or overwriting if it does. Supports creating parent directories and backing up existing files.",
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to file',
            },
            content: {
                type: 'string',
                description: 'Content to write to file',
            },
            encoding: {
                type: 'string',
                description: 'File encoding (default: utf-8)',
                default: 'utf-8',
            },
            create_directories: {
                type: 'boolean',
                description: "Create parent directories if they don't exist (default: true)",
                default: true,
            },
            backup: {
                type: 'boolean',
                description: 'Create backup of existing file (default: false)',
                default: false,
            },
        },
        required: ['path', 'content'],
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
            content: string;
            encoding?: string;
            create_directories?: boolean;
            backup?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-write_file',
                    tool: 'repo_write-write_file',
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

            if (input.content === undefined || input.content === null) {
                return {
                    error: true,
                    message: 'content parameter is required',
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
            const encoding = (input.encoding || 'utf-8') as BufferEncoding;
            const createDirectories = input.create_directories !== false; // default true
            const backup = input.backup === true; // default false

            // Check if file exists
            const exists = await fse.pathExists(fullPath);
            let backupPath: string | undefined;

            context.logger.info(`Writing file: ${input.path} (exists: ${exists})`);

            // Create backup if requested and file exists
            if (backup && exists) {
                backupPath = `${fullPath}.bak`;
                context.logger.info(`Creating backup: ${backupPath}`);
                await fse.copy(fullPath, backupPath, { overwrite: true });
            }

            // Ensure parent directories exist if requested
            if (createDirectories) {
                const dirPath = path.dirname(fullPath);
                await fse.ensureDir(dirPath);
            }

            // Write the file
            await fs.writeFile(fullPath, input.content, encoding);

            // Get file size
            const stats = await fs.stat(fullPath);

            context.logger.info(`File written successfully: ${input.path} (${stats.size} bytes, created: ${!exists})`);

            return {
                success: true,
                path: input.path,
                bytes_written: stats.size,
                backup_path: backupPath ? path.relative(context.workDir, backupPath) : undefined,
                created: !exists,
            };
        } catch (error) {
            context.logger.error(`Error in repo_write-write_file: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to write file: ${(error as Error).message}`,
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
            content: string;
            encoding?: string;
            create_directories?: boolean;
            backup?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-write_file',
                    tool: 'repo_write-write_file',
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

            if (input.content === undefined || input.content === null) {
                return {
                    error: true,
                    message: 'content parameter is required',
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

            // Check if file exists (read-only check)
            const exists = await fse.pathExists(fullPath);

            // Simulate backup path if requested
            const backup = input.backup === true;
            const backupPath = backup && exists ? `${input.path}.bak` : undefined;

            // Calculate simulated bytes
            const bytesWritten = Buffer.byteLength(input.content, 'utf-8');

            return {
                dry_run: true,
                message: `Would write ${bytesWritten} bytes to ${input.path}`,
                success: true,
                path: input.path,
                bytes_written: bytesWritten,
                backup_path: backupPath,
                created: !exists,
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
