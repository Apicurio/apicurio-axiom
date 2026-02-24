/**
 * Log Manager
 *
 * Manages automatic cleanup of old log files based on retention policy:
 * - Application logs (in basePath)
 * - Event JSON logs (in eventsPath)
 * - Time-based cleanup (delete files older than retentionDays)
 * - Periodic monitoring
 */

import { existsSync } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { getLogger } from './logger.js';

export interface LogManagerConfig {
    basePath?: string;
    eventsPath?: string;
    retentionDays?: number;
}

interface FileInfo {
    path: string;
    relativePath: string;
    modifiedTime: Date;
}

export class LogManager {
    private logBasePath: string;
    private eventsPath: string;
    private retentionDays: number;
    private monitorInterval: number;
    private intervalId: NodeJS.Timeout | null;

    /**
     * Creates a new LogManager instance
     *
     * @param config Logging configuration
     */
    constructor(config: LogManagerConfig) {
        this.logBasePath = resolve(process.cwd(), config.basePath || './data/logs');
        this.eventsPath = resolve(process.cwd(), config.eventsPath || './data/events');
        this.retentionDays = config.retentionDays || 30;
        this.monitorInterval = 24 * 60 * 60 * 1000; // 24 hours in ms
        this.intervalId = null;
    }

    /**
     * Initializes the log manager
     */
    async initialize(): Promise<void> {
        getLogger().debug('Log manager initialized', {
            logBasePath: this.logBasePath,
            eventsPath: this.eventsPath,
            retentionDays: this.retentionDays,
        });
    }

    /**
     * Starts monitoring and cleaning up old log files
     */
    startMonitoring(): void {
        getLogger().info('Starting log cleanup monitoring...', {
            retentionDays: this.retentionDays,
        });

        // Check immediately on startup
        this.cleanupOldLogs();

        // Then check on interval (daily)
        this.intervalId = setInterval(() => this.cleanupOldLogs(), this.monitorInterval);
    }

    /**
     * Stops monitoring
     */
    stopMonitoring(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            getLogger().debug('Stopped log cleanup monitoring');
        }
    }

    /**
     * Cleans up log files older than retention period
     */
    async cleanupOldLogs(): Promise<void> {
        try {
            getLogger().debug('Running log cleanup check...');

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            let totalDeleted = 0;

            // Clean up action logs
            if (existsSync(this.logBasePath)) {
                const actionLogsDeleted = await this.cleanupDirectory(this.logBasePath, cutoffDate);
                totalDeleted += actionLogsDeleted;
            }

            // Clean up event logs
            if (existsSync(this.eventsPath)) {
                const eventLogsDeleted = await this.cleanupDirectory(this.eventsPath, cutoffDate);
                totalDeleted += eventLogsDeleted;
            }

            if (totalDeleted > 0) {
                getLogger().info('Log cleanup complete', {
                    filesDeleted: totalDeleted,
                    cutoffDate: cutoffDate.toISOString(),
                });
            } else {
                getLogger().debug('No old log files to clean up');
            }
        } catch (error: unknown) {
            getLogger().error('Error during log cleanup', error instanceof Error ? error : undefined);
        }
    }

    /**
     * Recursively cleans up old files in a directory
     *
     * @param dirPath Directory path to clean
     * @param cutoffDate Files older than this date will be deleted
     * @returns Number of files deleted
     */
    private async cleanupDirectory(dirPath: string, cutoffDate: Date): Promise<number> {
        let deletedCount = 0;

        try {
            const oldFiles = await this.findOldFiles(dirPath, cutoffDate);

            for (const file of oldFiles) {
                try {
                    await rm(file.path, { force: true });
                    deletedCount++;
                    getLogger().debug('Deleted old log file', {
                        file: file.relativePath,
                        modifiedTime: file.modifiedTime.toISOString(),
                    });
                } catch (error: unknown) {
                    getLogger().error('Failed to delete log file', error instanceof Error ? error : undefined, {
                        file: file.relativePath,
                    });
                }
            }

            // Clean up empty directories
            await this.cleanupEmptyDirs(dirPath);
        } catch (error: unknown) {
            getLogger().error('Error cleaning up directory', error instanceof Error ? error : undefined, {
                directory: dirPath,
            });
        }

        return deletedCount;
    }

    /**
     * Recursively finds all files older than cutoff date
     *
     * @param dirPath Directory to search
     * @param cutoffDate Cutoff date
     * @returns Array of file information
     */
    private async findOldFiles(dirPath: string, cutoffDate: Date): Promise<FileInfo[]> {
        const oldFiles: FileInfo[] = [];

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // Recurse into subdirectories
                    const subDirFiles = await this.findOldFiles(fullPath, cutoffDate);
                    oldFiles.push(...subDirFiles);
                } else if (entry.isFile()) {
                    // Check file age
                    const stats = await stat(fullPath);
                    if (stats.mtime < cutoffDate) {
                        oldFiles.push({
                            path: fullPath,
                            relativePath: fullPath.replace(`${dirPath}/`, ''),
                            modifiedTime: stats.mtime,
                        });
                    }
                }
            }
        } catch (error: unknown) {
            getLogger().error('Error reading directory', error instanceof Error ? error : undefined, {
                directory: dirPath,
            });
        }

        return oldFiles;
    }

    /**
     * Recursively removes empty directories
     *
     * @param dirPath Directory to clean
     */
    private async cleanupEmptyDirs(dirPath: string): Promise<void> {
        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            // First, recurse into subdirectories
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const subDirPath = join(dirPath, entry.name);
                    await this.cleanupEmptyDirs(subDirPath);
                }
            }

            // Then check if current directory is empty (and not a base path)
            const updatedEntries = await readdir(dirPath);
            if (updatedEntries.length === 0 && dirPath !== this.logBasePath && dirPath !== this.eventsPath) {
                await rm(dirPath, { recursive: true, force: true });
                getLogger().debug('Removed empty directory', {
                    directory: dirPath,
                });
            }
        } catch (_error: unknown) {
            // Ignore errors for empty directory cleanup
            getLogger().debug('Error cleaning empty directories', {
                directory: dirPath,
            });
        }
    }
}
