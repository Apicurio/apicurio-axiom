/**
 * GitHub Poller
 *
 * Polls GitHub API for events at regular intervals.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Octokit } from '@octokit/rest';
import { getLogger } from '../logging/logger.js';
import type { LoggingConfig } from '../types/config.js';
import type { Event } from '../types/events.js';
import type { GitHubEvent } from '../types/github.js';
import type { EventValidator } from '../validation/event-validator.js';

// Forward declarations to avoid circular dependencies
interface StateManager {
    initialize(): Promise<void>;
    hasProcessed(eventId: string): boolean;
    getAppStartTime(): number;
    markProcessed(eventId: string, repository: string, eventType: string): Promise<void>;
}

interface EventProcessor {
    process(event: Event): Promise<void>;
}

export class GitHubPoller {
    private octokit: Octokit;
    private repositories: string[];
    private pollInterval: number;
    private stateManager: StateManager;
    private eventProcessor: EventProcessor;
    private eventValidator: EventValidator;
    private intervalId: NodeJS.Timeout | null;
    private isRunning: boolean;
    private ignoreEventsBeforeStart: boolean;
    private eventsLogPath: string;

    /**
     * Creates a new GitHubPoller instance
     *
     * @param token GitHub personal access token
     * @param repositories Array of repositories to monitor (owner/repo format)
     * @param pollInterval Polling interval in seconds
     * @param stateManager State manager instance
     * @param eventProcessor Event processor instance
     * @param eventValidator Event validator instance
     * @param ignoreEventsBeforeStart Whether to ignore events before app start time
     * @param loggingConfig Logging configuration (for events path)
     */
    constructor(
        token: string,
        repositories: string[],
        pollInterval: number,
        stateManager: StateManager,
        eventProcessor: EventProcessor,
        eventValidator: EventValidator,
        ignoreEventsBeforeStart: boolean = true,
        loggingConfig: LoggingConfig = {},
    ) {
        this.octokit = new Octokit({ auth: token });
        this.repositories = repositories;
        this.pollInterval = pollInterval * 1000; // Convert to milliseconds
        this.stateManager = stateManager;
        this.eventProcessor = eventProcessor;
        this.eventValidator = eventValidator;
        this.intervalId = null;
        this.isRunning = false;
        this.ignoreEventsBeforeStart = ignoreEventsBeforeStart;
        this.eventsLogPath = resolve(process.cwd(), loggingConfig?.eventsPath || './data/events');
    }

    /**
     * Starts the polling loop
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            getLogger().warn('Poller is already running');
            return;
        }

        getLogger().debug('Initializing state manager...');
        await this.stateManager.initialize();

        // Create events log directory if it doesn't exist
        if (!existsSync(this.eventsLogPath)) {
            await mkdir(this.eventsLogPath, { recursive: true });
            getLogger().info('Created events log directory', {
                path: this.eventsLogPath,
            });
        }

        getLogger().info('Starting event polling...');
        this.isRunning = true;

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

        getLogger().info('Stopping event polling...');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Performs a single poll of all repositories
     */
    async poll(): Promise<void> {
        for (const repo of this.repositories) {
            try {
                await this.pollRepository(repo);
            } catch (error) {
                getLogger().error('Error polling repository', error as Error, {
                    repository: repo,
                });
            }
        }
    }

    /**
     * Polls a single repository for events
     *
     * @param repo Repository in format owner/repo
     */
    async pollRepository(repo: string): Promise<void> {
        const [owner, repoName] = repo.split('/');

        // Get events from the repository
        const events = await this.fetchEvents(owner, repoName);

        if (events.length > 0) {
            // Process events in chronological order (oldest first)
            events.reverse();

            for (const event of events) {
                await this.processEvent(repo, event);
            }
        }
    }

    /**
     * Fetches events from GitHub API
     *
     * @param owner Repository owner
     * @param repo Repository name
     * @returns Array of events
     */
    async fetchEvents(owner: string, repo: string): Promise<GitHubEvent[]> {
        try {
            const params = {
                owner,
                repo,
                per_page: 100,
            };

            const response = await this.octokit.activity.listRepoEvents(params);

            return response.data as GitHubEvent[];
        } catch (error) {
            getLogger().error('Failed to fetch events for repository', error as Error, {
                owner,
                repo,
            });
            return [];
        }
    }

    /**
     * Processes a single event
     *
     * @param repo Repository in format owner/repo
     * @param event GitHub event object
     */
    async processEvent(repo: string, event: GitHubEvent): Promise<void> {
        const eventId = `${repo}:${event.id}`;

        // Skip if already processed
        if (this.stateManager.hasProcessed(eventId)) {
            return;
        }

        // Check if event occurred before app start time
        if (this.ignoreEventsBeforeStart) {
            const appStartTime = this.stateManager.getAppStartTime();
            const eventTime = new Date(event.created_at).getTime();

            if (eventTime < appStartTime) {
                return;
            }
        }

        getLogger().debug('Processing event', {
            eventType: event.type,
            eventId: event.id,
            repository: repo,
            createdAt: event.created_at,
        });

        // Log full event JSON for all events
        await this.logEventJson(repo, event);

        // Convert GitHub event to our internal format (may fetch additional data)
        const normalizedEvent = await this.normalizeEvent(repo, event);

        // Validate the normalized event
        const validationResult = this.eventValidator.validateEvent(normalizedEvent);

        if (!validationResult.valid) {
            getLogger().error('Event validation failed - rejecting event', undefined, {
                eventId: event.id,
                eventType: normalizedEvent.type,
                repository: repo,
                errors: this.eventValidator.formatErrors(validationResult.errors || []),
            });

            // Mark as processed to avoid reprocessing invalid events
            await this.stateManager.markProcessed(eventId, repo, normalizedEvent.type);
            return;
        }

        getLogger().debug('Event validation passed', {
            eventId: event.id,
            eventType: normalizedEvent.type,
        });

        // Process through event processor
        await this.eventProcessor.process(normalizedEvent);

        // Mark as processed
        await this.stateManager.markProcessed(eventId, repo, normalizedEvent.type);
    }

    /**
     * Logs the full event JSON to disk
     *
     * @param repo Repository in format owner/repo
     * @param event GitHub event object
     */
    async logEventJson(repo: string, event: GitHubEvent): Promise<void> {
        try {
            const [owner, repoName] = repo.split('/');
            const repoDir = join(this.eventsLogPath, owner, repoName);

            // Create repository directory if it doesn't exist
            if (!existsSync(repoDir)) {
                await mkdir(repoDir, { recursive: true });
            }

            // Generate filename with timestamp and event ID
            const timestamp = new Date(event.created_at).toISOString().replace(/[:.]/g, '-');
            const filename = `${timestamp}_${event.id}_${event.type}.json`;
            const filePath = join(repoDir, filename);

            getLogger().debug('Logging processed event to file', {
                filePath,
                eventId: event.id,
            });

            // Write event JSON to file
            await writeFile(filePath, JSON.stringify(event, null, 2), 'utf8');
        } catch (error) {
            getLogger().error('Failed to log event JSON', error as Error, {
                eventId: event.id,
            });
            // Don't throw - event processing should continue even if logging fails
        }
    }

    /**
     * Normalizes a GitHub event into our internal format
     *
     * @param repo Repository in format owner/repo
     * @param event GitHub event object
     * @returns Normalized event
     */
    async normalizeEvent(repo: string, event: GitHubEvent): Promise<Event> {
        const [owner, repoName] = repo.split('/');

        const normalized: Event = {
            id: event.id,
            type: this.getEventType(event),
            repository: repo,
            repositoryOwner: owner,
            repositoryName: repoName,
            actor: event.actor.login,
            createdAt: event.created_at,
            payload: event.payload,
            rawEvent: event,
        };

        // Add event-specific fields (may fetch additional data from REST API)
        await this.enrichEvent(normalized, event);

        return normalized;
    }

    /**
     * Gets the event type in our format (e.g., "issue.opened", "pull_request.opened")
     *
     * @param event GitHub event object
     * @returns Event type
     */
    getEventType(event: GitHubEvent): string {
        const type = event.type;

        // Map GitHub event types to our format
        if (type === 'IssuesEvent') {
            return `issue.${event.payload.action}`;
        } else if (type === 'PullRequestEvent') {
            return `pull_request.${event.payload.action}`;
        } else if (type === 'IssueCommentEvent') {
            return `issue_comment.${event.payload.action}`;
        } else if (type === 'PullRequestReviewEvent') {
            return `pull_request_review.${event.payload.action}`;
        } else if (type === 'PullRequestReviewCommentEvent') {
            return `pull_request_review_comment.${event.payload.action}`;
        } else if (type === 'PushEvent') {
            return 'push';
        } else if (type === 'CreateEvent') {
            return 'create';
        } else if (type === 'ForkEvent') {
            return 'fork';
        } else if (type === 'ReleaseEvent') {
            return `release.${event.payload.action}`;
        } else if (type === 'DiscussionEvent') {
            return `discussion.${event.payload.action}`;
        }

        // Default to lowercase event type
        return type.replace('Event', '').toLowerCase();
    }

    /**
     * Enriches the normalized event with type-specific data
     *
     * @param normalized Normalized event object
     * @param event GitHub event object
     */
    async enrichEvent(normalized: Event, event: GitHubEvent): Promise<void> {
        const payload = event.payload;

        if (payload.issue) {
            normalized.issue = {
                number: payload.issue.number,
                title: payload.issue.title,
                state: payload.issue.state,
                labels: (payload.issue.labels || []).map((l) => l.name),
                author: payload.issue.user?.login || 'unknown',
                url: payload.issue.html_url,
            };
        }

        if (payload.pull_request) {
            // Check if we have a complete PR object or an abbreviated one from the Events API
            const pr = payload.pull_request;
            const needsFullData = !pr.title || !pr.state || pr.html_url === undefined || pr.draft === undefined;

            if (needsFullData && pr.number) {
                // Fetch full PR details from REST API
                try {
                    const [owner, repo] = normalized.repository.split('/');
                    const { data: fullPR } = await this.octokit.pulls.get({
                        owner,
                        repo,
                        pull_number: pr.number,
                    });

                    normalized.pullRequest = {
                        number: fullPR.number,
                        title: fullPR.title,
                        state: fullPR.state,
                        labels: (fullPR.labels || []).map((l) => l.name),
                        author: fullPR.user?.login || 'unknown',
                        url: fullPR.html_url,
                        draft: fullPR.draft || false,
                    };

                    getLogger().debug('Fetched full PR details from REST API', {
                        prNumber: pr.number,
                        repository: normalized.repository,
                    });
                } catch (error) {
                    getLogger().warn('Failed to fetch full PR details, using partial data', {
                        error: error as Error,
                        prNumber: pr.number,
                        repository: normalized.repository,
                    });
                    // Fallback to whatever data we have
                    normalized.pullRequest = {
                        number: pr.number,
                        title: pr.title || '',
                        state: pr.state || 'open',
                        labels: (pr.labels || []).map((l) => l.name),
                        author: pr.user?.login || 'unknown',
                        url: pr.html_url || pr.url || '',
                        draft: pr.draft || false,
                    };
                }
            } else {
                // We have complete data
                normalized.pullRequest = {
                    number: pr.number,
                    title: pr.title,
                    state: pr.state,
                    labels: (pr.labels || []).map((l) => l.name),
                    author: pr.user?.login || 'unknown',
                    url: pr.html_url,
                    draft: pr.draft,
                };
            }
        }

        if (payload.discussion) {
            normalized.discussion = {
                number: payload.discussion.number,
                title: payload.discussion.title,
                category: payload.discussion.category?.name || 'unknown',
                author: payload.discussion.user?.login || 'unknown',
                url: payload.discussion.html_url,
            };
        }

        if (payload.comment) {
            normalized.comment = {
                body: payload.comment.body,
                author: payload.comment.user?.login || 'unknown',
                url: payload.comment.html_url,
            };
        }

        if (payload.label) {
            normalized.label = payload.label.name;
        }
    }
}
