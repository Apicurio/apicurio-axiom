/**
 * Jira Poller for Apicurio Axiom
 *
 * Polls Jira API for issue updates and publishes them to NATS JetStream.
 */

import { resolve } from 'node:path';
import { EventValidator } from '@axiom/common';
import { loadConfig, validateConfigAdvanced } from './config/config-loader.js';
import { initializeLogger } from './logging/logger.js';
import { NatsPublisher } from './publisher/nats-publisher.js';
import { JiraPoller } from './poller/jira-poller.js';
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

        logger.info('Starting Axiom Jira Poller...');

        // Validate configuration
        await validateConfigAdvanced(config);

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

        // Jira poller
        const jiraPoller = new JiraPoller(
            {
                url: config.jira.url,
                username: config.jira.username,
                apiToken: config.jira.apiToken,
                projects: config.projects,
                pollInterval: config.jira.pollInterval || 120,
                eventsLogPath: config.logging?.eventsPath,
            },
            stateManager,
            natsPublisher,
            eventValidator,
        );

        // Start polling
        await jiraPoller.start();

        logger.info('Jira Poller started successfully', {
            projects: config.projects,
            pollInterval: config.jira.pollInterval || 120,
            natsUrl: config.nats.url,
        });

        // Handle graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down...');

            await jiraPoller.stop();
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
