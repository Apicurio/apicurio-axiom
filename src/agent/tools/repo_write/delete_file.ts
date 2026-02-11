/**
 * DeleteFileTool - Delete a file or directory from the repository
 *
 * This tool allows the agent to delete files or directories from the work directory.
 * Supports recursive deletion of directories and optional backup creation before deletion.
 * Use with caution as deletions are permanent unless a backup is created.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const DeleteFileTool: Tool = {
    name: 'repo_write-delete_file',
    description:
        'Delete a file or directory from the repository. Supports recursive deletion and optional backup creation.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to file or directory',
            },
            recursive: {
                type: 'boolean',
                description: 'For directories, delete recursively (default: false)',
                default: false,
            },
            backup: {
                type: 'boolean',
                description: 'Create backup before deleting (default: false)',
                default: false,
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
            backup?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-delete_file',
                    tool: 'repo_write-delete_file',
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

            // Prevent deletion of work directory itself
            if (fullPath === normalizedWorkDir) {
                return {
                    error: true,
                    message: 'Cannot delete the work directory itself',
                    tool: this.name,
                };
            }

            // Check if path exists
            const exists = await fse.pathExists(fullPath);
            if (!exists) {
                return {
                    error: true,
                    message: `Path does not exist: ${input.path}`,
                    tool: this.name,
                };
            }

            // Get path stats to determine if it's a file or directory
            const stats = await fs.lstat(fullPath);
            const isDirectory = stats.isDirectory();
            const pathType: 'file' | 'directory' = isDirectory ? 'directory' : 'file';

            // Set defaults
            const recursive = input.recursive === true;
            const createBackup = input.backup === true;

            // For directories, require recursive flag
            if (isDirectory && !recursive) {
                return {
                    error: true,
                    message: `Cannot delete directory without recursive flag: ${input.path}`,
                    tool: this.name,
                };
            }

            context.logger.info(
                `Deleting ${pathType}: ${input.path} (recursive: ${recursive}, backup: ${createBackup})`
            );

            // Count files that will be deleted
            let filesDeleted = 0;
            if (isDirectory) {
                filesDeleted = await countFilesRecursive(fullPath);
            } else {
                filesDeleted = 1;
            }

            // Create backup if requested
            let backupPath: string | undefined;
            if (createBackup) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFileName = `${path.basename(fullPath)}.backup-${timestamp}`;
                const backupFullPath = path.join(path.dirname(fullPath), backupFileName);

                context.logger.info(`Creating backup: ${backupFullPath}`);
                await fse.copy(fullPath, backupFullPath, { overwrite: false });
                backupPath = path.relative(context.workDir, backupFullPath);
            }

            // Delete the file or directory
            await fse.remove(fullPath);

            context.logger.info(
                `Deleted ${pathType}: ${input.path} (${filesDeleted} file${filesDeleted !== 1 ? 's' : ''})`
            );

            return {
                success: true,
                path: input.path,
                backup_path: backupPath,
                type: pathType,
                files_deleted: filesDeleted,
            };
        } catch (error) {
            context.logger.error(`Error in repo_write-delete_file: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to delete: ${(error as Error).message}`,
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
            backup?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-delete_file',
                    tool: 'repo_write-delete_file',
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

            // Prevent deletion of work directory itself
            if (fullPath === normalizedWorkDir) {
                return {
                    dry_run: true,
                    error: true,
                    message: 'Cannot delete the work directory itself',
                    tool: this.name,
                };
            }

            // Check if path exists (read-only check)
            const exists = await fse.pathExists(fullPath);
            if (!exists) {
                return {
                    dry_run: true,
                    error: true,
                    message: `Path does not exist: ${input.path}`,
                    tool: this.name,
                };
            }

            // Get path stats
            const stats = await fs.lstat(fullPath);
            const isDirectory = stats.isDirectory();
            const pathType: 'file' | 'directory' = isDirectory ? 'directory' : 'file';

            // Set defaults
            const recursive = input.recursive === true;
            const createBackup = input.backup === true;

            // For directories, require recursive flag
            if (isDirectory && !recursive) {
                return {
                    dry_run: true,
                    error: true,
                    message: `Cannot delete directory without recursive flag: ${input.path}`,
                    tool: this.name,
                };
            }

            // Count files that would be deleted
            let filesDeleted = 0;
            if (isDirectory) {
                filesDeleted = await countFilesRecursive(fullPath);
            } else {
                filesDeleted = 1;
            }

            // Simulate backup path
            const backupPath = createBackup
                ? `${path.basename(fullPath)}.backup-[timestamp]`
                : undefined;

            return {
                dry_run: true,
                message: `Would delete ${pathType}: ${input.path} (${filesDeleted} file${filesDeleted !== 1 ? 's' : ''})`,
                success: true,
                path: input.path,
                backup_path: backupPath,
                type: pathType,
                files_deleted: filesDeleted,
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
 * Count files recursively in a directory
 *
 * @param dirPath Path to directory
 * @returns Number of files
 */
async function countFilesRecursive(dirPath: string): Promise<number> {
    let count = 0;

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                count += await countFilesRecursive(fullPath);
            } else {
                count++;
            }
        }
    } catch (error) {
        // If we can't read a directory, just return current count
        // This can happen with permission issues
    }

    return count;
}
