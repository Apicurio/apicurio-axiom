/**
 * Configuration type definitions
 */

import type { EventMapping } from './filters.js';

export interface GitHubConfig {
    token: string;
    pollInterval: number;
    ignoreEventsBeforeStart?: boolean;
}

export interface ActionConfig {
    [actionName: string]: any;
}

export interface WorkDirectoryConfig {
    basePath?: string;
    maxSizeGB?: number;
    cleanupThresholdPercent?: number;
    monitorInterval?: number;
}

export interface QueueConfig {
    maxConcurrent?: number;
    pollInterval?: number;
}

export interface LoggingConfig {
    level?: string;
    logToFile?: boolean;
    prettyPrint?: boolean;
    basePath?: string;
    eventsPath?: string;
    retentionDays?: number;
}

export interface VertexAISafety {
    maxSteps?: number;
    maxToolCalls?: number;
    maxTokens?: number;
}

export interface ContextManagementConfig {
    keepRecentPairs?: number;
    maxToolOutputTokens?: number;
}

export interface VertexAIConfig {
    projectId: string;
    region?: string;
    model?: string;
    safety?: VertexAISafety;
    contextManagement?: ContextManagementConfig;
}

export interface StateConfig {
    basePath?: string;
}

export interface PromptsConfig {
    basePath?: string;
    systemTemplate?: string;
}

export interface Config {
    github: GitHubConfig;
    repositories: string[];
    eventMappings: EventMapping[];
    actions: ActionConfig;
    workDirectory?: WorkDirectoryConfig;
    queue?: QueueConfig;
    logging?: LoggingConfig;
    vertexAI?: VertexAIConfig;
    state?: StateConfig;
    prompts?: PromptsConfig;
}

// Alias for backward compatibility
export type ConfigData = Config;

// Re-export for convenience
export type { EventMapping };
