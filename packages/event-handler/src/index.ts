/**
 * Apicurio Axiom Event Handler - Main Entry Point
 *
 * Consumes events from NATS and triggers configured actions.
 */

import { Octokit } from '@octokit/rest';
import type Database from 'better-sqlite3';
import { initializeLogger, LogManager } from '@axiom/common';
import { ActionExecutor } from './actions/action-executor.js';
import { PromptRegistry } from './agent/prompts/registry.js';
import { listAvailableTools } from './agent/tools/builder.js';
import { NatsConsumer } from './consumer/nats-consumer.js';
import { loadConfig, validateConfigAdvanced } from './config/config-loader.js';
import { EventProcessor } from './events/event-processor.js';
import { getAuthenticatedUser } from './github/client.js';
import { setCurrentUser } from './github/current-user.js';
import { validateRepositoryForks } from './github/fork-validator.js';
import { JobQueue } from './queue/job-queue.js';
import { WorkDirectoryManager } from './queue/work-directory-manager.js';
import { StateManager } from './state/state-manager.js';
import type { CurrentGitHubUser } from './types/github-user.js';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
    let stateManager: StateManager | null = null;
    let jobQueue: JobQueue | null = null;
    let workDirManager: WorkDirectoryManager | null = null;
    let logManager: LogManager | null = null;
    let natsConsumer: NatsConsumer | null = null;

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

        // Load configuration
        const config = await loadConfig(configPath);

        // Initialize logger with configuration
        const logger = await initializeLogger({
            level: (config.logging?.level as any) || 'info',
            prettyPrint: config.logging?.prettyPrint !== false,
            logToFile: config.logging?.logToFile,
            filePath: config.logging?.filePath,
        });

        logger.info('Apicurio Axiom Event Handler starting...', {
            dryRun,
            natsUrl: config.nats.url,
            consumerDurable: config.nats.consumerDurable,
        });

        if (dryRun) {
            logger.warn('DRY RUN MODE: Actions will be logged but not executed');
        }

        // Get authenticated GitHub user information
        logger.debug('Fetching authenticated GitHub user information...');
        let githubUser: CurrentGitHubUser;
        try {
            githubUser = await getAuthenticatedUser(config.github.token);
            setCurrentUser(githubUser);
        } catch (_error: unknown) {
            throw new Error('Unable to authenticate with GitHub. Please check your GITHUB_TOKEN.');
        }

        // Validate repository forks (if configured)
        if (config.repositories && config.repositories.length > 0) {
            logger.debug('Validating repository forks...');
            const octokit = new Octokit({ auth: config.github.token });
            await validateRepositoryForks(octokit, githubUser, config.repositories);
        }

        // Initialize log manager
        logManager = new LogManager(config.logging || {});
        await logManager.initialize();

        // Initialize state manager and database
        stateManager = new StateManager(config.state || {});
        await stateManager.initialize();

        // Initialize work directory manager
        workDirManager = new WorkDirectoryManager(config.workDirectory || {});
        await workDirManager.initialize();

        // Initialize job queue
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

        // Run advanced configuration validation
        logger.debug('Running advanced configuration validation...');
        await validateConfigAdvanced(config, {
            skipRepositoryAccess: dryRun,
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

        // Initialize NATS consumer
        natsConsumer = new NatsConsumer(
            {
                url: config.nats.url,
                consumerDurable: config.nats.consumerDurable,
                filterSubject: config.nats.filterSubject,
                maxReconnectAttempts: config.nats.maxReconnectAttempts,
            },
            eventProcessor,
        );

        // Start processing queue
        await jobQueue.startProcessing();
        logger.info('Job queue processing started');

        // Start work directory monitoring
        await workDirManager.startMonitoring();
        logger.info('Work directory monitoring started');

        // Start NATS consumer
        await natsConsumer.start();

        logger.info('Event Handler started successfully');

        // Handle graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down...');

            if (natsConsumer) {
                await natsConsumer.stop();
            }

            if (jobQueue) {
                await jobQueue.stopProcessing();
            }

            if (workDirManager) {
                await workDirManager.stopMonitoring();
            }

            if (stateManager) {
                stateManager.close();
            }

            logger.info('Shutdown complete');
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (error) {
        console.error('\n╔════════════════════════════════════════════════════════════════╗');
        console.error('║  ERROR: Failed to start Apicurio Axiom Event Handler          ║');
        console.error('╚════════════════════════════════════════════════════════════════╝\n');
        console.error((error as Error).message);
        console.error('');

        // Clean up on error
        if (stateManager) {
            stateManager.close();
        }

        process.exit(1);
    }
}

// Run the application
main();
