/**
 * GitHub Poller for Apicurio Axiom
 *
 * Polls GitHub API for events and publishes them to NATS JetStream.
 */

import { resolve } from 'node:path';
import { EventValidator } from '@axiom/common';
import { loadConfig } from './config/config-loader.js';
import { initializeLogger } from './logging/logger.js';
import { NatsPublisher } from './publisher/nats-publisher.js';
import { GitHubPoller } from './poller/github-poller.js';
import { StateManager } from './state/state-manager.js';

/**
 * Main entry point
 */
async function main() {
    try {
        // Parse command line arguments
        const configPath = process.argv.find((arg) => arg.startsWith('--config='))?.split('=')[1] || './config.yaml';

        // Load configuration
        const config = await loadConfig(configPath);

        // Initialize logger
        const logger = initializeLogger({
            level: (config.logging?.level as any) || 'info',
            prettyPrint: config.logging?.prettyPrint !== false,
        });

        logger.info('Starting Axiom GitHub Poller...');

        // Validate configuration
        if (!config.github?.token) {
            throw new Error('GitHub token is required');
        }

        if (!config.repositories || config.repositories.length === 0) {
            throw new Error('At least one repository must be configured');
        }

        if (!config.nats?.url) {
            throw new Error('NATS URL is required');
        }

        // Initialize components
        logger.info('Initializing components...');

        // State manager for event deduplication
        const stateManager = new StateManager({
            basePath: resolve(process.cwd(), config.state?.basePath || './data/state'),
        });

        // Event validator
        const eventValidator = new EventValidator(logger);

        // NATS publisher
        const natsPublisher = new NatsPublisher(
            {
                url: config.nats.url,
                maxReconnectAttempts: config.nats.maxReconnectAttempts,
                reconnectTimeWait: config.nats.reconnectTimeWait,
            },
            logger,
        );

        // Connect to NATS
        await natsPublisher.connect();

        // GitHub poller
        const githubPoller = new GitHubPoller(
            {
                token: config.github.token,
                repositories: config.repositories,
                pollInterval: config.github.pollInterval || 60,
                ignoreEventsBeforeStart: config.github.ignoreEventsBeforeStart !== false,
                eventsLogPath: config.logging?.eventsPath,
            },
            stateManager,
            natsPublisher,
            eventValidator,
        );

        // Start polling
        await githubPoller.start();

        logger.info('GitHub Poller started successfully', {
            repositories: config.repositories,
            pollInterval: config.github.pollInterval || 60,
            natsUrl: config.nats.url,
        });

        // Handle graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down...');

            await githubPoller.stop();
            await natsPublisher.disconnect();

            logger.info('Shutdown complete');
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run the application
main();
