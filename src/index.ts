/**
 * Apicurio Axiom - Main Entry Point
 *
 * A GitHub automation system that monitors repositories for events and triggers configured actions.
 */

import { Octokit } from '@octokit/rest';
import type Database from 'better-sqlite3';
import packageJson from '../package.json' with { type: 'json' };
import { ActionExecutor } from './actions/action-executor.js';
import { PromptRegistry } from './agent/prompts/registry.js';
import { listAvailableTools } from './agent/tools/builder.js';
import { loadConfig, validateConfigAdvanced } from './config/config-loader.js';
import { EventProcessor } from './events/event-processor.js';
import { getAuthenticatedUser } from './github/client.js';
import { getCurrentUser, setCurrentUser } from './github/current-user.js';
import { validateRepositoryForks } from './github/fork-validator.js';
import { GitHubPoller } from './github/poller.js';
import { LogManager } from './logging/log-manager.js';
import { initializeLogger } from './logging/logger.js';
import { JobQueue } from './queue/job-queue.js';
import { WorkDirectoryManager } from './queue/work-directory-manager.js';
import { StateManager } from './state/state-manager.js';
import type { CurrentGitHubUser } from './types/github-user.js';
import { EventValidator } from './validation/event-validator.js';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
    let stateManager: StateManager | null = null;
    let jobQueue: JobQueue | null = null;
    let workDirManager: WorkDirectoryManager | null = null;
    let logManager: LogManager | null = null;
    let poller: GitHubPoller | null = null;

    try {
        // Parse command line arguments
        const args: string[] = process.argv.slice(2);
        const dryRun: boolean = args.includes('--dryRun');
        const listTools: boolean = args.includes('--listTools');

        // Parse --config argument
        let configPath: string | undefined;
        const configIndex = args.indexOf('--config');
        if (configIndex !== -1 && configIndex + 1 < args.length) {
            configPath = args[configIndex + 1];
        }

        // Handle --listTools command
        if (listTools) {
            listAvailableTools();
            process.exit(0);
        }

        // Load configuration (before logger to get logging config)
        const config = await loadConfig(configPath);

        // Initialize logger with configuration
        const logger = initializeLogger({
            level: (config.logging?.level as any) || 'info',
            prettyPrint: config.logging?.prettyPrint !== false,
        });

        logger.info('Apicurio Axiom starting...', {
            dryRun,
            repositories: config.repositories.length,
            pollInterval: config.github.pollInterval,
        });

        if (dryRun) {
            logger.warn('DRY RUN MODE: Actions will be logged but not executed');
        }

        // Get authenticated GitHub user information
        logger.debug('Fetching authenticated GitHub user information...');
        let githubUser: CurrentGitHubUser;
        try {
            githubUser = await getAuthenticatedUser(config.github.token);

            // Store current user for access throughout the application
            setCurrentUser(githubUser);
        } catch (_error: unknown) {
            throw new Error('Unable to authenticate with GitHub. Please check your GITHUB_TOKEN.');
        }

        // Validate repository forks
        logger.debug('Validating repository forks...');
        const octokit = new Octokit({ auth: config.github.token });
        await validateRepositoryForks(octokit, githubUser, config.repositories);

        // Initialize log manager
        logManager = new LogManager(config.logging || {});
        await logManager.initialize();

        // Initialize state manager and database
        stateManager = new StateManager(config.state || {});
        await stateManager.initialize();

        // Initialize work directory manager
        workDirManager = new WorkDirectoryManager(config.workDirectory || {});
        await workDirManager.initialize();

        // Initialize job queue (pass workDirManager for lock checking)
        // After initialize(), db is guaranteed to be non-null
        jobQueue = new JobQueue(stateManager.db as Database.Database, config.queue || {}, workDirManager);
        await jobQueue.initialize();

        // Initialize prompt registry
        const promptsDir = config.prompts?.basePath || './prompts';
        const systemTemplate = config.prompts?.systemTemplate || 'system';
        const promptRegistry = new PromptRegistry(promptsDir, systemTemplate);
        const promptNames = await promptRegistry.getPromptNames();
        logger.info(
            `Prompt registry initialized with ${promptNames.length} prompts from ${promptsDir} (system template: ${systemTemplate})`,
        );

        // Initialize event validator
        const eventValidator = new EventValidator();
        logger.info('Event validator initialized');
        // Run advanced configuration validation
        logger.debug('Running advanced configuration validation...');
        await validateConfigAdvanced(config, {
            skipRepositoryAccess: dryRun, // Skip in dry-run to avoid API calls
            availablePrompts: new Set(promptNames),
        });
        logger.info('Configuration validation passed');

        // Initialize action executor
        const actionExecutor = new ActionExecutor(
            config.actions,
            jobQueue,
            workDirManager,
            config.logging || {},
            dryRun,
            config,
            promptRegistry,
        );
        await actionExecutor.initialize();

        // Initialize event processor
        const eventProcessor = new EventProcessor(config.eventMappings, actionExecutor);

        // Initialize poller
        const ignoreEventsBeforeStart = config.github.ignoreEventsBeforeStart !== false; // Default to true
        poller = new GitHubPoller(
            config.github.token,
            config.repositories,
            config.github.pollInterval,
            stateManager,
            eventProcessor,
            eventValidator,
            ignoreEventsBeforeStart,
            config.logging || {},
        );

        // Start queue processing
        jobQueue.startProcessing();

        // Start work directory monitoring
        workDirManager.startMonitoring();

        // Start log cleanup monitoring
        logManager.startMonitoring();

        // Start polling
        await poller.start();

        // Display startup banner with user info
        const currentUser = getCurrentUser();
        logger.info('------------------------------------------------------');
        logger.info('░█▀█░█▀█░▀█▀░█▀▀░█░█░█▀▄░▀█▀░█▀█░░░█▀█░█░█░▀█▀░█▀█░█▄█');
        logger.info('░█▀█░█▀▀░░█░░█░░░█░█░█▀▄░░█░░█░█░░░█▀█░▄▀▄░░█░░█░█░█░█');
        logger.info('░▀░▀░▀░░░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░░░▀░▀░▀░▀░▀▀▀░▀▀▀░▀░▀');
        logger.info(`Version: ${packageJson.version}`);
        logger.info('Running as:');
        logger.info(`  User: ${currentUser?.login}${currentUser?.name ? ` (${currentUser?.name})` : ''}`);
        logger.info(`  Type: ${currentUser?.type}`);
        logger.info(`  Profile: ${currentUser?.html_url}`);
        logger.info('Apicurio Axiom is running. Press Ctrl+C to stop.');
        logger.info('------------------------------------------------------');

        // Handle graceful shutdown
        const shutdown = async (): Promise<void> => {
            logger.info('Shutting down gracefully...');

            // Stop polling
            if (poller) {
                await poller.stop();
            }

            // Stop queue processing
            if (jobQueue) {
                jobQueue.stopProcessing();
            }

            // Stop work directory monitoring
            if (workDirManager) {
                workDirManager.stopMonitoring();
            }

            // Stop log cleanup monitoring
            if (logManager) {
                logManager.stopMonitoring();
            }

            // Close database
            if (stateManager) {
                stateManager.close();
            }

            logger.info('Shutdown complete');
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (error: unknown) {
        // Display human-readable error to console
        console.error('');
        console.error('═'.repeat(80));
        console.error('ERROR: Failed to start bot');
        console.error('═'.repeat(80));
        console.error('');

        if (error instanceof Error) {
            console.error((error as Error).message);

            // Show stack trace in debug mode
            if (process.env.DEBUG) {
                console.error('');
                console.error('Stack trace:');
                console.error((error as Error).stack);
            }
        } else {
            console.error(String(error));
        }

        console.error('');
        console.error('═'.repeat(80));
        console.error('');

        // Cleanup on error
        if (jobQueue) {
            jobQueue.stopProcessing();
        }
        if (workDirManager) {
            workDirManager.stopMonitoring();
        }
        if (logManager) {
            logManager.stopMonitoring();
        }
        if (stateManager) {
            stateManager.close();
        }

        process.exit(1);
    }
}

main();
