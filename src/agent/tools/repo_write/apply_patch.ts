/**
 * ApplyPatchTool - Apply unified diff patches to files
 *
 * This tool allows the agent to apply unified diff format patches to one or more files.
 * Supports dry-run mode to test patches before applying, and reverse mode to unapply patches.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { parsePatch, applyPatch } from 'diff';
import type { Tool, ToolContext } from '../../../types/agent.js';

export const ApplyPatchTool: Tool = {
    name: 'repo_write-apply_patch',
    description:
        'Apply a unified diff patch to one or more files. Supports dry-run mode to test patches and reverse mode to unapply patches.',
    input_schema: {
        type: 'object',
        properties: {
            patch: {
                type: 'string',
                description: 'Unified diff format patch content',
            },
            dry_run: {
                type: 'boolean',
                description: 'Test patch without applying (default: false)',
                default: false,
            },
            reverse: {
                type: 'boolean',
                description: 'Apply patch in reverse (default: false)',
                default: false,
            },
        },
        required: ['patch'],
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
            patch: string;
            dry_run?: boolean;
            reverse?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_write-apply_patch',
                    tool: 'repo_write-apply_patch',
                };
            }

            // Validate input
            if (!input.patch || typeof input.patch !== 'string') {
                return {
                    error: true,
                    message: 'patch parameter is required and must be a string',
                    tool: this.name,
                };
            }

            // Set defaults
            const dryRun = input.dry_run === true;
            const reverse = input.reverse === true;

            context.logger.info(
                `Applying patch (dry_run: ${dryRun}, reverse: ${reverse})`
            );

            // Parse the patch
            const parsedPatches = parsePatch(input.patch);

            if (!parsedPatches || parsedPatches.length === 0) {
                return {
                    error: true,
                    message: 'Invalid patch format: could not parse patch',
                    tool: this.name,
                };
            }

            const filesModified: string[] = [];
            const errors: string[] = [];
            let hunksApplied = 0;
            let hunksFailed = 0;

            // Process each file in the patch
            for (const filePatch of parsedPatches) {
                // Get the target file path (use newFileName for normal patches, oldFileName for reverse)
                let targetFile: string;
                const isFileDeletion = (filePatch.newFileName === '/dev/null' && !reverse) ||
                                     (filePatch.oldFileName === '/dev/null' && reverse);
                const isFileCreation = (filePatch.oldFileName === '/dev/null' && !reverse) ||
                                     (filePatch.newFileName === '/dev/null' && reverse);

                if (reverse) {
                    targetFile = (filePatch.oldFileName || '').replace(/^[ab]\//, '');
                } else {
                    targetFile = (filePatch.newFileName || '').replace(/^[ab]\//, '');
                }

                // Handle /dev/null cases
                if (targetFile === '/dev/null' || targetFile === 'dev/null') {
                    // For deletions/creations, use the other file name
                    if (reverse) {
                        targetFile = (filePatch.newFileName || '').replace(/^[ab]\//, '');
                    } else {
                        targetFile = (filePatch.oldFileName || '').replace(/^[ab]\//, '');
                    }
                }

                if (!targetFile || targetFile === '/dev/null' || targetFile === 'dev/null') {
                    errors.push('Patch contains file without valid name');
                    hunksFailed += filePatch.hunks?.length || 0;
                    continue;
                }

                // Construct full path and validate it's within work directory
                const fullPath = path.resolve(context.workDir, targetFile);
                const normalizedWorkDir = path.resolve(context.workDir);

                if (!fullPath.startsWith(normalizedWorkDir)) {
                    errors.push(`Access denied: ${targetFile} is outside work directory`);
                    hunksFailed += filePatch.hunks?.length || 0;
                    continue;
                }

                try {
                    // Read the current file content
                    const fileExists = await fse.pathExists(fullPath);

                    // Handle file creation
                    if (isFileCreation) {
                        if (fileExists && !reverse) {
                            errors.push(`File already exists: ${targetFile}`);
                            hunksFailed += filePatch.hunks?.length || 0;
                            continue;
                        }

                        if (!fileExists && reverse) {
                            errors.push(`File does not exist for reverse creation: ${targetFile}`);
                            hunksFailed += filePatch.hunks?.length || 0;
                            continue;
                        }

                        if (reverse) {
                            // Reverse creation = deletion
                            if (!dryRun) {
                                await fs.unlink(fullPath);
                            }
                            filesModified.push(targetFile);
                            hunksApplied += filePatch.hunks?.length || 0;
                            context.logger.info(`Deleted file (reverse creation): ${targetFile}`);
                        } else {
                            // Normal file creation
                            const newContent = filePatch.hunks
                                .map(hunk => hunk.lines.filter(l => !l.startsWith('-')).map(l => l.substring(1)).join('\n'))
                                .join('\n');

                            if (!dryRun) {
                                await fse.ensureDir(path.dirname(fullPath));
                                await fs.writeFile(fullPath, newContent, 'utf-8');
                            }

                            filesModified.push(targetFile);
                            hunksApplied += filePatch.hunks?.length || 0;
                            context.logger.info(`Created new file: ${targetFile}`);
                        }
                        continue;
                    }

                    // Handle file deletion
                    if (isFileDeletion) {
                        if (!fileExists) {
                            errors.push(`File does not exist for deletion: ${targetFile}`);
                            hunksFailed += filePatch.hunks?.length || 0;
                            continue;
                        }

                        if (reverse) {
                            // Reverse deletion = creation
                            const newContent = filePatch.hunks
                                .map(hunk => hunk.lines.filter(l => !l.startsWith('+')).map(l => l.substring(1)).join('\n'))
                                .join('\n');

                            if (!dryRun) {
                                await fs.writeFile(fullPath, newContent, 'utf-8');
                            }

                            filesModified.push(targetFile);
                            hunksApplied += filePatch.hunks?.length || 0;
                            context.logger.info(`Created file (reverse deletion): ${targetFile}`);
                        } else {
                            // Normal file deletion
                            if (!dryRun) {
                                await fs.unlink(fullPath);
                            }
                            filesModified.push(targetFile);
                            hunksApplied += filePatch.hunks?.length || 0;
                            context.logger.info(`Deleted file: ${targetFile}`);
                        }
                        continue;
                    }

                    // Handle regular file modification
                    if (!fileExists) {
                        errors.push(`File does not exist: ${targetFile}`);
                        hunksFailed += filePatch.hunks?.length || 0;
                        continue;
                    }

                    // Read existing file
                    const currentContent = await fs.readFile(fullPath, 'utf-8');

                    // For reverse patches, we need to swap the hunks
                    let patchToApply = filePatch;
                    if (reverse) {
                        // Create a reversed version of the patch
                        patchToApply = {
                            ...filePatch,
                            hunks: filePatch.hunks.map(hunk => ({
                                ...hunk,
                                lines: hunk.lines.map(line => {
                                    if (line.startsWith('+')) {
                                        return '-' + line.substring(1);
                                    } else if (line.startsWith('-')) {
                                        return '+' + line.substring(1);
                                    }
                                    return line;
                                })
                            }))
                        };
                    }

                    // Apply the patch
                    const patchOptions = { fuzzFactor: 0 };
                    const result = applyPatch(currentContent, patchToApply, patchOptions);

                    if (result === false) {
                        // Patch failed to apply
                        errors.push(`Failed to apply patch to ${targetFile}: hunks did not match`);
                        hunksFailed += filePatch.hunks?.length || 0;
                        context.logger.warn(`Patch failed for ${targetFile}`);
                    } else {
                        // Patch applied successfully
                        if (!dryRun) {
                            await fs.writeFile(fullPath, result, 'utf-8');
                        }

                        filesModified.push(targetFile);
                        hunksApplied += filePatch.hunks?.length || 0;
                        context.logger.info(`Patched file: ${targetFile}`);
                    }
                } catch (fileError) {
                    errors.push(`Error processing ${targetFile}: ${(fileError as Error).message}`);
                    hunksFailed += filePatch.hunks?.length || 0;
                    context.logger.error(`Error patching ${targetFile}: ${(fileError as Error).message}`);
                }
            }

            const success = hunksFailed === 0 && errors.length === 0;

            context.logger.info(
                `Patch ${dryRun ? 'dry-run' : 'application'} complete: ${filesModified.length} files, ${hunksApplied} hunks applied, ${hunksFailed} failed`
            );

            return {
                success,
                files_modified: filesModified,
                hunks_applied: hunksApplied,
                hunks_failed: hunksFailed,
                errors,
            };
        } catch (error) {
            context.logger.error(`Error in repo_write-apply_patch: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to apply patch: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     */
    async executeMock(
        input: {
            patch: string;
            dry_run?: boolean;
            reverse?: boolean;
        },
        context: ToolContext
    ): Promise<any> {
        // For this tool, we just run execute with dry_run=true
        return this.execute({ ...input, dry_run: true }, context);
    },
};
