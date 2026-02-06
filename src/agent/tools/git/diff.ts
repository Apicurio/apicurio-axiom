/**
 * GitDiffTool - Get git diff output
 *
 * This tool runs git diff and returns the differences between versions.
 * Supports viewing staged changes, unstaged changes, or differences between branches.
 */

import type { Tool } from '../../../types/agent.js';
import { execAsync } from '../utils.js';

export class GitDiffTool implements Tool {
    name = 'git-diff';
    description =
        'Get git diff output. Shows differences in the working directory, staged changes, or between branches.';
    input_schema = {
        type: 'object',
        properties: {
            staged: {
                type: 'boolean',
                description:
                    'If true, show staged changes (--cached). If false, show unstaged changes (default: false)',
            },
            file_path: {
                type: 'string',
                description: 'Optional: specific file path to diff (relative to repository root)',
            },
            ref: {
                type: 'string',
                description: 'Optional: git reference to compare against (e.g., "main", "HEAD~1")',
            },
        },
        required: [],
    };

    constructor(private workDir: string) {}

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @returns Git diff output or error
     */
    async execute(input: { staged?: boolean; file_path?: string; ref?: string }): Promise<any> {
        try {
            // Build git diff command
            let diffCmd = 'git diff';

            // Add flags
            if (input.staged) {
                diffCmd += ' --cached';
            }

            // Add ref if specified
            if (input.ref) {
                diffCmd += ` ${input.ref}`;
            }

            // Add file path if specified
            if (input.file_path) {
                diffCmd += ` -- ${input.file_path}`;
            }

            // Execute diff
            const { stdout } = await execAsync(diffCmd, {
                cwd: this.workDir,
                maxBuffer: 10 * 1024 * 1024, // 10MB max output
            });

            const diff = stdout.trim();

            // Parse diff statistics
            let filesChanged = 0;
            let insertions = 0;
            let deletions = 0;

            const diffLines = diff.split('\n');
            for (const line of diffLines) {
                if (line.startsWith('diff --git')) {
                    filesChanged++;
                } else if (line.startsWith('+') && !line.startsWith('+++')) {
                    insertions++;
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    deletions++;
                }
            }

            return {
                diff: diff,
                has_changes: diff.length > 0,
                files_changed: filesChanged,
                insertions: insertions,
                deletions: deletions,
                staged: input.staged || false,
                file_path: input.file_path || null,
                ref: input.ref || null,
            };
        } catch (error) {
            // git diff exits with code 1 if there are no differences
            if ((error as any).code === 1 && (error as any).stdout) {
                return {
                    diff: '',
                    has_changes: false,
                    files_changed: 0,
                    insertions: 0,
                    deletions: 0,
                    staged: input.staged || false,
                    file_path: input.file_path || null,
                    ref: input.ref || null,
                };
            }

            return {
                error: true,
                message: `Failed to get git diff: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { staged?: boolean; file_path?: string; ref?: string }): Promise<any> {
        return this.execute(input);
    }
}
