/**
 * Shell Action Executor
 *
 * Executes shell command actions using PTY for real-time output.
 */

import { resolve } from 'node:path';
import * as pty from 'node-pty';
import type { GitHubRepositoryManager } from '../../github/repository-manager.js';
import type { Logger } from '@axiom/common';
import type { ActionConfig, ShellAction } from '../../types/actions.js';
import type { Event } from '../../types/events.js';
import type { ActionExecutorInterface } from './action-executor-interface.js';

interface WorkDirectoryManager {
    getWorkDirForEvent(event: Event): string;
    ensureWorkDir(workDir: string): Promise<void>;
    getRepositoryDir(workDir: string): string;
}

export class ShellActionExecutor implements ActionExecutorInterface {
    private workDirManager: WorkDirectoryManager;
    private repositoryManager: GitHubRepositoryManager;

    constructor(workDirManager: WorkDirectoryManager, repositoryManager: GitHubRepositoryManager) {
        this.workDirManager = workDirManager;
        this.repositoryManager = repositoryManager;
    }

    /**
     * Executes a shell command action
     *
     * @param action Action configuration
     * @param event Event object
     * @param actionLogger Action logger instance
     */
    async execute(action: ActionConfig, event: Event, actionLogger: Logger): Promise<void> {
        if (action.type !== 'shell') {
            throw new Error('Invalid action type for ShellActionExecutor');
        }

        const command = action.command;

        if (!command) {
            throw new Error('Shell action missing "command" field');
        }

        // Get or create work directory
        const workDir = this.workDirManager.getWorkDirForEvent(event);
        await this.workDirManager.ensureWorkDir(workDir);

        // Ensure repository is cloned
        const repoDir = this.workDirManager.getRepositoryDir(workDir);
        const repository = this.repositoryManager.getRepository(repoDir, event.repository);
        await repository.ensureCloned();

        // Prepare environment variables from event data
        const env = this.buildEnvironment(event, workDir);

        actionLogger.info('Executing shell command', { command, workDir });
        actionLogger.info('--- Command Output ---');

        return new Promise((resolve, reject) => {
            // Spawn the shell command with PTY
            const ptyProcess = pty.spawn('bash', ['-c', command], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: process.cwd(),
                env: { ...process.env, ...env } as { [key: string]: string },
            });

            // Stream output to actionLogger in real-time
            ptyProcess.onData((data) => {
                const output = data.toString().trimEnd();
                if (output) {
                    actionLogger.info(output);
                }
            });

            // Handle process exit
            ptyProcess.onExit(({ exitCode, signal }) => {
                actionLogger.info('--- End of Command Output ---');
                if (exitCode === 0) {
                    actionLogger.info('Shell command completed successfully', { exitCode });
                    resolve();
                } else {
                    const errorMsg = signal
                        ? `Shell command terminated by signal ${signal}`
                        : `Shell command exited with code ${exitCode}`;
                    const error = new Error(errorMsg);
                    actionLogger.error(errorMsg, error, { exitCode, signal });
                    reject(error);
                }
            });
        });
    }

    async executeDryRun(action: ActionConfig, event: Event, actionLogger: Logger): Promise<void> {
        const workDir = this.workDirManager.getWorkDirForEvent(event);
        await this.workDirManager.ensureWorkDir(workDir);

        // Ensure repository is cloned
        const repoDir = this.workDirManager.getRepositoryDir(workDir);
        const repository = this.repositoryManager.getRepository(repoDir, event.repository);
        await repository.ensureCloned();

        actionLogger.info('--- DRY RUN: Action would be executed as follows ---');
        actionLogger.info('Dry run configuration', { actionType: action.type });
        actionLogger.info('Shell action details', {
            command: (action as ShellAction).command,
            workDir,
        });

        const env = this.buildEnvironment(event, workDir);
        const customEnvVars: Record<string, string> = {};
        for (const [key, value] of Object.entries(env)) {
            // Only log custom environment variables (not inherited from process.env)
            if (!process.env[key] || process.env[key] !== value) {
                customEnvVars[key] = value;
            }
        }
        if (Object.keys(customEnvVars).length > 0) {
            actionLogger.info('Custom environment variables', customEnvVars);
        }

        actionLogger.info('--- End of dry run information ---');
    }

    /**
     * Builds environment variables from event data
     *
     * These can be used in shell scripts
     *
     * @param event Event object
     * @param workDir Work directory path
     * @returns Environment variables
     */
    private buildEnvironment(event: Event, workDir: string): Record<string, string> {
        const env: Record<string, string> = {
            EVENT_ID: String(event.id),
            EVENT_TYPE: event.type,
            EVENT_REPOSITORY: event.repository,
            EVENT_REPOSITORY_OWNER: event.repositoryOwner,
            EVENT_REPOSITORY_NAME: event.repositoryName,
            EVENT_ACTOR: event.actor,
            EVENT_CREATED_AT: event.createdAt,
            WORK_DIR: workDir,
            CLAUDE_BOT_HELPERS: resolve(process.cwd(), 'actions/claude-code/helpers'),
        };

        // Add issue-specific variables
        if (event.issue) {
            env.EVENT_ISSUE_NUMBER = String(event.issue.number);
            env.EVENT_ISSUE_TITLE = event.issue.title;
            env.EVENT_ISSUE_STATE = event.issue.state;
            env.EVENT_ISSUE_LABELS = event.issue.labels.join(',');
            env.EVENT_ISSUE_AUTHOR = event.issue.author;
            env.EVENT_ISSUE_URL = event.issue.url;
        }

        // Add PR-specific variables
        if (event.pullRequest) {
            env.EVENT_PR_NUMBER = String(event.pullRequest.number);
            env.EVENT_PR_TITLE = event.pullRequest.title;
            env.EVENT_PR_STATE = event.pullRequest.state;
            env.EVENT_PR_LABELS = event.pullRequest.labels.join(',');
            env.EVENT_PR_AUTHOR = event.pullRequest.author;
            env.EVENT_PR_URL = event.pullRequest.url;
            env.EVENT_PR_DRAFT = String(event.pullRequest.draft);
        }

        // Add comment-specific variables
        if (event.comment) {
            env.EVENT_COMMENT_AUTHOR = event.comment.author;
            env.EVENT_COMMENT_URL = event.comment.url;
            env.EVENT_COMMENT_BODY = event.comment.body;
        }

        // Add label-specific variable
        if (event.label) {
            env.EVENT_LABEL = event.label;
        }

        return env;
    }
}
