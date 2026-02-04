/**
 * Work directory type definitions
 */

export interface WorkDirectoryConfig {
    basePath?: string;
    maxSizeGB?: number;
    cleanupThresholdPercent?: number;
    monitorInterval?: number;
}

export interface LockInfo {
    jobId: number;
    timestamp: number;
}

export interface DirectoryInfo {
    name: string;
    accessTime: Date;
    sizeGB: number;
}
