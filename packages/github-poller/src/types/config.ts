/**
 * Configuration type definitions for GitHub Poller
 */

export interface GitHubConfig {
    token: string;
    pollInterval: number;
    ignoreEventsBeforeStart?: boolean;
}

export interface NatsConfig {
    url: string;
    maxReconnectAttempts?: number;
    reconnectTimeWait?: number;
}

export interface StateConfig {
    basePath?: string;
}

export interface LoggingConfig {
    level?: string;
    prettyPrint?: boolean;
    eventsPath?: string;
}

export interface Config {
    github: GitHubConfig;
    nats: NatsConfig;
    repositories: string[];
    state?: StateConfig;
    logging?: LoggingConfig;
}
