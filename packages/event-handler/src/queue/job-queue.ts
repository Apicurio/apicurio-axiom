/**
 * Job Queue
 *
 * Persistent job queue for action execution with concurrency control.
 * Uses SQLite database for persistence across restarts.
 */

import type Database from 'better-sqlite3';
import { getLogger } from '../logging/logger.js';
import type { Event } from '../types/events.js';
import type { Job, JobReadyCallback, QueueConfiguration, QueueStats } from '../types/queue.js';

// Forward declaration for WorkDirectoryManager to avoid circular dependency
interface WorkDirectoryManager {
    getWorkDirForEvent(event: Event): string;
    isLocked(workDir: string): boolean;
    getLockInfo(workDir: string): { jobId: number; timestamp: number } | null;
}

export class JobQueue {
    private db: Database.Database;
    private maxConcurrent: number;
    private pollInterval: number;
    private intervalId: NodeJS.Timeout | null;
    private isProcessing: boolean;
    private workDirManager: WorkDirectoryManager | null;
    public onJobReady?: JobReadyCallback;

    /**
     * Creates a new JobQueue instance
     *
     * @param db SQLite database instance
     * @param config Queue configuration
     * @param workDirManager Work directory manager instance
     */
    constructor(db: Database.Database, config: QueueConfiguration, workDirManager: WorkDirectoryManager | null) {
        this.db = db;
        this.maxConcurrent = config.maxConcurrent || 3;
        this.pollInterval = (config.pollInterval || 5) * 1000; // Convert to ms
        this.intervalId = null;
        this.isProcessing = false;
        this.workDirManager = workDirManager;
    }

    /**
     * Initializes the job queue by creating tables
     */
    async initialize(): Promise<void> {
        this.createTables();

        // Reset any jobs that were "running" when the app stopped
        this.resetStuckJobs();

        getLogger().debug('Job queue initialized', {
            maxConcurrent: this.maxConcurrent,
        });
    }

