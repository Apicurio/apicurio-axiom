/**
 * ReplaceLinesTool - Replace a range of lines in a file with new content
 *
 * This tool allows the agent to replace a specific range of lines in a file with new content.
 * More precise than text search/replace when line numbers are known. Useful for replacing
 * methods, blocks of code, or specific sections when you have exact line number information.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const ReplaceLinesTool: Tool = {
    name: 'repo_write-replace_lines',
    description:
        'Replace a range of lines in a file with new content. Line numbers are 1-based and inclusive. More precise than search/replace when exact line numbers are known.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to file',
            },
            start_line: {
                type: 'number',
                description: 'First line to replace (1-based)',
                minimum: 1,
            },
            end_line: {
                type: 'number',
                description: 'Last line to replace (1-based, inclusive)',
                minimum: 1,
            },
            new_content: {
                type: 'string',
                description: 'Content to replace the line range with',
            },
        },
        required: ['path', 'start_line', 'end_line', 'new_content'],
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
            start_line: number;
            end_line: number;
            new_content: string;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-replace_lines',
                    tool: 'repo_write-replace_lines',
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

            if (typeof input.start_line !== 'number' || input.start_line < 1) {
                return {
                    error: true,
                    message: 'start_line parameter is required and must be a number >= 1',
                    tool: this.name,
                };
            }

            if (typeof input.end_line !== 'number' || input.end_line < 1) {
                return {
                    error: true,
                    message: 'end_line parameter is required and must be a number >= 1',
                    tool: this.name,
                };
            }

            if (input.start_line > input.end_line) {
                return {
                    error: true,
                    message: `start_line (${input.start_line}) must be <= end_line (${input.end_line})`,
                    tool: this.name,
                };
            }

            if (input.new_content === undefined || input.new_content === null) {
                return {
                    error: true,
                    message: 'new_content parameter is required',
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

            // Read file into lines
            const fileContent = await fs.readFile(fullPath, 'utf-8');
            const lines = fileContent.split('\n');

            // Validate line numbers are within file bounds
            if (input.start_line > lines.length) {
                return {
                    error: true,
                    message: `start_line (${input.start_line}) is beyond end of file (file has ${lines.length} lines)`,
                    tool: this.name,
                };
            }

            if (input.end_line > lines.length) {
                return {
                    error: true,
                    message: `end_line (${input.end_line}) is beyond end of file (file has ${lines.length} lines)`,
                    tool: this.name,
                };
            }

            context.logger.info(`Replacing lines ${input.start_line}-${input.end_line} in file: ${input.path}`);

            // Extract old content for reference (convert 1-based to 0-based indexing)
            const startIndex = input.start_line - 1;
            const endIndex = input.end_line; // slice is exclusive at end, so this works out
            const oldLines = lines.slice(startIndex, endIndex);
            const oldContent = oldLines.join('\n');

            // Calculate how many lines are being replaced
            const linesReplaced = input.end_line - input.start_line + 1;

            // Split new content into lines
            const newContentLines = input.new_content.split('\n');

            // Replace the line range with new content
            // Remove old lines and insert new lines at the same position
            lines.splice(startIndex, linesReplaced, ...newContentLines);

            // Write back to file
            const newFileContent = lines.join('\n');
            await fs.writeFile(fullPath, newFileContent, 'utf-8');

            context.logger.info(
                `Lines replaced successfully: ${input.path} (${linesReplaced} lines replaced with ${newContentLines.length} lines)`,
            );

            return {
                success: true,
                path: input.path,
                lines_replaced: linesReplaced,
                old_content: oldContent,
            };
        } catch (error) {
            context.logger.error(`Error in repo_write-replace_lines: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to replace lines: ${(error as Error).message}`,
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
            start_line: number;
            end_line: number;
            new_content: string;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-replace_lines',
                    tool: 'repo_write-replace_lines',
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

            if (typeof input.start_line !== 'number' || input.start_line < 1) {
                return {
                    dry_run: true,
                    error: true,
                    message: 'start_line parameter is required and must be a number >= 1',
                    tool: this.name,
                };
            }

            if (typeof input.end_line !== 'number' || input.end_line < 1) {
                return {
                    dry_run: true,
                    error: true,
                    message: 'end_line parameter is required and must be a number >= 1',
                    tool: this.name,
                };
            }

            if (input.start_line > input.end_line) {
                return {
                    dry_run: true,
                    error: true,
                    message: `start_line (${input.start_line}) must be <= end_line (${input.end_line})`,
                    tool: this.name,
                };
            }

            if (input.new_content === undefined || input.new_content === null) {
                return {
                    dry_run: true,
                    error: true,
                    message: 'new_content parameter is required',
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

            // Read file to validate line numbers (read-only)
            const fileContent = await fs.readFile(fullPath, 'utf-8');
            const lines = fileContent.split('\n');

            // Validate line numbers
            if (input.start_line > lines.length) {
                return {
                    dry_run: true,
                    error: true,
                    message: `start_line (${input.start_line}) is beyond end of file (file has ${lines.length} lines)`,
                    tool: this.name,
                };
            }

            if (input.end_line > lines.length) {
                return {
                    dry_run: true,
                    error: true,
                    message: `end_line (${input.end_line}) is beyond end of file (file has ${lines.length} lines)`,
                    tool: this.name,
                };
            }

            // Extract old content that would be replaced
            const startIndex = input.start_line - 1;
            const endIndex = input.end_line;
            const oldLines = lines.slice(startIndex, endIndex);
            const oldContent = oldLines.join('\n');

            const linesReplaced = input.end_line - input.start_line + 1;

            return {
                dry_run: true,
                message: `Would replace ${linesReplaced} lines (${input.start_line}-${input.end_line}) in ${input.path}`,
                success: true,
                path: input.path,
                lines_replaced: linesReplaced,
                old_content: oldContent,
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
