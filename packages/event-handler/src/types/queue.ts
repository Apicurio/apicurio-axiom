/**
 * Job queue type definitions
 */

import type { Event } from './events.js';

export interface QueueConfiguration {
    maxConcurrent?: number;
    pollInterval?: number;
}

export interface Job {
    id: number;
    action_name: string;
    event_data: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    created_at: number;
    started_at: number | null;
    completed_at: number | null;
    error: string | null;
    log_file: string | null;
}

export interface QueueStats {
    pending: number;
    running: number;
    completed: number;
    failed: number;
}

export type JobReadyCallback = (jobId: number, actionName: string, event: Event) => Promise<void>;
