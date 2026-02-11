/**
 * SearchCodeTool - Search for patterns in code
 *
 * This tool uses grep to search for patterns in repository files.
 * Useful for finding specific functions, classes, or code patterns.
 */

import type { Tool, ToolContext } from '../../../types/agent.js';
import { execAsync } from '../utils.js';

export const SearchCodeTool: Tool = {
    name: 'repo_read-search_code',
    description:
        'Search for a text pattern in repository files using grep. Returns matching lines with file paths and line numbers.',
    input_schema: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Text pattern to search for (supports regex)',
            },
            file_pattern: {
                type: 'string',
                description: 'Optional glob pattern to limit search to specific files (e.g., "*.ts", "src/**/*.js")',
            },
            case_sensitive: {
                type: 'boolean',
                description: 'If true, search is case-sensitive (default: false)',
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
        input: { pattern: string; file_pattern?: string; case_sensitive?: boolean },
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
            if (!input.pattern) {
                return {
                    error: true,
                    message: 'pattern parameter is required',
                };
            }

            // Build grep command
            let grepCmd = 'grep -r -n';

            // Case sensitivity
            if (!input.case_sensitive) {
                grepCmd += ' -i';
            }

            // Add pattern (escape for shell)
            const escapedPattern = input.pattern.replace(/'/g, "'\\''");
            grepCmd += ` '${escapedPattern}'`;

            // File pattern (use find if specified)
            if (input.file_pattern) {
                const escapedFilePattern = input.file_pattern.replace(/'/g, "'\\''");
                grepCmd = `find . -type f -name '${escapedFilePattern}' -exec grep -n${!input.case_sensitive ? 'i' : ''} '${escapedPattern}' {} +`;
            }

            // Exclude .git directory
            grepCmd += ' --exclude-dir=.git';

            // Execute grep
            const filePatternInfo = input.file_pattern ? ` in files matching "${input.file_pattern}"` : '';
            context.logger.info(`Searching for pattern "${input.pattern}"${filePatternInfo}...`);
            const { stdout } = await execAsync(grepCmd, {
                cwd: context.workDir,
                maxBuffer: 10 * 1024 * 1024, // 10MB max output
            });

            // Parse results
            const lines = stdout
                .trim()
                .split('\n')
                .filter((line) => line.length > 0);
            const matches: Array<{ file: string; line_number: number; content: string }> = [];

            for (const line of lines) {
                // Parse grep output format: file:line_number:content
                const match = line.match(/^([^:]+):(\d+):(.*)$/);
                if (match) {
                    matches.push({
                        file: match[1],
                        line_number: parseInt(match[2], 10),
                        content: match[3],
                    });
                }
            }

            context.logger.info(`Search completed: found ${matches.length} matches`);

            return {
                pattern: input.pattern,
                file_pattern: input.file_pattern,
                matches: matches,
                count: matches.length,
            };
        } catch (error) {
            // grep exits with code 1 if no matches found
            if ((error as any).code === 1) {
                context.logger.info(`Search completed: no matches found`);
                return {
                    pattern: input.pattern,
                    file_pattern: input.file_pattern,
                    matches: [],
                    count: 0,
                };
            }

            return {
                error: true,
                message: `Search failed: ${(error as Error).message}`,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { pattern: string; file_pattern?: string }, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
