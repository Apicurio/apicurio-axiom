/**
 * GetDirectoryTreeTool - Generate hierarchical tree structure of a directory
 *
 * Generates a hierarchical tree structure of a directory, useful for visualization
 * and understanding project layout. Supports depth limiting, hidden file filtering,
 * and optional glob pattern matching.
 */

import * as path from 'node:path';
import fs from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

/**
 * Tree node representing a file or directory
 */
interface TreeNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    size?: number;
    children?: TreeNode[];
}

/**
 * Output structure for directory tree
 */
interface DirectoryTreeOutput {
    tree: TreeNode[];
    total_files: number;
    total_directories: number;
}

export const GetDirectoryTreeTool: Tool = {
    name: 'repo_read-get_directory_tree',
    description:
        'Generate a hierarchical tree structure of a directory. Supports depth limiting, hidden file filtering, and pattern matching. Limited to 300 items by default to prevent excessive output.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to directory (default: repository root)',
            },
            max_depth: {
                type: 'number',
                description: 'Maximum depth to traverse (default: unlimited)',
                minimum: 1,
            },
            include_hidden: {
                type: 'boolean',
                description: 'Include hidden files/directories (default: false)',
            },
            pattern: {
                type: 'string',
                description: 'Optional glob pattern to filter results (simple wildcards supported)',
            },
            max_items: {
                type: 'number',
                description: 'Maximum total items (files + directories) to return (default: 300, max: 1000)',
                minimum: 1,
            },
        },
        required: [],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Directory tree structure or error
     */
    async execute(
        input: {
            path?: string;
            max_depth?: number;
            include_hidden?: boolean;
            pattern?: string;
            max_items?: number;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate required context properties
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_read-get_directory_tree',
                    tool: 'repo_read-get_directory_tree',
                };
            }

            // Use repository root if no path specified
            const targetPath = input.path || '.';

            // Normalize and resolve the path
            const normalizedPath = path.normalize(targetPath);
            const fullPath = path.resolve(context.workDir, normalizedPath);

            // Security: Ensure the path is within the work directory
            if (!fullPath.startsWith(context.workDir)) {
                return {
                    error: true,
                    message: 'Path is outside the repository directory',
                };
            }

            // Check if path exists and is a directory
            const exists = await fs.pathExists(fullPath);
            if (!exists) {
                return {
                    error: true,
                    message: `Directory does not exist: ${targetPath}`,
                };
            }

            const stats = await fs.stat(fullPath);
            if (!stats.isDirectory()) {
                return {
                    error: true,
                    message: `Path is not a directory: ${targetPath}`,
                };
            }

            // Set defaults and limits
            const DEFAULT_MAX_ITEMS = 300;
            const ABSOLUTE_MAX_ITEMS = 1000;
            const maxDepth = input.max_depth || Number.MAX_SAFE_INTEGER;
            const includeHidden = input.include_hidden ?? false;
            const pattern = input.pattern;
            const maxItems = input.max_items ? Math.min(input.max_items, ABSOLUTE_MAX_ITEMS) : DEFAULT_MAX_ITEMS;

            // Initialize counters
            let totalFiles = 0;
            let totalDirectories = 0;
            let truncated = false;

            context.logger.info(`Building directory tree for: ${targetPath}`);

            /**
             * Recursively build the directory tree
             */
            const buildTree = async (
                dirPath: string,
                currentDepth: number,
                relativePath: string,
            ): Promise<TreeNode[]> => {
                // Check depth limit
                if (currentDepth > maxDepth) {
                    return [];
                }

                // Check if we've hit the item limit
                if (totalFiles + totalDirectories >= maxItems) {
                    truncated = true;
                    return [];
                }

                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                const nodes: TreeNode[] = [];

                for (const entry of entries) {
                    // Check item limit before processing each entry
                    if (totalFiles + totalDirectories >= maxItems) {
                        truncated = true;
                        break;
                    }

                    // Filter hidden files if requested
                    if (!includeHidden && entry.name.startsWith('.')) {
                        continue;
                    }

                    const entryPath = path.join(dirPath, entry.name);
                    const entryRelativePath = path.join(relativePath, entry.name);

                    // Apply pattern filter if specified
                    if (pattern && !matchesPattern(entry.name, pattern)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        totalDirectories++;

                        const children = await buildTree(entryPath, currentDepth + 1, entryRelativePath);

                        nodes.push({
                            name: entry.name,
                            type: 'directory',
                            path: entryRelativePath,
                            children: children,
                        });
                    } else if (entry.isFile()) {
                        totalFiles++;

                        const fileStats = await fs.stat(entryPath);
                        nodes.push({
                            name: entry.name,
                            type: 'file',
                            path: entryRelativePath,
                            size: fileStats.size,
                        });
                    }
                    // Ignore symlinks and other special files
                }

                // Sort: directories first, then files, both alphabetically
                nodes.sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                });

                return nodes;
            };

            // Build the tree starting from the target directory
            const tree = await buildTree(fullPath, 1, targetPath === '.' ? '' : targetPath);

            context.logger.info(
                `Directory tree built: ${totalDirectories} directories, ${totalFiles} files${truncated ? ' (truncated)' : ''}`,
            );

            const result: DirectoryTreeOutput & { truncated?: boolean; message?: string } = {
                tree: tree,
                total_files: totalFiles,
                total_directories: totalDirectories,
                truncated: truncated,
                ...(truncated && {
                    message: `Tree truncated at ${maxItems} items. Use max_items parameter to adjust (max: ${ABSOLUTE_MAX_ITEMS})`,
                }),
            };

            return result;
        } catch (error) {
            context.logger.error(`Error in repo_read-get_directory_tree: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to build directory tree: ${(error as Error).message}`,
                tool: 'repo_read-get_directory_tree',
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(
        input: {
            path?: string;
            max_depth?: number;
            include_hidden?: boolean;
            pattern?: string;
            max_items?: number;
        },
        context: ToolContext,
    ): Promise<any> {
        return this.execute(input, context);
    },
};

/**
 * Simple glob pattern matching
 * Supports basic wildcards: * (any characters) and ? (single character)
 *
 * @param name File/directory name to test
 * @param pattern Glob pattern
 * @returns True if name matches pattern
 */
function matchesPattern(name: string, pattern: string): boolean {
    // Convert glob pattern to regex
    // Escape special regex characters except * and ?
    const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(name);
}
