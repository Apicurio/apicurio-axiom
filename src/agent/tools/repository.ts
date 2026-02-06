/**
 * Repository Tools
 *
 * Read-only tools for exploring repository files and code.
 * These tools allow the agent to read files, list directories, and search code.
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as fse from 'fs-extra';
import type { Tool } from '../../types/agent.js';

const execAsync = promisify(exec);

/**
 * ReadFileTool - Read contents of a file from the repository
 *
 * This tool allows the agent to read the contents of any file in the work directory.
 * It's useful for understanding code structure, reading documentation, or examining
 * configuration files.
 */
export class ReadFileTool implements Tool {
    name = 'repository-read_file';
    description = 'Read the contents of a file from the repository';
    input_schema = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to the file from the repository root',
            },
        },
        required: ['path'],
    };

    constructor(private workDir: string) {}

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @returns File contents or error
     */
    async execute(input: { path: string }): Promise<any> {
        try {
            // Validate input
            if (!input.path) {
                return {
                    error: true,
                    message: 'path parameter is required',
                };
            }

            // Construct full path and validate it's within work directory
            const fullPath = path.resolve(this.workDir, input.path);
            const normalizedWorkDir = path.resolve(this.workDir);

            if (!fullPath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: path is outside work directory',
                };
            }

            // Check if file exists
            try {
                const stats = await fs.stat(fullPath);
                if (!stats.isFile()) {
                    return {
                        error: true,
                        message: `Path is not a file: ${input.path}`,
                    };
                }
            } catch (_err) {
                return {
                    error: true,
                    message: `File not found: ${input.path}`,
                };
            }

            // Read file contents
            const contents = await fs.readFile(fullPath, 'utf-8');

            return {
                path: input.path,
                contents: contents,
                size: contents.length,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to read file: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { path: string }): Promise<any> {
        return this.execute(input);
    }
}

/**
 * ListFilesTool - List files in a directory
 *
 * This tool allows the agent to explore the repository structure by listing
 * files and directories. Useful for understanding project organization.
 */
export class ListFilesTool implements Tool {
    name = 'repository-list_files';
    description = 'List files and directories in a path. Returns file names, types (file/directory), and sizes.';
    input_schema = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to the directory from the repository root (use "." for root)',
            },
            recursive: {
                type: 'boolean',
                description: 'If true, list files recursively (default: false)',
            },
        },
        required: ['path'],
    };

    constructor(private workDir: string) {}

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @returns List of files or error
     */
    async execute(input: { path: string; recursive?: boolean }): Promise<any> {
        try {
            // Validate input
            if (!input.path) {
                return {
                    error: true,
                    message: 'path parameter is required',
                };
            }

            // Construct full path and validate it's within work directory
            const fullPath = path.resolve(this.workDir, input.path);
            const normalizedWorkDir = path.resolve(this.workDir);

            if (!fullPath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: path is outside work directory',
                };
            }

            // Check if directory exists
            try {
                const stats = await fs.stat(fullPath);
                if (!stats.isDirectory()) {
                    return {
                        error: true,
                        message: `Path is not a directory: ${input.path}`,
                    };
                }
            } catch (_err) {
                return {
                    error: true,
                    message: `Directory not found: ${input.path}`,
                };
            }

            // List files
            const files: Array<{ name: string; type: string; size?: number; path: string }> = [];

            if (input.recursive) {
                // Recursive listing
                await this.listRecursive(fullPath, input.path, files);
            } else {
                // Non-recursive listing
                const entries = await fs.readdir(fullPath, { withFileTypes: true });
                for (const entry of entries) {
                    const entryPath = path.join(input.path, entry.name);
                    const fullEntryPath = path.join(fullPath, entry.name);
                    const stats = await fs.stat(fullEntryPath);

                    files.push({
                        name: entry.name,
                        type: entry.isDirectory() ? 'directory' : 'file',
                        size: entry.isFile() ? stats.size : undefined,
                        path: entryPath,
                    });
                }
            }

            return {
                path: input.path,
                files: files,
                count: files.length,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to list files: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { path: string; recursive?: boolean }): Promise<any> {
        return this.execute(input);
    }

    /**
     * Recursively list files in a directory
     *
     * @param fullPath Absolute path to directory
     * @param relativePath Relative path from work directory
     * @param files Array to accumulate results
     */
    private async listRecursive(
        fullPath: string,
        relativePath: string,
        files: Array<{ name: string; type: string; size?: number; path: string }>,
    ): Promise<void> {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });

        for (const entry of entries) {
            // Skip .git directory
            if (entry.name === '.git') {
                continue;
            }

            const entryPath = path.join(relativePath, entry.name);
            const fullEntryPath = path.join(fullPath, entry.name);
            const stats = await fs.stat(fullEntryPath);

            files.push({
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                size: entry.isFile() ? stats.size : undefined,
                path: entryPath,
            });

            if (entry.isDirectory()) {
                await this.listRecursive(fullEntryPath, entryPath, files);
            }
        }
    }
}

