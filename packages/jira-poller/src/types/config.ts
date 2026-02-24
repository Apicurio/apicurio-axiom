/**
 * Configuration type definitions for Jira Poller
 */

export interface JiraConfig {
    url: string;
    username: string;
    apiToken: string;
    pollInterval: number;
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
    jira: JiraConfig;
    nats: NatsConfig;
    projects: string[];
    state?: StateConfig;
    logging?: LoggingConfig;
}
