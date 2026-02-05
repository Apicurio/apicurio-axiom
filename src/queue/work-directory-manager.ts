/**
 * Work Directory Manager
 *
 * Manages work directories for action execution, including:
 * - Creating work directories per issue/event
 * - Locking work directories during execution
 * - Monitoring total disk usage
 * - Cleaning up old directories
 */

import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { getLogger, type Logger } from '../logging/logger.js';
import type { Event } from '../types/events.js';
import type { DirectoryInfo, LockInfo, WorkDirectoryConfig } from '../types/work-directory.js';

const execAsync = promisify(exec);

export class WorkDirectoryManager {
    private logger: Logger;
    private basePath: string;
    private maxSizeGB: number;
    private cleanupThresholdPercent: number;
    private monitorInterval: number;
    private intervalId: NodeJS.Timeout | null;
    private lockedDirs: Map<string, LockInfo>;

    /**
     * Creates a new WorkDirectoryManager instance
     *
     * @param config Work directory configuration
     */
    constructor(config: WorkDirectoryConfig) {
        this.basePath = resolve(process.cwd(), config.basePath || './data/work');
        this.maxSizeGB = config.maxSizeGB || 100;
        this.cleanupThresholdPercent = config.cleanupThresholdPercent || 90;
        this.monitorInterval = (config.monitorInterval || 3600) * 1000; // Convert to ms
        this.intervalId = null;

        // Work directory locking mechanism
        this.lockedDirs = new Map<string, LockInfo>();

        this.logger = getLogger();
    }

    /**
     * Initializes the work directory manager
     */
    async initialize(): Promise<void> {
        // Create base work directory if it doesn't exist
        if (!existsSync(this.basePath)) {
            await mkdir(this.basePath, { recursive: true });
        }

        getLogger().debug('Work directory manager initialized', {
            basePath: this.basePath,
            maxSizeGB: this.maxSizeGB,
        });
    }

    /**
     * Gets the work directory path for an event
     *
     * Uses issue number if available, otherwise event ID
     *
     * @param event Event object
     * @returns Work directory path
     */
    getWorkDirForEvent(event: Event): string {
        let dirName: string;

        if (event.issue?.number) {
            dirName = `issue-${event.issue.number}`;
        } else if (event.pullRequest?.number) {
            dirName = `pr-${event.pullRequest.number}`;
        } else {
            dirName = `event-${event.id}`;
        }

        return resolve(this.basePath, dirName);
    }

    /**
     * Checks if a work directory is currently locked
     *
     * @param workDir Work directory path
     * @returns True if locked, false otherwise
     */
    isLocked(workDir: string): boolean {
        return this.lockedDirs.has(workDir);
    }

    /**
     * Acquires a lock on a work directory
     *
     * @param workDir Work directory path
     * @param jobId Job ID acquiring the lock
     * @throws Error if work directory is already locked
     */
    acquireLock(workDir: string, jobId: number): void {
        if (this.isLocked(workDir)) {
            const lockInfo = this.lockedDirs.get(workDir);
            throw new Error(`Work directory ${workDir} is already locked by job ${lockInfo?.jobId}`);
        }

        this.lockedDirs.set(workDir, {
            jobId,
            timestamp: Date.now(),
        });

        getLogger().debug('Acquired lock on work directory', {
            workDir,
            jobId,
        });
    }

    /**
     * Releases a lock on a work directory
     *
     * @param workDir Work directory path
     * @param jobId Job ID releasing the lock (for verification)
     */
    releaseLock(workDir: string, jobId: number): void {
        if (!this.isLocked(workDir)) {
            getLogger().warn('Attempted to release unlocked work directory', {
                workDir,
            });
            return;
        }

        const lockInfo = this.lockedDirs.get(workDir);

        // Verify that the job releasing the lock is the one that acquired it
        if (lockInfo?.jobId !== jobId) {
            this.logger.warn(`Job ${jobId} attempted to release lock held by job ${lockInfo?.jobId} on ${workDir}`);
            return;
        }

        this.lockedDirs.delete(workDir);
        getLogger().debug('Released lock on work directory', {
            workDir,
            jobId,
        });
    }

    /**
     * Gets information about a locked work directory
     *
     * @param workDir Work directory path
     * @returns Lock information or null if not locked
     */
    getLockInfo(workDir: string): LockInfo | null {
        return this.lockedDirs.get(workDir) || null;
    }

