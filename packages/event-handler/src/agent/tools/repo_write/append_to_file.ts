/**
 * AppendToFileTool - Append content to the end of an existing file
 *
 * This tool allows the agent to append content to an existing file in the work directory.
 * Useful for adding entries to logs, lists, or incremental file building. The file must
 * already exist; this tool will not create a new file.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const AppendToFileTool: Tool = {
    name: 'repo_write-append_to_file',
    description:
        'Append content to the end of an existing file. The file must already exist. Optionally adds a newline before the content.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to file',
            },
            content: {
                type: 'string',
                description: 'Content to append',
            },
            newline: {
                type: 'boolean',
                description: 'Add newline before content (default: true)',
                default: true,
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
            newline?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-append_to_file',
                    tool: 'repo_write-append_to_file',
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

            // Check if file exists
            const exists = await fse.pathExists(fullPath);
            if (!exists) {
                return {
                    error: true,
                    message: `File does not exist: ${input.path}`,
                    tool: this.name,
                };
            }

            // Get original file size
            const statsBefore = await fs.stat(fullPath);
            const sizeBefore = statsBefore.size;

            // Set default for newline
            const addNewline = input.newline !== false; // default true

            // Prepare content to append
            const contentToAppend = addNewline ? `\n${input.content}` : input.content;

            context.logger.info(`Appending to file: ${input.path} (${contentToAppend.length} bytes)`);

            // Append the content
            await fs.appendFile(fullPath, contentToAppend, 'utf-8');

            // Get new file size
            const statsAfter = await fs.stat(fullPath);
            const sizeAfter = statsAfter.size;
            const bytesAppended = sizeAfter - sizeBefore;

            context.logger.info(
                `Content appended successfully: ${input.path} (appended: ${bytesAppended} bytes, new size: ${sizeAfter} bytes)`,
            );

            return {
                success: true,
                path: input.path,
                bytes_appended: bytesAppended,
                new_size: sizeAfter,
            };
        } catch (error) {
            context.logger.error(`Error in repo_write-append_to_file: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to append to file: ${(error as Error).message}`,
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
            newline?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-append_to_file',
                    tool: 'repo_write-append_to_file',
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
            if (!exists) {
                return {
                    dry_run: true,
                    error: true,
                    message: `File does not exist: ${input.path}`,
                    tool: this.name,
                };
            }

            // Get current file size (read-only)
            const stats = await fs.stat(fullPath);
            const currentSize = stats.size;

            // Calculate bytes that would be appended
            const addNewline = input.newline !== false; // default true
            const contentToAppend = addNewline ? `\n${input.content}` : input.content;
            const bytesAppended = Buffer.byteLength(contentToAppend, 'utf-8');
            const newSize = currentSize + bytesAppended;

            return {
                dry_run: true,
                message: `Would append ${bytesAppended} bytes to ${input.path}`,
                success: true,
                path: input.path,
                bytes_appended: bytesAppended,
                new_size: newSize,
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
