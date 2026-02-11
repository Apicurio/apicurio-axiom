/**
 * MoveFileTool - Move or rename a file or directory
 *
 * This tool allows the agent to move or rename files and directories within the work directory.
 * Supports overwriting existing destinations and automatic parent directory creation.
 * Moving is atomic when on the same filesystem.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const MoveFileTool: Tool = {
    name: 'repo_write-move_file',
    description:
        'Move or rename a file or directory within the repository. Supports overwriting and automatic parent directory creation.',
    input_schema: {
        type: 'object',
        properties: {
            source: {
                type: 'string',
                description: 'Current path',
            },
            destination: {
                type: 'string',
                description: 'New path',
            },
            overwrite: {
                type: 'boolean',
                description: 'Overwrite if destination exists (default: false)',
                default: false,
            },
            create_directories: {
                type: 'boolean',
                description: 'Create parent directories if needed (default: true)',
                default: true,
            },
        },
        required: ['source', 'destination'],
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
            source: string;
            destination: string;
            overwrite?: boolean;
            create_directories?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-move_file',
                    tool: 'repo_write-move_file',
                };
            }

            // Validate input
            if (!input.source || typeof input.source !== 'string') {
                return {
                    error: true,
                    message: 'source parameter is required and must be a string',
                    tool: this.name,
                };
            }

            if (!input.destination || typeof input.destination !== 'string') {
                return {
                    error: true,
                    message: 'destination parameter is required and must be a string',
                    tool: this.name,
                };
            }

            // Construct full paths and validate they're within work directory
            const sourcePath = path.resolve(context.workDir, input.source);
            const destPath = path.resolve(context.workDir, input.destination);
            const normalizedWorkDir = path.resolve(context.workDir);

            if (!sourcePath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: source path is outside work directory',
                    tool: this.name,
                };
            }

            if (!destPath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: destination path is outside work directory',
                    tool: this.name,
                };
            }

            // Prevent moving to the same path
            if (sourcePath === destPath) {
                return {
                    error: true,
                    message: 'Source and destination paths are the same',
                    tool: this.name,
                };
            }

            // Check if source exists
            const sourceExists = await fse.pathExists(sourcePath);
            if (!sourceExists) {
                return {
                    error: true,
                    message: `Source does not exist: ${input.source}`,
                    tool: this.name,
                };
            }

            // Get source type
            const sourceStats = await fs.lstat(sourcePath);
            const sourceType: 'file' | 'directory' = sourceStats.isDirectory() ? 'directory' : 'file';

            // Check if destination exists
            const destExists = await fse.pathExists(destPath);

            // Set defaults
            const overwrite = input.overwrite === true;
            const createDirectories = input.create_directories !== false; // default true

            // If destination exists and overwrite is false, return error
            if (destExists && !overwrite) {
                return {
                    error: true,
                    message: `Destination already exists: ${input.destination}. Use overwrite flag to replace.`,
                    tool: this.name,
                };
            }

            context.logger.info(
                `Moving ${sourceType}: ${input.source} -> ${input.destination} (overwrite: ${overwrite})`
            );

            // Create parent directories if needed
            if (createDirectories) {
                const destDir = path.dirname(destPath);
                await fse.ensureDir(destDir);
            }

            // Move the file or directory
            // fs-extra's move() handles both files and directories
            await fse.move(sourcePath, destPath, { overwrite });

            context.logger.info(
                `Moved ${sourceType}: ${input.source} -> ${input.destination} (overwritten: ${destExists})`
            );

            return {
                success: true,
                source: input.source,
                destination: input.destination,
                type: sourceType,
                overwritten: destExists,
            };
        } catch (error) {
            context.logger.error(`Error in repo_write-move_file: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to move: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     */
    async executeMock(
        input: {
            source: string;
            destination: string;
            overwrite?: boolean;
            create_directories?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-move_file',
                    tool: 'repo_write-move_file',
                };
            }

            // Validate input
            if (!input.source || typeof input.source !== 'string') {
                return {
                    dry_run: true,
                    error: true,
                    message: 'source parameter is required and must be a string',
                    tool: this.name,
                };
            }

            if (!input.destination || typeof input.destination !== 'string') {
                return {
                    dry_run: true,
                    error: true,
                    message: 'destination parameter is required and must be a string',
                    tool: this.name,
                };
            }

            // Construct full paths and validate they're within work directory
            const sourcePath = path.resolve(context.workDir, input.source);
            const destPath = path.resolve(context.workDir, input.destination);
            const normalizedWorkDir = path.resolve(context.workDir);

            if (!sourcePath.startsWith(normalizedWorkDir)) {
                return {
                    dry_run: true,
                    error: true,
                    message: 'Access denied: source path is outside work directory',
                    tool: this.name,
                };
            }

            if (!destPath.startsWith(normalizedWorkDir)) {
                return {
                    dry_run: true,
                    error: true,
                    message: 'Access denied: destination path is outside work directory',
                    tool: this.name,
                };
            }

            // Prevent moving to the same path
            if (sourcePath === destPath) {
                return {
                    dry_run: true,
                    error: true,
                    message: 'Source and destination paths are the same',
                    tool: this.name,
                };
            }

            // Check if source exists (read-only check)
            const sourceExists = await fse.pathExists(sourcePath);
            if (!sourceExists) {
                return {
                    dry_run: true,
                    error: true,
                    message: `Source does not exist: ${input.source}`,
                    tool: this.name,
                };
            }

            // Get source type
            const sourceStats = await fs.lstat(sourcePath);
            const sourceType: 'file' | 'directory' = sourceStats.isDirectory() ? 'directory' : 'file';

            // Check if destination exists
            const destExists = await fse.pathExists(destPath);

            // Set defaults
            const overwrite = input.overwrite === true;

            // If destination exists and overwrite is false, return error
            if (destExists && !overwrite) {
                return {
                    dry_run: true,
                    error: true,
                    message: `Destination already exists: ${input.destination}. Use overwrite flag to replace.`,
                    tool: this.name,
                };
            }

            return {
                dry_run: true,
                message: `Would move ${sourceType}: ${input.source} -> ${input.destination}`,
                success: true,
                source: input.source,
                destination: input.destination,
                type: sourceType,
                overwritten: destExists,
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
