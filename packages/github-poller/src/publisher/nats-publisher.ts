/**
 * NATS Publisher
 *
 * Publishes normalized events to NATS JetStream.
 */

import { connect, type NatsConnection, type JetStreamClient } from 'nats';
import type { Event, NatsEventMessage } from '@axiom/common';
import type { Logger } from '../logging/logger.js';

export interface NatsPublisherConfig {
    url: string;
    maxReconnectAttempts?: number;
    reconnectTimeWait?: number;
}

export class NatsPublisher {
    private nc: NatsConnection | null = null;
    private js: JetStreamClient | null = null;
    private config: NatsPublisherConfig;
    private logger: Logger;
    private isConnected: boolean = false;

    /**
     * Creates a new NatsPublisher
     *
     * @param config NATS connection configuration
     * @param logger Logger instance
     */
    constructor(config: NatsPublisherConfig, logger: Logger) {
        this.config = config;
        this.logger = logger;
    }

    /**
     * Connects to NATS server and initializes JetStream
     */
    async connect(): Promise<void> {
        if (this.isConnected) {
            this.logger.warn('Already connected to NATS');
            return;
        }

        try {
            this.logger.info('Connecting to NATS...', { url: this.config.url });

            this.nc = await connect({
                servers: this.config.url,
                maxReconnectAttempts: this.config.maxReconnectAttempts ?? -1,
                reconnectTimeWait: this.config.reconnectTimeWait ?? 2000,
            });

            this.js = this.nc.jetstream();
            this.isConnected = true;

            this.logger.info('Connected to NATS successfully', {
                url: this.config.url,
            });

            // Set up connection event handlers
            (async () => {
                for await (const status of this.nc!.status()) {
                    this.logger.info('NATS connection status', {
                        type: status.type,
                        data: status.data,
                    });
                }
            })();
        } catch (error) {
            this.logger.error('Failed to connect to NATS', error as Error);
            throw error;
        }
    }

    /**
     * Disconnects from NATS server
     */
    async disconnect(): Promise<void> {
        if (!this.isConnected || !this.nc) {
            return;
        }

        this.logger.info('Disconnecting from NATS...');

        try {
            await this.nc.drain();
            await this.nc.close();

            this.nc = null;
            this.js = null;
            this.isConnected = false;

            this.logger.info('Disconnected from NATS');
        } catch (error) {
            this.logger.error('Error disconnecting from NATS', error as Error);
            throw error;
        }
    }

    /**
     * Publishes an event to NATS
     *
     * @param event Normalized event to publish
     */
    async publish(event: Event): Promise<void> {
        if (!this.isConnected || !this.js) {
            throw new Error('Not connected to NATS. Call connect() first.');
        }

        const subject = this.buildSubject(event);
        const message = this.buildMessage(event);

        try {
            this.logger.debug('Publishing event to NATS', {
                subject,
                eventId: event.id,
                eventType: event.type,
            });

            await this.js.publish(subject, JSON.stringify(message));

            this.logger.debug('Event published successfully', {
                subject,
                eventId: event.id,
            });
        } catch (error) {
            this.logger.error('Failed to publish event to NATS', error as Error, {
                subject,
                eventId: event.id,
                eventType: event.type,
            });
            throw error;
        }
    }

    /**
     * Builds the NATS subject for an event
     *
     * Subject pattern: events.{source}.{owner}.{repo}.{eventType}
     *
     * @param event Event object
     * @returns NATS subject string
     */
    private buildSubject(event: Event): string {
        // Replace dots in event type with hyphens to avoid subject hierarchy issues
        const eventType = event.type.replace(/\./g, '-');

        return `events.github.${event.repositoryOwner}.${event.repositoryName}.${eventType}`;
    }

    /**
     * Builds the NATS message wrapper
     *
     * @param event Event object
     * @returns NATS event message
     */
    private buildMessage(event: Event): NatsEventMessage {
        return {
            schema_version: '1.0.0',
            schema_id: 'event.schema.json',
            source: 'github',
            timestamp: new Date().toISOString(),
            event,
        };
    }

    /**
     * Returns connection status
     */
    get connected(): boolean {
        return this.isConnected;
    }
}
