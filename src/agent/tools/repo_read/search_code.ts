/**
 * SearchCodeTool - Search for patterns in code
 *
 * This tool uses fast-glob for file discovery and native fs operations for searching,
 * providing high-performance pattern matching across the repository. Supports regex patterns,
 * context lines, exclusion filters, and result limiting.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import fg from 'fast-glob';
import type { Tool, ToolContext } from '../../../types/agent.js';

/**
 * Search result for a single match
 */
interface SearchMatch {
    file: string;
    line_number: number;
    content: string;
    context_before?: string[];
    context_after?: string[];
}

/**
 * Search a single file for pattern matches
 *
 * @param filePath Full path to the file
 * @param relativeFilePath Relative path from repository root
 * @param pattern Regex pattern to search for
 * @param caseSensitive Whether search is case-sensitive
 * @param contextLines Number of context lines before/after each match
 * @returns Array of matches in this file
 */
async function searchFile(
    filePath: string,
    relativeFilePath: string,
    pattern: RegExp,
    contextLines: number,
): Promise<SearchMatch[]> {
    const matches: SearchMatch[] = [];

    try {
        // Read file content
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Search each line
        for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
                const match: SearchMatch = {
                    file: relativeFilePath,
                    line_number: i + 1,
                    content: lines[i],
                };

                // Add context lines if requested
                if (contextLines > 0) {
                    // Lines before
                    const beforeStart = Math.max(0, i - contextLines);
                    match.context_before = lines.slice(beforeStart, i);

                    // Lines after
                    const afterEnd = Math.min(lines.length, i + contextLines + 1);
                    match.context_after = lines.slice(i + 1, afterEnd);
                }

                matches.push(match);
            }
        }
    } catch (error) {
        // Skip files that can't be read as UTF-8 (likely binary files)
        // This is expected behavior, not an error
    }

    return matches;
}

export const SearchCodeTool: Tool = {
    name: 'repo_read-search_code',
    description:
        'Search for text patterns in repository files using regex. Supports file filtering, context lines, exclusion patterns, and result limiting. Much faster than grep for large repositories.',
    input_schema: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Text pattern to search for (supports regex)',
            },
            path: {
                type: 'string',
                description: 'Starting directory to search (default: repository root)',
            },
            file_pattern: {
                type: 'string',
                description: 'Glob pattern to limit search to specific files (e.g., "*.ts", "src/**/*.java")',
            },
            case_sensitive: {
                type: 'boolean',
                description: 'If true, search is case-sensitive (default: false)',
            },
            context_lines: {
                type: 'number',
                description: 'Number of lines to show before and after each match (default: 0, max: 10)',
                minimum: 0,
                maximum: 10,
            },
            exclude: {
                type: 'array',
                items: { type: 'string' },
                description: 'Glob patterns to exclude from search',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of results to return (default: 1000)',
                minimum: 1,
            },
        },
        required: ['pattern'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Search results or error
     */
    async execute(
        input: {
            pattern: string;
            path?: string;
            file_pattern?: string;
            case_sensitive?: boolean;
            context_lines?: number;
            exclude?: string[];
            max_results?: number;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_read-search_code',
                    tool: 'repo_read-search_code',
                };
            }

            // Validate input
            if (!input.pattern || typeof input.pattern !== 'string') {
                return {
                    error: true,
                    message: 'pattern parameter is required and must be a string',
                    tool: this.name,
                };
            }

            // Set defaults
            const startPath = input.path || '.';
            const caseSensitive = input.case_sensitive ?? false;
            const contextLines = Math.min(input.context_lines ?? 0, 10);
            const maxResults = input.max_results ?? 1000;

            // Default exclude patterns - common build/dependency directories
            const defaultExcludes = [
                '.git/**',
                'node_modules/**',
                'dist/**',
                'build/**',
                '.next/**',
                'target/**',
                '*.min.js',
                '*.map',
            ];
            const excludePatterns = [...defaultExcludes, ...(input.exclude || [])];

            // Normalize and resolve the starting path
            const normalizedStartPath = path.normalize(startPath);
            const fullStartPath = path.resolve(context.workDir, normalizedStartPath);

            // Security: Ensure the path is within the work directory
            const normalizedWorkDir = path.resolve(context.workDir);
            if (!fullStartPath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: path is outside work directory',
                    tool: this.name,
                };
            }

            // Check if start path exists
            try {
                const stats = await fs.stat(fullStartPath);
                if (!stats.isDirectory()) {
                    return {
                        error: true,
                        message: `Path is not a directory: ${startPath}`,
                        tool: this.name,
                    };
                }
            } catch (_err) {
                return {
                    error: true,
                    message: `Directory not found: ${startPath}`,
                    tool: this.name,
                };
            }

            // Build regex pattern
            let regex: RegExp;
            try {
                const flags = caseSensitive ? '' : 'i';
                regex = new RegExp(input.pattern, flags);
            } catch (error) {
                return {
                    error: true,
                    message: `Invalid regex pattern: ${(error as Error).message}`,
                    tool: this.name,
                };
            }

            // Log the search operation
            const filePatternInfo = input.file_pattern ? ` in files matching "${input.file_pattern}"` : '';
            context.logger.info(`Searching for pattern "${input.pattern}"${filePatternInfo} in ${startPath}...`);

            // Determine glob pattern for file discovery
            const globPattern = input.file_pattern || '**/*';

            // Find all matching files using fast-glob
            let files: string[];
            try {
                files = await fg(globPattern, {
                    cwd: fullStartPath,
                    ignore: excludePatterns,
                    absolute: false,
                    onlyFiles: true,
                    dot: false, // Don't match dotfiles by default
                });
            } catch (error) {
                return {
                    error: true,
                    message: `Invalid file pattern: ${(error as Error).message}`,
                    tool: this.name,
                };
            }

            // Search each file for the pattern
            const allMatches: SearchMatch[] = [];
            let filesSearched = 0;

            for (const file of files) {
                // Convert file path to be relative to repository root
                const relativeFilePath =
                    normalizedStartPath === '.' ? file : path.join(normalizedStartPath, file);
                const fullFilePath = path.join(fullStartPath, file);

                const fileMatches = await searchFile(fullFilePath, relativeFilePath, regex, contextLines);
                allMatches.push(...fileMatches);
                filesSearched++;

                // Stop if we've exceeded max results
                if (allMatches.length >= maxResults) {
                    break;
                }
            }

            // Limit results
            const totalCount = allMatches.length;
            const truncated = totalCount > maxResults;
            const matches = allMatches.slice(0, maxResults);

            context.logger.info(
                `Search completed: found ${totalCount} matches in ${filesSearched} files${truncated ? ` (limited to ${maxResults})` : ''}`,
            );

            return {
                pattern: input.pattern,
                file_pattern: input.file_pattern,
                path: startPath,
                case_sensitive: caseSensitive,
                matches: matches,
                count: totalCount,
                truncated: truncated,
                files_searched: filesSearched,
            };
        } catch (error) {
            context.logger.error(`Error in repo_read-search_code: ${(error as Error).message}`);
            return {
                error: true,
                message: `Search failed: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(
        input: {
            pattern: string;
            path?: string;
            file_pattern?: string;
            case_sensitive?: boolean;
            context_lines?: number;
            exclude?: string[];
            max_results?: number;
        },
        context: ToolContext,
    ): Promise<any> {
        return this.execute(input, context);
    },
};
