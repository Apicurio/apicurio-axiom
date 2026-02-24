/**
 * Jira Poller
 *
 * Polls Jira for recently updated issues and publishes them to NATS.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Event, EventValidator } from '@axiom/common';
import { JiraClient } from '../client/jira-client.js';
import { getLogger, type Logger } from '../logging/logger.js';
import type { NatsPublisher } from '../publisher/nats-publisher.js';
import type { StateManager } from '../state/state-manager.js';
import type { JiraIssue } from '../types/jira.js';

export interface JiraPollerConfig {
    url: string;
    username: string;
    apiToken: string;
    projects: string[];
    pollInterval: number;
    eventsLogPath?: string;
}

export class JiraPoller {
    private client: JiraClient;
    private projects: string[];
    private pollInterval: number;
    private stateManager: StateManager;
    private natsPublisher: NatsPublisher;
    private eventValidator: EventValidator;
    private intervalId: NodeJS.Timeout | null;
    private isRunning: boolean;
    private eventsLogPath: string;
    private logger: Logger;
    private lastPollTime: Map<string, Date>;

    /**
     * Creates a new JiraPoller instance
     */
    constructor(
        config: JiraPollerConfig,
        stateManager: StateManager,
        natsPublisher: NatsPublisher,
        eventValidator: EventValidator,
    ) {
        this.client = new JiraClient(config.url, config.username, config.apiToken, getLogger());
        this.projects = config.projects;
        this.pollInterval = config.pollInterval * 1000; // Convert to milliseconds
        this.stateManager = stateManager;
        this.natsPublisher = natsPublisher;
        this.eventValidator = eventValidator;
        this.intervalId = null;
        this.isRunning = false;
        this.eventsLogPath = resolve(process.cwd(), config.eventsLogPath || './data/events');
        this.logger = getLogger();
        this.lastPollTime = new Map();
    }

    /**
     * Starts the polling loop
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Poller is already running');
            return;
        }

        this.logger.debug('Initializing state manager...');
        await this.stateManager.initialize();

        // Create events log directory
        if (!existsSync(this.eventsLogPath)) {
            await mkdir(this.eventsLogPath, { recursive: true });
            this.logger.info('Created events log directory', {
                path: this.eventsLogPath,
            });
        }

        this.logger.info('Starting Jira polling...');
        this.isRunning = true;

        // Initialize last poll times to now (to avoid processing all historical issues)
        const now = new Date();
        for (const project of this.projects) {
            this.lastPollTime.set(project, now);
        }

        // Do an initial poll immediately
        await this.poll();

        // Then set up the interval
        this.intervalId = setInterval(() => this.poll(), this.pollInterval);
    }

    /**
     * Stops the polling loop
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.logger.info('Stopping Jira polling...');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Performs a single poll of all projects
     */
    async poll(): Promise<void> {
        for (const project of this.projects) {
            try {
                await this.pollProject(project);
            } catch (error) {
                this.logger.error('Error polling project', error as Error, {
                    project,
                });
            }
        }
    }

    /**
     * Polls a single project for recently updated issues
     */
    async pollProject(project: string): Promise<void> {
        const lastPoll = this.lastPollTime.get(project);
        const issues = await this.client.searchRecentIssues(project, 50, lastPoll);

        if (issues.length > 0) {
            this.logger.debug('Found issues in project', {
                project,
                count: issues.length,
            });

            // Update last poll time
            this.lastPollTime.set(project, new Date());

            // Process issues in chronological order (oldest first)
            issues.reverse();

            for (const issue of issues) {
                await this.processIssue(project, issue);
            }
        }
    }

    /**
     * Processes a single Jira issue as an event
     */
    async processIssue(project: string, issue: JiraIssue): Promise<void> {
        const eventId = `jira:${issue.key}:${issue.fields.updated}`;

        // Skip if already processed
        if (this.stateManager.hasProcessed(eventId)) {
            return;
        }

        this.logger.debug('Processing issue', {
            issueKey: issue.key,
            project,
            updated: issue.fields.updated,
        });

        // Log issue JSON
        await this.logIssueJson(project, issue);

        // Normalize to internal Event format
        const normalizedEvent = this.normalizeIssue(project, issue);

        // Validate the normalized event
        const validationResult = this.eventValidator.validateEvent(normalizedEvent);

        if (!validationResult.valid) {
            this.logger.error('Event validation failed - rejecting event', undefined, {
                issueKey: issue.key,
                eventType: normalizedEvent.type,
                errors: this.eventValidator.formatErrors(validationResult.errors || []),
            });

            await this.stateManager.markProcessed(eventId, project, normalizedEvent.type);
            return;
        }

        this.logger.debug('Event validation passed', {
            issueKey: issue.key,
            eventType: normalizedEvent.type,
        });

        // Publish to NATS
        try {
            await this.natsPublisher.publish(normalizedEvent);
            this.logger.info('Event published to NATS', {
                issueKey: issue.key,
                eventType: normalizedEvent.type,
                project,
            });
        } catch (error) {
            this.logger.error('Failed to publish event to NATS', error as Error, {
                issueKey: issue.key,
                eventType: normalizedEvent.type,
            });
            return;
        }

        // Mark as processed
        await this.stateManager.markProcessed(eventId, project, normalizedEvent.type);
    }

    /**
     * Logs the issue JSON to disk
     */
    async logIssueJson(project: string, issue: JiraIssue): Promise<void> {
        try {
            const projectDir = join(this.eventsLogPath, project);

            if (!existsSync(projectDir)) {
                await mkdir(projectDir, { recursive: true });
            }

            const timestamp = new Date(issue.fields.updated).toISOString().replace(/[:.]/g, '-');
            const filename = `${timestamp}_${issue.key}.json`;
            const filePath = join(projectDir, filename);

            this.logger.debug('Logging issue to file', {
                filePath,
                issueKey: issue.key,
            });

            await writeFile(filePath, JSON.stringify(issue, null, 2), 'utf8');
        } catch (error) {
            this.logger.error('Failed to log issue JSON', error as Error, {
                issueKey: issue.key,
            });
        }
    }

    /**
     * Normalizes a Jira issue to internal Event format
     */
    normalizeIssue(project: string, issue: JiraIssue): Event {
        // Determine event type based on issue status
        const eventType = this.getEventType(issue);

        return {
            id: `${issue.key}-${issue.fields.updated}`,
            type: eventType,
            repository: issue.key,
            repositoryOwner: project,
            repositoryName: issue.key,
            actor: issue.fields.reporter?.displayName || 'unknown',
            createdAt: issue.fields.updated,
            issue: {
                number: this.extractIssueNumber(issue.key),
                title: issue.fields.summary,
                state: this.mapJiraStatus(issue.fields.status.name),
                labels: issue.fields.labels || [],
                author: issue.fields.reporter?.displayName || 'unknown',
                url: `${issue.self}`,
            },
        };
    }

    /**
     * Gets the event type from a Jira issue
     */
    getEventType(issue: JiraIssue): string {
        const statusCategory = issue.fields.status.statusCategory.key;

        // Map Jira status categories to event types
        if (statusCategory === 'new') {
            return 'issue.created';
        } else if (statusCategory === 'done') {
            return 'issue.closed';
        } else {
            return 'issue.updated';
        }
    }

    /**
     * Maps Jira status to GitHub-like state
     */
    mapJiraStatus(status: string): string {
        const statusLower = status.toLowerCase();

        if (statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('resolved')) {
            return 'closed';
        }

        return 'open';
    }

    /**
     * Extracts the numeric issue number from issue key
     */
    extractIssueNumber(issueKey: string): number {
        const parts = issueKey.split('-');
        return parseInt(parts[parts.length - 1], 10);
    }
}
