/**
 * GetFileMetadataTool - Get detailed metadata about a file or directory
 *
 * This tool provides comprehensive metadata about a file or directory including
 * size, timestamps, permissions, and file characteristics. For text files, it also
 * includes line count and encoding information.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const GetFileMetadataTool: Tool = {
    name: 'repo_read-get_file_metadata',
    description:
        'Get detailed metadata about a file or directory including size, timestamps, permissions, and file characteristics',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path from repository root to the file or directory',
            },
        },
        required: ['path'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns File metadata or error
     */
    async execute(input: { path: string }, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_read-get_file_metadata',
                    tool: 'repo_read-get_file_metadata',
                };
            }

            // Validate input
            if (!input.path) {
                return {
                    error: true,
                    message: 'path parameter is required',
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

            // Normalize the path for return value
            const normalizedPath = input.path;

            // Check if path exists
            const exists = await fse.pathExists(fullPath);
            if (!exists) {
                return {
                    path: normalizedPath,
                    exists: false,
                    type: null,
                };
            }

            // Get file stats
            const stats = await fs.stat(fullPath);
            const lstat = await fs.lstat(fullPath);

            // Determine type
            let type: 'file' | 'directory' | 'symlink';
            if (lstat.isSymbolicLink()) {
                type = 'symlink';
            } else if (stats.isDirectory()) {
                type = 'directory';
            } else {
                type = 'file';
            }

            // Get permissions as octal string (e.g., '755', '644')
            const permissions = (stats.mode & 0o777).toString(8);

            // Base metadata object
            const metadata: any = {
                path: normalizedPath,
                exists: true,
                type: type,
                size: stats.size,
                permissions: permissions,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
                accessed: stats.atime.toISOString(),
            };

            // For files, add additional file-specific metadata
            if (type === 'file') {
                const extension = path.extname(fullPath).substring(1); // Remove leading dot
                metadata.extension = extension || undefined;

                // Detect if binary by reading first 8000 bytes
                const buffer = Buffer.alloc(Math.min(8000, stats.size));
                const fd = await fs.open(fullPath, 'r');
                try {
                    await fd.read(buffer, 0, buffer.length, 0);
                } finally {
                    await fd.close();
                }

                // Check for null bytes (indicator of binary file)
                const isBinary = buffer.includes(0);
                metadata.is_binary = isBinary;
                metadata.is_text = !isBinary;

                // For text files, count lines and detect encoding
                if (!isBinary) {
                    try {
                        const contents = await fs.readFile(fullPath, 'utf-8');
                        metadata.lines = contents.split('\n').length;
                        metadata.encoding = 'utf-8';
                    } catch {
                        // If UTF-8 fails, file might have different encoding
                        // For simplicity, we'll just mark encoding as unknown
                        metadata.encoding = 'unknown';
                        metadata.lines = undefined;
                    }
                }
            }

            return metadata;
        } catch (error) {
            return {
                error: true,
                message: `Failed to get file metadata: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { path: string }, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
