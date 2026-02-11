/**
 * CopyFileTool - Copy a file or directory to another location
 *
 * This tool allows the agent to copy files and directories within the work directory.
 * Supports recursive copying of directories and optional overwriting of existing destinations.
 * Useful for creating backups, duplicating templates, or copying code to new locations.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const CopyFileTool: Tool = {
    name: 'repo_write-copy_file',
    description:
        'Copy a file or directory to another location in the repository. Supports recursive copying and overwrite options.',
    input_schema: {
        type: 'object',
        properties: {
            source: {
                type: 'string',
                description: 'Path to copy from',
            },
            destination: {
                type: 'string',
                description: 'Path to copy to',
            },
            overwrite: {
                type: 'boolean',
                description: 'Overwrite if destination exists (default: false)',
                default: false,
            },
            recursive: {
                type: 'boolean',
                description: 'For directories, copy recursively (default: true)',
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
            recursive?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-copy_file',
                    tool: 'repo_write-copy_file',
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

            // Prevent copying to the same path
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

            // Get source stats
            const sourceStats = await fs.lstat(sourcePath);
            const isDirectory = sourceStats.isDirectory();

            // Set defaults
            const overwrite = input.overwrite === true;
            const recursive = input.recursive !== false; // default true

            // For directories, require recursive flag to be true
            if (isDirectory && !recursive) {
                return {
                    error: true,
                    message: `Cannot copy directory without recursive flag: ${input.source}`,
                    tool: this.name,
                };
            }

            // Check if destination exists
            const destExists = await fse.pathExists(destPath);

            // If destination exists and overwrite is false, return error
            if (destExists && !overwrite) {
                return {
                    error: true,
                    message: `Destination already exists: ${input.destination}. Use overwrite flag to replace.`,
                    tool: this.name,
                };
            }

            context.logger.info(
                `Copying: ${input.source} -> ${input.destination} (overwrite: ${overwrite}, recursive: ${recursive})`,
            );

            // Copy the file or directory
            await fse.copy(sourcePath, destPath, { overwrite });

            // Calculate bytes and files copied
            const { bytesCopied, filesCopied } = await calculateCopyStats(destPath);

            context.logger.info(
                `Copied: ${input.source} -> ${input.destination} (${filesCopied} file${filesCopied !== 1 ? 's' : ''}, ${bytesCopied} bytes)`,
            );

            return {
                success: true,
                source: input.source,
                destination: input.destination,
                bytes_copied: bytesCopied,
                files_copied: filesCopied,
            };
        } catch (error) {
            context.logger.error(`Error in repo_write-copy_file: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to copy: ${(error as Error).message}`,
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
            recursive?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-copy_file',
                    tool: 'repo_write-copy_file',
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

            // Prevent copying to the same path
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

            // Get source stats
            const sourceStats = await fs.lstat(sourcePath);
            const isDirectory = sourceStats.isDirectory();

            // Set defaults
            const overwrite = input.overwrite === true;
            const recursive = input.recursive !== false; // default true

            // For directories, require recursive flag to be true
            if (isDirectory && !recursive) {
                return {
                    dry_run: true,
                    error: true,
                    message: `Cannot copy directory without recursive flag: ${input.source}`,
                    tool: this.name,
                };
            }

            // Check if destination exists
            const destExists = await fse.pathExists(destPath);

            // If destination exists and overwrite is false, return error
            if (destExists && !overwrite) {
                return {
                    dry_run: true,
                    error: true,
                    message: `Destination already exists: ${input.destination}. Use overwrite flag to replace.`,
                    tool: this.name,
                };
            }

            // Calculate what would be copied (read source stats)
            const { bytesCopied, filesCopied } = await calculateCopyStats(sourcePath);

            return {
                dry_run: true,
                message: `Would copy ${filesCopied} file${filesCopied !== 1 ? 's' : ''} (${bytesCopied} bytes): ${input.source} -> ${input.destination}`,
                success: true,
                source: input.source,
                destination: input.destination,
                bytes_copied: bytesCopied,
                files_copied: filesCopied,
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

/**
 * Calculate copy statistics (bytes and files)
 *
 * @param dirPath Path to directory or file
 * @returns Statistics object
 */
async function calculateCopyStats(dirPath: string): Promise<{ bytesCopied: number; filesCopied: number }> {
    let bytesCopied = 0;
    let filesCopied = 0;

    try {
        const stats = await fs.lstat(dirPath);

        if (stats.isDirectory()) {
            // Recursively count files and bytes in directory
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    const subStats = await calculateCopyStats(fullPath);
                    bytesCopied += subStats.bytesCopied;
                    filesCopied += subStats.filesCopied;
                } else {
                    const fileStats = await fs.lstat(fullPath);
                    bytesCopied += fileStats.size;
                    filesCopied++;
                }
            }
        } else {
            // Single file
            bytesCopied = stats.size;
            filesCopied = 1;
        }
    } catch (_error) {
        // If we can't read, just return what we have
    }

    return { bytesCopied, filesCopied };
}