    /**
     * Ensures a work directory exists
     *
     * Creates the work directory and repository subdirectory if they don't exist.
     * Does NOT clone the repository - use GitHubRepository.ensureCloned() for that.
     *
     * @param workDir Work directory path
     */
    async ensureWorkDir(workDir: string): Promise<void> {
        // Create work directory if it doesn't exist
        if (!existsSync(workDir)) {
            await mkdir(workDir, { recursive: true });
            getLogger().info('Created work directory', {
                workDir,
            });
        }

        // Create repository subdirectory if it doesn't exist
        const repoDir = join(workDir, 'repository');
        if (!existsSync(repoDir)) {
            await mkdir(repoDir, { recursive: true });
            getLogger().debug('Created repository directory', {
                repoDir,
            });
        }
    }

    /**
     * Gets the path to the repository directory within a work directory
     *
     * @param workDir Work directory path
     * @returns Path to the repository directory
     */
    getRepositoryDir(workDir: string): string {
        return join(workDir, 'repository');
    }

    /**
     * Starts monitoring work directory size
     */
    startMonitoring(): void {
        getLogger().info('Starting work directory size monitoring...');

        // Check immediately
        this.checkAndCleanup();

        // Then check on interval
        this.intervalId = setInterval(() => this.checkAndCleanup(), this.monitorInterval);
    }

    /**
     * Stops monitoring
     */
    stopMonitoring(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Checks total size and cleans up if needed
     */
    async checkAndCleanup(): Promise<void> {
        try {
            const totalSizeGB = await this.getTotalSize();
            const thresholdGB = this.maxSizeGB * (this.cleanupThresholdPercent / 100);

            getLogger().debug('Work directory size check', {
                totalSizeGB: totalSizeGB.toFixed(2),
                thresholdGB: thresholdGB.toFixed(2),
            });

            if (totalSizeGB > thresholdGB) {
                getLogger().info('Work directory size exceeds threshold, cleaning up...');
                await this.cleanupOldDirs();
            }
        } catch (error) {
            getLogger().error('Error checking work directory size', error as Error);
        }
    }

    /**
     * Gets the total size of the work directory in GB
     *
     * @returns Total size in GB
     */
    async getTotalSize(): Promise<number> {
        if (!existsSync(this.basePath)) {
            return 0;
        }

        try {
            const { stdout } = await execAsync(`du -sb "${this.basePath}"`);
            const bytes = parseInt(stdout.split('\t')[0], 10);
            return bytes / (1024 * 1024 * 1024); // Convert to GB
        } catch (error) {
            getLogger().error('Error calculating directory size', error as Error);
            return 0;
        }
    }

    /**
     * Cleans up old work directories
     *
     * Deletes oldest directories until size is below 80% of max
     */
    async cleanupOldDirs(): Promise<void> {
        const targetSizeGB = this.maxSizeGB * 0.8; // 80% of max

        try {
            // Get all directories with their last access time
            const dirs = await this.getDirectoriesByAge();

            let currentSizeGB = await this.getTotalSize();
            let deletedCount = 0;

            for (const dir of dirs) {
                if (currentSizeGB <= targetSizeGB) {
                    break; // Reached target size
                }

                const dirPath = join(this.basePath, dir.name);
                const dirSizeGB = dir.sizeGB;

                getLogger().info('Deleting old work directory', {
                    directory: dir.name,
                    sizeGB: dirSizeGB.toFixed(2),
                });

                try {
                    await rm(dirPath, { recursive: true, force: true });
                    currentSizeGB -= dirSizeGB;
                    deletedCount++;
                } catch (error) {
                    getLogger().error('Failed to delete directory', error as Error, {
                        directory: dir.name,
                    });
                }
            }

            getLogger().info('Cleanup complete', {
                directoriesDeleted: deletedCount,
                newSizeGB: currentSizeGB.toFixed(2),
            });
        } catch (error) {
            getLogger().error('Error during cleanup', error as Error);
        }
    }

    /**
     * Gets all directories sorted by age (oldest first)
     *
     * @returns Array of directory info objects
     */
    async getDirectoriesByAge(): Promise<DirectoryInfo[]> {
        if (!existsSync(this.basePath)) {
            return [];
        }

        const entries = await readdir(this.basePath, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory());

        const dirInfo = await Promise.all(
            dirs.map(async (dir): Promise<DirectoryInfo> => {
                const dirPath = join(this.basePath, dir.name);
                const stats = await stat(dirPath);

                // Calculate directory size
                let sizeGB = 0;
                try {
                    const { stdout } = await execAsync(`du -sb "${dirPath}"`);
                    const bytes = parseInt(stdout.split('\t')[0], 10);
                    sizeGB = bytes / (1024 * 1024 * 1024);
                } catch (error) {
                    getLogger().error('Error getting directory size', error as Error, {
                        directory: dir.name,
                    });
                }

                return {
                    name: dir.name,
                    accessTime: stats.atime,
                    sizeGB,
                };
            }),
        );

        // Sort by access time (oldest first)
        dirInfo.sort((a, b) => a.accessTime.getTime() - b.accessTime.getTime());

        return dirInfo;
    }
}