/**
 * SearchCodeTool - Search for patterns in code
 *
 * This tool uses grep to search for patterns in repository files.
 * Useful for finding specific functions, classes, or code patterns.
 */
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

/**
 * GitStatusTool - Get git repository status
 *
 * This tool runs git status and returns information about the current branch,
 * staged changes, unstaged changes, and untracked files.
 */
export class GitStatusTool implements Tool {
    name = 'git-status';
    description = 'Get git repository status including current branch, staged/unstaged changes, and untracked files';
    input_schema = {
        type: 'object',
        properties: {},
        required: [],
    };

    constructor(private workDir: string) {}

    /**
     * Execute the tool
     *
     * @param _input Tool parameters (none required)
     * @returns Git status information or error
     */
    async execute(_input: any): Promise<any> {
        try {
            // Get current branch
            const { stdout: branchOutput } = await execAsync('git branch --show-current', {
                cwd: this.workDir,
            });
            const currentBranch = branchOutput.trim();

            // Get status in porcelain format for easier parsing
            const { stdout: statusOutput } = await execAsync('git status --porcelain', {
                cwd: this.workDir,
            });

            // Parse status output
            const lines = statusOutput
                .trim()
                .split('\n')
                .filter((line) => line.length > 0);
            const stagedFiles: string[] = [];
            const modifiedFiles: string[] = [];
            const untrackedFiles: string[] = [];

            for (const line of lines) {
                const status = line.substring(0, 2);
                const file = line.substring(3);

                // First character is staged status, second is working tree status
                const stagedStatus = status[0];
                const workingStatus = status[1];

                if (stagedStatus !== ' ' && stagedStatus !== '?') {
                    stagedFiles.push(file);
                }

                if (workingStatus === 'M' || workingStatus === 'D') {
                    modifiedFiles.push(file);
                }

                if (status === '??') {
                    untrackedFiles.push(file);
                }
            }

            // Check if working tree is clean
            const isClean = lines.length === 0;

            return {
                current_branch: currentBranch,
                is_clean: isClean,
                staged_files: stagedFiles,
                modified_files: modifiedFiles,
                untracked_files: untrackedFiles,
                total_changes: lines.length,
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to get git status: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: any): Promise<any> {
        return this.execute(input);
    }
}

/**
 * GitDiffTool - Get git diff output
 *
 * This tool runs git diff and returns the differences between versions.
 * Supports viewing staged changes, unstaged changes, or differences between branches.
 */
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

/**
 * GitCreateBranchTool - Create a new git branch
 *
 * This tool creates a new branch from the current branch or a specified reference.
 * Useful for automated feature branch creation workflows.
 */
export class GitCreateBranchTool implements Tool {
    name = 'git-create_branch';
    description = 'Create a new git branch from current branch or specified ref (tag, commit, branch)';
    input_schema = {
        type: 'object',
        properties: {
            branch_name: {
                type: 'string',
                description: 'Name of the new branch to create',
            },
            from_ref: {
                type: 'string',
                description: 'Optional: reference to create branch from (default: current branch)',
            },
            checkout: {
                type: 'boolean',
                description: 'If true, checkout the new branch after creating it (default: true)',
            },
        },
        required: ['branch_name'],
    };

    constructor(private workDir: string) {}

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @returns Branch creation result or error
     */
    async execute(input: { branch_name: string; from_ref?: string; checkout?: boolean }): Promise<any> {
        try {
            // Validate input
            if (!input.branch_name || typeof input.branch_name !== 'string') {
                return {
                    error: true,
                    message: 'branch_name parameter is required and must be a string',
                };
            }

            // Sanitize branch name (no spaces, special chars)
            const sanitizedName = input.branch_name.trim();
            if (!/^[a-zA-Z0-9/_-]+$/.test(sanitizedName)) {
                return {
                    error: true,
                    message:
                        'Branch name contains invalid characters. Use only letters, numbers, hyphens, underscores, and slashes.',
                };
            }

            // Check if branch already exists
            try {
                await execAsync(`git rev-parse --verify ${sanitizedName}`, {
                    cwd: this.workDir,
                });
                return {
                    error: true,
                    message: `Branch "${sanitizedName}" already exists`,
                };
            } catch {
                // Branch doesn't exist, good to proceed
            }

            // Build create command
            const checkout = input.checkout !== false; // Default to true
            let createCmd = checkout ? 'git checkout -b' : 'git branch';
            createCmd += ` ${sanitizedName}`;

            if (input.from_ref) {
                createCmd += ` ${input.from_ref}`;
            }

            // Create branch
            await execAsync(createCmd, {
                cwd: this.workDir,
            });

            // Get current branch to confirm
            const { stdout: currentBranch } = await execAsync('git branch --show-current', {
                cwd: this.workDir,
            });

            return {
                success: true,
                branch_name: sanitizedName,
                from_ref: input.from_ref || 'current branch',
                checked_out: checkout,
                current_branch: currentBranch.trim(),
            };
        } catch (error) {
            return {
                error: true,
                message: `Failed to create branch: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Write tool - returns simulated result
     */
    async executeMock(input: { branch_name: string; from_ref?: string; checkout?: boolean }): Promise<any> {
        return {
            dry_run: true,
            message: 'Would create branch',
            branch_name: input.branch_name,
            from_ref: input.from_ref || 'HEAD',
            checked_out: input.checkout !== false,
            current_branch: input.checkout !== false ? input.branch_name : 'current-branch',
            success: true,
        };
    }
}

/**
 * GitLogTool - Get git commit history
 *
 * This tool retrieves commit history with various filtering options.
 * Useful for understanding project history, generating changelogs, and finding related changes.
 */
export class GitLogTool implements Tool {
    name = 'git-log';
    description = 'Get git commit history with optional filtering by count, date range, author, or file path';
    input_schema = {
        type: 'object',
        properties: {
            max_count: {
                type: 'number',
                description: 'Maximum number of commits to return (default: 10)',
            },
            since: {
                type: 'string',
                description: 'Show commits more recent than this date (e.g., "2 weeks ago", "2024-01-01")',
            },
            until: {
                type: 'string',
                description: 'Show commits older than this date',
            },
            author: {
                type: 'string',
                description: 'Filter commits by author name or email',
            },
            ref: {
                type: 'string',
                description: 'Git reference (branch, tag, commit) to show history for (default: current branch)',
            },
            file_path: {
                type: 'string',
                description: 'Show only commits that affected this file or directory',
            },
            grep: {
                type: 'string',
                description: 'Filter commits by commit message content',
            },
        },
        required: [],
    };

    constructor(private workDir: string) {}

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @returns Commit history or error
     */
    async execute(input: {
        max_count?: number;
        since?: string;
        until?: string;
        author?: string;
        ref?: string;
        file_path?: string;
        grep?: string;
    }): Promise<any> {
        try {
            // Build git log command
            const maxCount = input.max_count || 10;
            let logCmd = `git log -n ${maxCount}`;

            // Add format for structured output
            logCmd += ' --pretty=format:"%H|||%an|||%ae|||%aI|||%s|||%b"';

            // Add filters
            if (input.since) {
                logCmd += ` --since="${input.since}"`;
            }

            if (input.until) {
                logCmd += ` --until="${input.until}"`;
            }

            if (input.author) {
                logCmd += ` --author="${input.author}"`;
            }

            if (input.grep) {
                logCmd += ` --grep="${input.grep}"`;
            }

            // Add ref if specified
            if (input.ref) {
                logCmd += ` ${input.ref}`;
            }

            // Add file path if specified
            if (input.file_path) {
                logCmd += ` -- ${input.file_path}`;
            }

            // Execute command
            const { stdout } = await execAsync(logCmd, {
                cwd: this.workDir,
            });

            // Parse output
            const commits = [];
            const lines = stdout
                .trim()
                .split('\n')
                .filter((line) => line.length > 0);

            for (const line of lines) {
                const parts = line.split('|||');
                if (parts.length >= 5) {
                    commits.push({
                        sha: parts[0],
                        author_name: parts[1],
                        author_email: parts[2],
                        date: parts[3],
                        subject: parts[4],
                        body: parts[5] || '',
                    });
                }
            }

            return {
                commits: commits,
                count: commits.length,
                filters: {
                    max_count: maxCount,
                    since: input.since || null,
                    until: input.until || null,
                    author: input.author || null,
                    ref: input.ref || 'current branch',
                    file_path: input.file_path || null,
                    grep: input.grep || null,
                },
            };
        } catch (error) {
            // git log might exit with error if no commits match
            if ((error as Error).message.includes('does not have any commits yet')) {
                return {
                    commits: [],
                    count: 0,
                    message: 'Repository has no commits yet',
                };
            }

            return {
                error: true,
                message: `Failed to get git log: ${(error as Error).message}`,
            };
        }
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: {
        max_count?: number;
        since?: string;
        until?: string;
        author?: string;
        ref?: string;
        file_path?: string;
        grep?: string;
    }): Promise<any> {
        return this.execute(input);
    }
}

/**
 * GetFileMetadataTool - Get detailed metadata about a file or directory
 *
 * This tool provides comprehensive metadata about a file or directory including
 * size, timestamps, permissions, and file characteristics. For text files, it also
 * includes line count and encoding information.
 */
export class GetFileMetadataTool implements Tool {
    name = 'repository-get_file_metadata';
    description = 'Get detailed metadata about a file or directory including size, timestamps, permissions, and file characteristics';
    input_schema = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path from repository root to the file or directory',
            },
        },
        required: ['path'],
    };

    constructor(private workDir: string) {}

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @returns File metadata or error
     */
    async execute(input: { path: string }): Promise<any> {
        try {
            // Validate input
            if (!input.path) {
                return {
                    error: true,
                    message: 'path parameter is required',
                    tool: this.name,
                };
            }

            // Construct full path and validate it's within work directory
            const fullPath = path.resolve(this.workDir, input.path);
            const normalizedWorkDir = path.resolve(this.workDir);

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
                    } catch (err) {
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
    }

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { path: string }): Promise<any> {
        return this.execute(input);
    }
}
