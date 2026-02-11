/**
 * ReplaceInFileTool - Search and replace text in a file
 *
 * This tool allows the agent to search for text in a file and replace it with new text.
 * Supports both literal string matching and regex patterns. Can replace all occurrences
 * or just the first one, and optionally preserve case when replacing.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const ReplaceInFileTool: Tool = {
    name: 'repo_write-replace_in_file',
    description:
        'Search for text in a file and replace it with new text. Supports both literal and regex patterns. Can replace all occurrences or just the first match.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to file',
            },
            search: {
                type: 'string',
                description: 'Text or pattern to search for',
            },
            replace: {
                type: 'string',
                description: 'Replacement text',
            },
            regex: {
                type: 'boolean',
                description: 'Treat search as regex pattern (default: false)',
                default: false,
            },
            all_occurrences: {
                type: 'boolean',
                description: 'Replace all occurrences (default: true)',
                default: true,
            },
            preserve_case: {
                type: 'boolean',
                description: 'Preserve case when replacing (default: false)',
                default: false,
            },
        },
        required: ['path', 'search', 'replace'],
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
            search: string;
            replace: string;
            regex?: boolean;
            all_occurrences?: boolean;
            preserve_case?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-replace_in_file',
                    tool: 'repo_write-replace_in_file',
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

            if (input.search === undefined || input.search === null || typeof input.search !== 'string') {
                return {
                    error: true,
                    message: 'search parameter is required and must be a string',
                    tool: this.name,
                };
            }

            if (input.replace === undefined || input.replace === null || typeof input.replace !== 'string') {
                return {
                    error: true,
                    message: 'replace parameter is required and must be a string',
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

            // Set defaults
            const useRegex = input.regex === true;
            const replaceAll = input.all_occurrences !== false; // default true
            const preserveCase = input.preserve_case === true;

            context.logger.info(
                `Replacing in file: ${input.path} (regex: ${useRegex}, all: ${replaceAll}, preserveCase: ${preserveCase})`,
            );

            // Read file contents
            const originalContent = await fs.readFile(fullPath, 'utf-8');
            const originalLines = originalContent.split('\n');

            // Build search pattern
            let searchPattern: RegExp;
            try {
                if (useRegex) {
                    // User provided regex pattern
                    const flags = replaceAll ? 'g' : '';
                    searchPattern = new RegExp(input.search, flags);
                } else {
                    // Literal string search - escape special regex characters
                    const escapedSearch = input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const flags = replaceAll ? 'g' : '';
                    searchPattern = new RegExp(escapedSearch, flags);
                }
            } catch (error) {
                return {
                    error: true,
                    message: `Invalid regex pattern: ${(error as Error).message}`,
                    tool: this.name,
                };
            }

            // Track replacements and affected lines
            let replacementsMade = 0;
            const linesAffected: number[] = [];
            let newContent: string;

            if (preserveCase) {
                // Preserve case replacement - process line by line
                const newLines = originalLines.map((line, index) => {
                    const lineNumber = index + 1;
                    let modifiedLine = line;
                    let lineModified = false;

                    // For preserve case, we need to find matches case-insensitively
                    const caseInsensitivePattern = new RegExp(searchPattern.source, replaceAll ? 'gi' : 'i');

                    // Find and replace matches while preserving case
                    const matches = [...line.matchAll(caseInsensitivePattern)];

                    // Replace in reverse order to maintain correct positions
                    for (let i = matches.length - 1; i >= 0; i--) {
                        const match = matches[i];
                        if (match[0] && match.index !== undefined) {
                            // Preserve the case pattern of the matched text
                            const preservedReplacement = preserveCaseTransform(match[0], input.replace);
                            modifiedLine =
                                modifiedLine.substring(0, match.index) +
                                preservedReplacement +
                                modifiedLine.substring(match.index + match[0].length);
                            replacementsMade++;
                            lineModified = true;
                        }
                        if (!replaceAll) break; // Only first match if not replacing all
                    }

                    if (lineModified) {
                        linesAffected.push(lineNumber);
                    }

                    return modifiedLine;
                });
                newContent = newLines.join('\n');
            } else {
                // Standard replacement
                newContent = originalContent.replace(searchPattern, () => {
                    replacementsMade++;
                    return input.replace;
                });

                // Determine affected lines
                if (replacementsMade > 0) {
                    const newLines = newContent.split('\n');
                    for (let i = 0; i < Math.min(originalLines.length, newLines.length); i++) {
                        if (originalLines[i] !== newLines[i]) {
                            linesAffected.push(i + 1);
                        }
                    }
                    // If lines were added or removed, track that too
                    if (originalLines.length !== newLines.length) {
                        const start = Math.min(originalLines.length, newLines.length);
                        const end = Math.max(originalLines.length, newLines.length);
                        for (let i = start; i < end; i++) {
                            linesAffected.push(i + 1);
                        }
                    }
                }
            }

            // Check if any replacements were made
            if (replacementsMade === 0) {
                context.logger.info(`No matches found for search pattern in ${input.path}`);
                return {
                    success: true,
                    path: input.path,
                    replacements_made: 0,
                    lines_affected: [],
                    preview: '',
                };
            }

            // Write modified content back to file
            await fs.writeFile(fullPath, newContent, 'utf-8');

            // Create preview (first 200 chars of changes)
            const preview = generatePreview(originalContent, newContent, 200);

            context.logger.info(
                `Replacements made: ${replacementsMade} in ${linesAffected.length} lines in ${input.path}`,
            );

            return {
                success: true,
                path: input.path,
                replacements_made: replacementsMade,
                lines_affected: linesAffected,
                preview: preview,
            };
        } catch (error) {
            context.logger.error(`Error in repo_write-replace_in_file: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to replace in file: ${(error as Error).message}`,
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
            search: string;
            replace: string;
            regex?: boolean;
            all_occurrences?: boolean;
            preserve_case?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-replace_in_file',
                    tool: 'repo_write-replace_in_file',
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

            if (input.search === undefined || input.search === null || typeof input.search !== 'string') {
                return {
                    dry_run: true,
                    error: true,
                    message: 'search parameter is required and must be a string',
                    tool: this.name,
                };
            }

            if (input.replace === undefined || input.replace === null || typeof input.replace !== 'string') {
                return {
                    dry_run: true,
                    error: true,
                    message: 'replace parameter is required and must be a string',
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

            // Read file to simulate replacements (read-only)
            const originalContent = await fs.readFile(fullPath, 'utf-8');

            // Set defaults
            const useRegex = input.regex === true;
            const replaceAll = input.all_occurrences !== false;

            // Build search pattern
            let searchPattern: RegExp;
            try {
                if (useRegex) {
                    const flags = replaceAll ? 'g' : '';
                    searchPattern = new RegExp(input.search, flags);
                } else {
                    const escapedSearch = input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const flags = replaceAll ? 'g' : '';
                    searchPattern = new RegExp(escapedSearch, flags);
                }
            } catch (error) {
                return {
                    dry_run: true,
                    error: true,
                    message: `Invalid regex pattern: ${(error as Error).message}`,
                    tool: this.name,
                };
            }

            // Count how many replacements would be made
            const matches = originalContent.match(searchPattern);
            const replacementsMade = matches ? matches.length : 0;

            // Simulate the replacement to find affected lines
            const linesAffected: number[] = [];
            if (replacementsMade > 0) {
                const newContent = originalContent.replace(searchPattern, input.replace);
                const originalLines = originalContent.split('\n');
                const newLines = newContent.split('\n');

                for (let i = 0; i < Math.min(originalLines.length, newLines.length); i++) {
                    if (originalLines[i] !== newLines[i]) {
                        linesAffected.push(i + 1);
                    }
                }
            }

            const preview = replacementsMade > 0 ? `Would replace ${replacementsMade} occurrence(s)` : '';

            return {
                dry_run: true,
                message: `Would make ${replacementsMade} replacements in ${input.path}`,
                success: true,
                path: input.path,
                replacements_made: replacementsMade,
                lines_affected: linesAffected,
                preview: preview,
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
 * Preserve the case pattern of the original text when replacing
 *
 * @param original Original matched text
 * @param replacement Replacement text
 * @returns Replacement with preserved case pattern
 */
