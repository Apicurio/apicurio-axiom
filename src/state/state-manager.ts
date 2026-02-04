/**
 * State Manager
 *
 * Tracks processed events to avoid reprocessing them.
 * Uses SQLite database for efficient storage and querying.
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { getLogger } from '../logging/logger.js';
import type { StateConfig } from '../types/config.js';

interface RepositoryStat {
    repository: string;
    count: number;
}

interface Stats {
    totalProcessed: number;
    byRepository: RepositoryStat[];
}

export class StateManager {
    private stateDir: string;
    private dbPath: string;
    public db: Database.Database | null;

    /**
     * Creates a new StateManager instance
     *
     * @param stateConfig State configuration (for state directory path)
     */
    constructor(stateConfig: StateConfig = {}) {
        this.stateDir = resolve(process.cwd(), stateConfig?.basePath || '.state');
        this.dbPath = resolve(this.stateDir, 'events.db');
        this.db = null;
    }

    /**
     * Initializes the state manager by creating/opening the database
     */
    async initialize(): Promise<void> {
        // Create state directory if it doesn't exist
        if (!existsSync(this.stateDir)) {
            await mkdir(this.stateDir, { recursive: true });
        }

        // Open database connection
        this.db = new Database(this.dbPath);

        // Enable WAL mode for better concurrent performance
        this.db.pragma('journal_mode = WAL');

        // Create tables if they don't exist
        this.createTables();

        // Clean up old events
        this.cleanupOldEvents();

        getLogger().debug('State database initialized', {
            dbPath: this.dbPath,
        });
    }

    /**
     * Creates database tables
     */
    private createTables(): void {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS processed_events (
                event_id TEXT PRIMARY KEY,
                repository TEXT NOT NULL,
                event_type TEXT NOT NULL,
                processed_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_repository ON processed_events(repository);
            CREATE INDEX IF NOT EXISTS idx_processed_at ON processed_events(processed_at);

            CREATE TABLE IF NOT EXISTS app_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
        `);

        // Set app start time if not already set (first run)
        this.initializeAppStartTime();
    }

    /**
     * Initializes the app start time on first run
     */
    private initializeAppStartTime(): void {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const existing = this.db.prepare("SELECT value FROM app_metadata WHERE key = 'app_start_time'").get() as
            | { value: string }
            | undefined;

        if (!existing) {
            const now = Date.now();
            this.db
                .prepare('INSERT INTO app_metadata (key, value, updated_at) VALUES (?, ?, ?)')
                .run('app_start_time', now.toString(), now);
            getLogger().info('App start time initialized', {
                startTime: new Date(now).toISOString(),
            });
        }
    }

    /**
     * Gets the application start time
     *
     * @returns Application start time as Unix timestamp in milliseconds
     */
    getAppStartTime(): number {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const result = this.db.prepare("SELECT value FROM app_metadata WHERE key = 'app_start_time'").get() as
            | { value: string }
            | undefined;

        if (!result) {
            // Shouldn't happen, but return current time as fallback
            return Date.now();
        }

        return parseInt(result.value, 10);
    }

    /**
     * Cleans up events older than 30 days to prevent unbounded growth
     */
    private cleanupOldEvents(): void {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const result = this.db.prepare('DELETE FROM processed_events WHERE processed_at < ?').run(thirtyDaysAgo);

        if (result.changes > 0) {
            getLogger().info('Cleaned up old events from database', {
                eventsRemoved: result.changes,
                olderThan: '30 days',
            });
        }
    }

    /**
     * Checks if an event has been processed
     *
     * @param eventId Unique event identifier
     * @returns True if the event has been processed
     */
    hasProcessed(eventId: string): boolean {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const stmt = this.db.prepare('SELECT 1 FROM processed_events WHERE event_id = ? LIMIT 1');
        const result = stmt.get(eventId);
        return result !== undefined;
    }

    /**
     * Marks an event as processed
     *
     * @param eventId Unique event identifier
     * @param repository Repository in format owner/repo
     * @param eventType Event type
     */
    async markProcessed(eventId: string, repository: string = '', eventType: string = ''): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const stmt = this.db.prepare(
            'INSERT OR IGNORE INTO processed_events (event_id, repository, event_type, processed_at) VALUES (?, ?, ?, ?)',
        );

        stmt.run(eventId, repository, eventType, Date.now());
    }

    /**
     * Gets statistics about processed events
     *
     * @returns Statistics object
     */
    getStats(): Stats {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM processed_events');
        const total = (totalStmt.get() as { count: number }).count;

        const byRepoStmt = this.db.prepare(`
            SELECT repository, COUNT(*) as count
            FROM processed_events
            GROUP BY repository
            ORDER BY count DESC
        `);
        const byRepository = byRepoStmt.all() as RepositoryStat[];

        return {
            totalProcessed: total,
            byRepository,
        };
    }

    /**
     * Closes the database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Legacy method for compatibility - no longer used with event-based tracking
     *
     * @param _repo Repository in format owner/repo
     * @returns Always returns null
     * @deprecated This method is no longer needed with event-based deduplication
     */
    getLastSeen(_repo: string): Date | null {
        return null;
    }

    /**
     * Legacy method for compatibility - no longer used with event-based tracking
     *
     * @param _repo Repository in format owner/repo
     * @param _timestamp Timestamp to set
     * @deprecated This method is no longer needed with event-based deduplication
     */
    async updateLastSeen(_repo: string, _timestamp: Date): Promise<void> {
        // No-op for compatibility
    }
}
