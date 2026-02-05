/**
 * Action Executor
 *
 * Executes configured actions (shell scripts, JavaScript code, etc.).
 * Integrates with job queue for persistent, concurrent execution.
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PromptRegistry } from '../agent/prompts/registry.js';
import { GitHubRepositoryManager } from '../github/repository-manager.js';
import { createActionLogger, getLogger, type Logger } from '../logging/logger.js';
import type { ActionConfig, ActionConfigurations, LoggingConfig } from '../types/actions.js';
import type { VertexConfig } from '../types/agent.js';
import type { ConfigData, VertexAISafety } from '../types/config.js';
import type { Event } from '../types/events.js';
import type { ActionExecutorInterface } from './executors/action-executor-interface';
import { AIAgentActionExecutor } from './executors/ai-agent-action-executor.js';
import { JavaScriptActionExecutor } from './executors/javascript-action-executor.js';
import { ShellActionExecutor } from './executors/shell-action-executor.js';

// Forward declarations for types imported from other modules
// (avoiding circular dependencies)
interface JobQueue {
    onJobReady?: (jobId: number, actionName: string, event: Event) => Promise<void>;
    enqueue(actionName: string, event: Event): void;
    resetToPending(jobId: number): void;
    markCompleted(jobId: number, logFile: string): void;
    markFailed(jobId: number, errorMessage: string, logFile: string | null): void;
}

interface WorkDirectoryManager {
    getWorkDirForEvent(event: Event): string;
    acquireLock(workDir: string, jobId: number): void;
    releaseLock(workDir: string, jobId: number): void;
    ensureWorkDir(workDir: string): Promise<void>;
    getRepositoryDir(workDir: string): string;
}

export class ActionExecutor {
    private actions: ActionConfigurations;
    private jobQueue: JobQueue;
    private workDirManager: WorkDirectoryManager;
    private repositoryManager: GitHubRepositoryManager;
    private logsBasePath: string;
    private dryRun: boolean;
    private vertexConfig: VertexConfig | null;
    private safetyConfig: VertexAISafety;
    private githubToken: string;
    private promptRegistry: PromptRegistry;
    private shellExecutor: ShellActionExecutor;
    private javascriptExecutor: JavaScriptActionExecutor;
    private aiAgentExecutor: AIAgentActionExecutor;

    /**
     * Creates a new ActionExecutor instance
     *
     * @param actions Action configurations
     * @param jobQueue Job queue instance
     * @param workDirManager Work directory manager instance
     * @param loggingConfig Logging configuration
     * @param dryRun Whether to run in dry-run mode (log but don't execute)
     * @param config Full configuration (for Vertex AI settings)
     * @param promptRegistry Prompt registry for AI agent prompts
     */
    constructor(
        actions: ActionConfigurations,
        jobQueue: JobQueue,
        workDirManager: WorkDirectoryManager,
        loggingConfig: LoggingConfig,
        dryRun: boolean = false,
        config?: ConfigData,
        promptRegistry?: PromptRegistry,
    ) {
        this.actions = actions || {};
        this.jobQueue = jobQueue;
        this.workDirManager = workDirManager;
        this.logsBasePath = resolve(process.cwd(), loggingConfig?.basePath || './data/logs');
        this.dryRun = dryRun;
        this.vertexConfig = config?.vertexAI || null;
        this.safetyConfig = config?.vertexAI?.safety || {};
        this.githubToken = config?.github?.token || process.env.GITHUB_TOKEN || '';
        this.promptRegistry = promptRegistry || new PromptRegistry();

        // Initialize GitHub repository manager
        if (!config?.github) {
            throw new Error('GitHub configuration is required');
        }
        this.repositoryManager = new GitHubRepositoryManager(config.github);

        // Initialize executor instances
        this.shellExecutor = new ShellActionExecutor(workDirManager, this.repositoryManager);
        this.javascriptExecutor = new JavaScriptActionExecutor();

        // AI Agent executor requires Vertex AI configuration
        if (this.vertexConfig) {
            this.aiAgentExecutor = new AIAgentActionExecutor(
                workDirManager,
                this.repositoryManager,
                this.vertexConfig,
                this.safetyConfig,
                this.githubToken,
                this.promptRegistry,
                dryRun,
            );
        } else {
            throw new Error('AI Agent executor could not be created:  Vertex Config missing.');
        }

        // Set up the callback from job queue
        if (this.jobQueue) {
            this.jobQueue.onJobReady = (jobId, actionName, event) => this.executeJob(jobId, actionName, event);
        }
    }

    /**
     * Initializes the action executor
     */
    async initialize(): Promise<void> {
        // Create logs directory if it doesn't exist
        if (!existsSync(this.logsBasePath)) {
            await mkdir(this.logsBasePath, { recursive: true });
        }

        getLogger().debug('Action executor initialized', {
            logsPath: this.logsBasePath,
        });
        if (this.dryRun) {
            getLogger().warn('DRY RUN MODE: Actions will be logged but not executed');
        }
    }

    /**
     * Executes an action by enqueuing it
     *
     * @param actionName Name of the action to execute
     * @param event Event object that triggered the action
     */
    async execute(actionName: string, event: Event): Promise<void> {
        const action = this.actions[actionName];

        if (!action) {
            throw new Error(`Action "${actionName}" not found in configuration`);
        }

        // Enqueue the job for execution
        this.jobQueue.enqueue(actionName, event);
    }

    /**
     * Executes a job (called by job queue)
     *
     * @param jobId Job ID
     * @param actionName Name of the action to execute
     * @param event Event object
     */
    async executeJob(jobId: number, actionName: string, event: Event): Promise<void> {
        const action = this.actions[actionName];
        let logFile: string | null = null;
        let actionLogger: Logger | null = null;
        let workDir: string | null = null;
        let lockAcquired = false;

        try {
            // Get work directory for this event
            workDir = this.workDirManager.getWorkDirForEvent(event);

            // Try to acquire lock on work directory
            try {
                this.workDirManager.acquireLock(workDir, jobId);
                lockAcquired = true;
            } catch (_lockError) {
                // Lock is held by another job - reset to pending to retry later
                getLogger().debug('Job waiting for lock - will retry later', {
                    jobId,
                    workDir,
                });
                this.jobQueue.resetToPending(jobId);
                return;
            }

            // Create log file and action logger
            const { logFilePath, logger } = await this.createActionLogger(event, actionName, jobId);
            logFile = logFilePath;
            actionLogger = logger;

            // Log job start
            actionLogger.info(`=== Job ${jobId}: ${actionName} ===`);
            actionLogger.info('Job details', {
                eventType: event.type,
                repository: event.repository,
                workDir,
                mode: this.dryRun ? 'DRY RUN (action will not be executed)' : 'LIVE',
            });

            // Execute based on action type
            const executor: ActionExecutorInterface = this.createActionExecutor(action);
            if (this.dryRun) {
                await executor.executeDryRun(action, event, actionLogger);
            } else {
                await executor.execute(action, event, actionLogger);
            }

            // Log completion
            actionLogger.info('Job completed successfully', { status: 'SUCCESS' });

            // Flush logger before marking complete
            await actionLogger.flush();

            // Mark job as completed
            this.jobQueue.markCompleted(jobId, logFile);
        } catch (error) {
            // Log error
            if (actionLogger) {
                actionLogger.error('Job failed', error instanceof Error ? error : undefined, {
                    status: 'FAILED',
                });

                // Flush logger before marking failed
                await actionLogger.flush();
            }

            // Mark job as failed
            this.jobQueue.markFailed(jobId, (error as Error).message, logFile);
        } finally {
            // Release the lock only if we acquired it
            if (lockAcquired && workDir) {
                this.workDirManager.releaseLock(workDir, jobId);
            }
        }
    }

    /**
     * Creates an action logger for an action execution
     *
     * @param event Event object
     * @param actionName Action name
     * @param jobId Job ID
     * @returns Object with log file path and logger instance
     */
    async createActionLogger(
        event: Event,
        actionName: string,
        jobId: number,
    ): Promise<{ logFilePath: string; logger: Logger }> {
        const [owner, repo] = event.repository.split('/');
        const repoDir = join(this.logsBasePath, owner, repo);

        // Create repository log directory
        if (!existsSync(repoDir)) {
            await mkdir(repoDir, { recursive: true });
        }

        // Generate log filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const eventId = event.issue?.number
            ? `issue-${event.issue.number}`
            : event.pullRequest?.number
              ? `pr-${event.pullRequest.number}`
              : `event-${event.id}`;

        const filename = `${timestamp}_${eventId}_${actionName}.log`;
        const logPath = join(repoDir, filename);

        // Create action-specific logger
        const logger = createActionLogger(logPath);
        logger.info('Action logger created for:', {
            jobId,
            actionName,
            repository: event.repository,
            eventType: event.type,
            eventId: event.id,
        });

        return {
            logFilePath: logPath,
            logger,
        };
    }

    private createActionExecutor(action: ActionConfig): ActionExecutorInterface {
        switch (action.type) {
            case 'shell':
                return this.shellExecutor;
            case 'javascript':
                return this.javascriptExecutor;
            case 'ai-agent':
                return this.aiAgentExecutor;
            default:
                throw new Error(`Unknown action type: ${JSON.stringify(action)}`);
        }
    }
}
