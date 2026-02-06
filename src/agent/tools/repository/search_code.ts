/**
 * SearchCodeTool - Search for patterns in code
 *
 * This tool uses grep to search for patterns in repository files.
 * Useful for finding specific functions, classes, or code patterns.
 */

import type { Tool } from '../../../types/agent.js';
import { execAsync } from '../utils.js';

export class SearchCodeTool implements Tool {
    name = 'repository-search_code';
    description =
        'Search for a text pattern in repository files using grep. Returns matching lines with file paths and line numbers.';
    input_schema = {
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
    };

    constructor(private workDir: string) {}

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @returns Search results or error
     */
    async execute(input: { pattern: string; file_pattern?: string; case_sensitive?: boolean }): Promise<any> {
        try {
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
            const { stdout } = await execAsync(grepCmd, {
                cwd: this.workDir,
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

            return {
                pattern: input.pattern,
                file_pattern: input.file_pattern,
                matches: matches,
                count: matches.length,
            };
        } catch (error) {
            // grep exits with code 1 if no matches found
            if ((error as any).code === 1) {
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
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { pattern: string; file_pattern?: string }): Promise<any> {
        return this.execute(input);
    }
}