function preserveCaseTransform(original: string, replacement: string): string {
    // If original is all uppercase, make replacement uppercase
    if (original === original.toUpperCase() && original !== original.toLowerCase()) {
        return replacement.toUpperCase();
    }

    // If original is all lowercase, make replacement lowercase
    if (original === original.toLowerCase() && original !== original.toUpperCase()) {
        return replacement.toLowerCase();
    }

    // If original is title case (first char upper, rest lower)
    if (
        original.length > 0 &&
        original[0] === original[0].toUpperCase() &&
        original.slice(1) === original.slice(1).toLowerCase()
    ) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
    }

    // Otherwise, return replacement as-is
    return replacement;
}

/**
 * Generate a preview of changes showing differences
 *
 * @param original Original content
 * @param modified Modified content
 * @param maxLength Maximum length of preview
 * @returns Preview string
 */
function generatePreview(original: string, modified: string, maxLength: number): string {
    // Find the first difference
    let firstDiffIndex = 0;
    for (let i = 0; i < Math.min(original.length, modified.length); i++) {
        if (original[i] !== modified[i]) {
            firstDiffIndex = i;
            break;
        }
    }

    // Extract context around the first change
    const start = Math.max(0, firstDiffIndex - 50);
    const end = Math.min(modified.length, firstDiffIndex + maxLength);

    let preview = modified.substring(start, end);
    if (start > 0) preview = `...${preview}`;
    if (end < modified.length) preview = `${preview}...`;

    return preview;
}