    /**
     * Creates database tables for the job queue
     */
    private createTables(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS job_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_name TEXT NOT NULL,
                event_data TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                started_at INTEGER,
                completed_at INTEGER,
                error TEXT,
                log_file TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_status_created ON job_queue(status, created_at);
        `);
    }

    /**
     * Resets jobs that were marked as "running" when the app stopped
     *
     * This handles the case where the app crashed while jobs were running.
     */
    private resetStuckJobs(): void {
        const result = this.db
            .prepare("UPDATE job_queue SET status = 'pending', started_at = NULL WHERE status = 'running'")
            .run();

        if (result.changes > 0) {
            getLogger().info('Reset stuck jobs to pending status', {
                jobsReset: result.changes,
            });
        }
    }

    /**
     * Enqueues a job for execution
     *
     * @param actionName Name of the action to execute
     * @param event Event object that triggered the action
     * @returns Job ID
     */
    enqueue(actionName: string, event: Event): number {
        const stmt = this.db.prepare(`
            INSERT INTO job_queue (action_name, event_data, status, created_at)
            VALUES (?, ?, 'pending', ?)
        `);

        const result = stmt.run(actionName, JSON.stringify(event), Date.now());

        const jobId = result.lastInsertRowid as number;
        getLogger().debug('Enqueued job', {
            jobId,
            actionName,
            eventType: event.type,
        });
        return jobId;
    }

    /**
     * Starts the queue processing loop
     */
    startProcessing(): void {
        if (this.isProcessing) {
            getLogger().warn('Queue processing is already running');
            return;
        }

        getLogger().info('Starting queue processing...');
        this.isProcessing = true;

        // Process immediately
        this.processQueue();

        // Then process on interval
        this.intervalId = setInterval(() => this.processQueue(), this.pollInterval);
    }

    /**
     * Stops the queue processing loop
     */
    stopProcessing(): void {
        if (!this.isProcessing) {
            return;
        }

        getLogger().info('Stopping queue processing...');
        this.isProcessing = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Processes the queue by executing pending jobs
     *
     * Respects the maxConcurrent limit.
     */
    async processQueue(): Promise<void> {
        try {
            const runningCount = this.getRunningCount();

            // Start as many jobs as we can within the concurrent limit
            const slotsAvailable = this.maxConcurrent - runningCount;

            if (slotsAvailable <= 0) {
                return; // At capacity
            }

            // Get next pending jobs (FIFO order)
            const jobs = this.getNextPendingJobs(slotsAvailable);

            if (jobs.length === 0) {
                return; // No pending jobs
            }

            // Process each job (don't await - let them run concurrently)
            for (const job of jobs) {
                this.processJob(job).catch((error) => {
                    getLogger().error('Error processing job', error as Error, {
                        jobId: job.id,
                    });
                });
            }
        } catch (error) {
            getLogger().error('Error in queue processing', error as Error);
        }
    }

    /**
     * Gets the count of currently running jobs
     *
     * @returns Count of running jobs
     */
    private getRunningCount(): number {
        const result = this.db.prepare("SELECT COUNT(*) as count FROM job_queue WHERE status = 'running'").get() as {
            count: number;
        };
        return result.count;
    }

    /**
     * Gets the next pending jobs in FIFO order, excluding jobs with locked work directories
     *
     * @param limit Maximum number of jobs to retrieve
     * @returns Array of job objects
     */
    private getNextPendingJobs(limit: number): Job[] {
        // Get more jobs than the limit to account for filtering
        const stmt = this.db.prepare(`
            SELECT * FROM job_queue
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT ?
        `);

        // Fetch more than needed to ensure we get enough after filtering
        const allPendingJobs = stmt.all(limit * 3) as Job[];

        if (!this.workDirManager) {
            // If no work directory manager, return jobs without filtering
            return allPendingJobs.slice(0, limit);
        }

        // Filter out jobs whose work directories are locked
        const availableJobs: Job[] = [];
        for (const job of allPendingJobs) {
            try {
                // Parse event data to get work directory
                const event = JSON.parse(job.event_data) as Event;
                const workDir = this.workDirManager.getWorkDirForEvent(event);

                // Skip if work directory is locked
                if (this.workDirManager.isLocked(workDir)) {
                    const lockInfo = this.workDirManager.getLockInfo(workDir);
                    getLogger().debug('Skipping job - work directory locked', {
                        jobId: job.id,
                        workDir,
                        lockedByJob: lockInfo?.jobId,
                    });
                    continue;
                }

                availableJobs.push(job);

                // Stop once we have enough jobs
                if (availableJobs.length >= limit) {
                    break;
                }
            } catch (error) {
                getLogger().error('Error checking lock for job', error as Error, {
                    jobId: job.id,
                });
                // On error, include the job (fail-open approach)
                availableJobs.push(job);
            }
        }

        return availableJobs;
    }

    /**
     * Processes a single job
     *
     * @param job Job object from database
     */
    private async processJob(job: Job): Promise<void> {
        // Mark as running
        this.markRunning(job.id);

        try {
            // Parse event data
            const event = JSON.parse(job.event_data) as Event;

            getLogger().info('Starting job', {
                jobId: job.id,
                actionName: job.action_name,
            });

            // The actual execution will be handled by the action executor
            // which will call back to markCompleted or markFailed
            // For now, we'll emit an event that the executor can listen to
            if (this.onJobReady) {
                await this.onJobReady(job.id, job.action_name, event);
            }
        } catch (error) {
            getLogger().error('Failed to process job', error as Error, {
                jobId: job.id,
            });
            this.markFailed(job.id, (error as Error).message, null);
        }
    }

    /**
     * Marks a job as running
     *
     * @param jobId Job ID
     */
    private markRunning(jobId: number): void {
        this.db
            .prepare(`
            UPDATE job_queue
            SET status = 'running', started_at = ?
            WHERE id = ?
        `)
            .run(Date.now(), jobId);
    }

    /**
     * Marks a job as completed
     *
     * @param jobId Job ID
     * @param logFile Path to log file
     */
    markCompleted(jobId: number, logFile: string): void {
        this.db
            .prepare(`
            UPDATE job_queue
            SET status = 'completed', completed_at = ?, log_file = ?
            WHERE id = ?
        `)
            .run(Date.now(), logFile, jobId);

        getLogger().info('Job completed successfully', {
            jobId,
        });
    }

    /**
     * Marks a job as failed
     *
     * @param jobId Job ID
     * @param error Error message
     * @param logFile Path to log file
     */
    markFailed(jobId: number, error: string, logFile: string | null): void {
        this.db
            .prepare(`
            UPDATE job_queue
            SET status = 'failed', completed_at = ?, error = ?, log_file = ?
            WHERE id = ?
        `)
            .run(Date.now(), error, logFile, jobId);

        getLogger().error('Job failed', new Error(error), {
            jobId,
        });
    }

    /**
     * Resets a job back to pending status (for retry)
     *
     * Used when a job cannot proceed due to temporary conditions (e.g., work directory locked)
     *
     * @param jobId Job ID
     */
    resetToPending(jobId: number): void {
        this.db
            .prepare(`
            UPDATE job_queue
            SET status = 'pending', started_at = NULL
            WHERE id = ?
        `)
            .run(jobId);
    }

    /**
     * Gets statistics about the job queue
     *
     * @returns Queue statistics
     */
    getStats(): QueueStats {
        const stats: QueueStats = {
            pending: 0,
            running: 0,
            completed: 0,
            failed: 0,
        };

        const rows = this.db
            .prepare(`
            SELECT status, COUNT(*) as count
            FROM job_queue
            GROUP BY status
        `)
            .all() as Array<{ status: keyof QueueStats; count: number }>;

        for (const row of rows) {
            stats[row.status] = row.count;
        }

        return stats;
    }

    /**
     * Cleans up old completed and failed jobs
     *
     * @param olderThanDays Delete jobs older than this many days
     * @returns Number of jobs deleted
     */
    cleanupOldJobs(olderThanDays: number = 30): number {
        const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

        const result = this.db
            .prepare(`
            DELETE FROM job_queue
            WHERE status IN ('completed', 'failed')
            AND completed_at < ?
        `)
            .run(cutoffTime);

        if (result.changes > 0) {
            getLogger().info('Cleaned up old jobs from queue', {
                jobsRemoved: result.changes,
            });
        }

        return result.changes;
    }
}
