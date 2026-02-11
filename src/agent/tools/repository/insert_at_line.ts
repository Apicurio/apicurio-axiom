/**
 * InsertAtLineTool - Insert content at a specific line number
 *
 * This tool allows the agent to insert content at a precise line number in a file.
 * Useful for adding methods, imports, or other code at specific locations. Supports
 * automatic indentation matching to blend new content with existing code.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const InsertAtLineTool: Tool = {
    name: 'repository-insert_at_line',
    description:
        'Insert content at a specific line number in a file. Line numbers are 1-based. Optionally matches indentation of surrounding code.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to file',
            },
            line: {
                type: 'number',
                description: 'Line number to insert at (1-based)',
                minimum: 1,
            },
            content: {
                type: 'string',
                description: 'Content to insert',
            },
            indent: {
                type: 'boolean',
                description: 'Match indentation of surrounding code (default: false)',
                default: false,
            },
        },
        required: ['path', 'line', 'content'],
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
            line: number;
            content: string;
            indent?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repository-insert_at_line',
                    tool: 'repository-insert_at_line',
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

            if (typeof input.line !== 'number' || input.line < 1) {
                return {
                    error: true,
                    message: 'line parameter is required and must be a number >= 1',
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

            // Read file into lines
            const fileContent = await fs.readFile(fullPath, 'utf-8');
            const lines = fileContent.split('\n');

            // Validate line number is within bounds
            // Line numbers are 1-based, so valid range is 1 to lines.length + 1
            // (allowing insertion after the last line)
            if (input.line < 1 || input.line > lines.length + 1) {
                return {
                    error: true,
                    message: `Invalid line number: ${input.line}. File has ${lines.length} lines (valid range: 1-${lines.length + 1})`,
                    tool: this.name,
                };
            }

            context.logger.info(`Inserting content at line ${input.line} in file: ${input.path}`);

            // Prepare content to insert
            let contentToInsert = input.content;

            // Apply indentation matching if requested
            if (input.indent === true) {
                // Get the target line (0-based index)
                const targetLineIndex = input.line - 1;

                // Detect indentation from the target line or adjacent line
                let indentation = '';
                if (targetLineIndex < lines.length && lines[targetLineIndex]) {
                    // Use indentation from the line we're inserting before
                    const match = lines[targetLineIndex].match(/^(\s*)/);
                    indentation = match ? match[1] : '';
                } else if (targetLineIndex > 0 && lines[targetLineIndex - 1]) {
                    // If inserting at the end, use indentation from previous line
                    const match = lines[targetLineIndex - 1].match(/^(\s*)/);
                    indentation = match ? match[1] : '';
                }

                // Apply indentation to each line of content
                if (indentation) {
                    const contentLines = contentToInsert.split('\n');
                    contentToInsert = contentLines.map(line => {
                        // Only add indentation to non-empty lines
                        return line.length > 0 ? indentation + line : line;
                    }).join('\n');
                }
            }

            // Split content into lines to count them
            const insertedLines = contentToInsert.split('\n');

            // Insert content at specified line (convert 1-based to 0-based index)
            lines.splice(input.line - 1, 0, ...insertedLines);

            // Write back to file
            const newContent = lines.join('\n');
            await fs.writeFile(fullPath, newContent, 'utf-8');

            context.logger.info(
                `Content inserted successfully at line ${input.line}: ${input.path} (${insertedLines.length} lines inserted)`
            );

            return {
                success: true,
                path: input.path,
                lines_inserted: insertedLines.length,
            };
        } catch (error) {
            context.logger.error(`Error in repository-insert_at_line: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to insert content: ${(error as Error).message}`,
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
            line: number;
            content: string;
            indent?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repository-insert_at_line',
                    tool: 'repository-insert_at_line',
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

            if (typeof input.line !== 'number' || input.line < 1) {
                return {
                    dry_run: true,
                    error: true,
                    message: 'line parameter is required and must be a number >= 1',
                    tool: this.name,
                };
            }

            if (input.content === undefined || input.content === null) {
                return {
                    dry_run: true,
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

            // Read file to validate line number (read-only)
            const fileContent = await fs.readFile(fullPath, 'utf-8');
            const lines = fileContent.split('\n');

            // Validate line number
            if (input.line < 1 || input.line > lines.length + 1) {
                return {
                    dry_run: true,
                    error: true,
                    message: `Invalid line number: ${input.line}. File has ${lines.length} lines (valid range: 1-${lines.length + 1})`,
                    tool: this.name,
                };
            }

            // Count lines that would be inserted
            const insertedLines = input.content.split('\n');

            return {
                dry_run: true,
                message: `Would insert ${insertedLines.length} lines at line ${input.line} in ${input.path}`,
                success: true,
                path: input.path,
                lines_inserted: insertedLines.length,
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
