/**
 * NATS Consumer
 *
 * Consumes events from NATS JetStream and processes them.
 */

import { connect, type NatsConnection, type JetStreamClient, type Consumer, type JsMsg } from 'nats';
import type { Event, NatsEventMessage } from '@axiom/common';
import { getLogger, type Logger } from '@axiom/common';
import type { EventProcessor } from '../events/event-processor.js';

export interface NatsConsumerConfig {
    url: string;
    consumerDurable: string;
    filterSubject?: string;
    maxReconnectAttempts?: number;
}

export class NatsConsumer {
    private nc: NatsConnection | null = null;
    private js: JetStreamClient | null = null;
    private consumer: Consumer | null = null;
    private config: NatsConsumerConfig;
    private eventProcessor: EventProcessor;
    private logger: Logger;
    private isRunning: boolean = false;

    /**
     * Creates a new NatsConsumer
     *
     * @param config NATS connection configuration
     * @param eventProcessor Event processor instance
     */
    constructor(config: NatsConsumerConfig, eventProcessor: EventProcessor) {
        this.config = config;
        this.eventProcessor = eventProcessor;
        this.logger = getLogger();
    }

    /**
     * Starts consuming events from NATS
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Consumer is already running');
            return;
        }

        try {
            this.logger.info('Connecting to NATS...', { url: this.config.url });

            // Connect to NATS
            this.nc = await connect({
                servers: this.config.url,
                maxReconnectAttempts: this.config.maxReconnectAttempts ?? -1,
                reconnectTimeWait: 2000,
            });

            this.logger.info('Connected to NATS successfully');

            // Set up connection event handlers
            (async () => {
                for await (const status of this.nc!.status()) {
                    this.logger.info('NATS connection status', {
                        type: status.type,
                        data: status.data,
                    });
                }
            })();

            // Get JetStream context
            this.js = this.nc.jetstream();

            // Get the stream
            const stream = await this.js.streams.get('AXIOM_EVENTS');
            this.logger.info('Found AXIOM_EVENTS stream');

            // Get or create the durable consumer
            this.consumer = await stream.getConsumer(this.config.consumerDurable);
            this.logger.info('Using durable consumer', {
                consumer: this.config.consumerDurable,
            });

            // Start consuming messages
            this.isRunning = true;
            this.consumeMessages();

            this.logger.info('NATS consumer started successfully', {
                consumer: this.config.consumerDurable,
                filterSubject: this.config.filterSubject || 'events.>',
            });
        } catch (error) {
            this.logger.error('Failed to start NATS consumer', error as Error);
            throw error;
        }
    }

    /**
     * Stops consuming events
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.logger.info('Stopping NATS consumer...');
        this.isRunning = false;

        try {
            if (this.nc) {
                await this.nc.drain();
                await this.nc.close();
            }

            this.nc = null;
            this.js = null;
            this.consumer = null;

            this.logger.info('NATS consumer stopped');
        } catch (error) {
            this.logger.error('Error stopping NATS consumer', error as Error);
            throw error;
        }
    }

    /**
     * Consumes messages from NATS in a loop
     */
    private async consumeMessages(): Promise<void> {
        if (!this.consumer) {
            throw new Error('Consumer not initialized');
        }

        try {
            const messages = await this.consumer.consume();

            for await (const msg of messages) {
                if (!this.isRunning) {
                    break;
                }

                await this.handleMessage(msg);
            }
        } catch (error) {
            if (this.isRunning) {
                this.logger.error('Error consuming messages', error as Error);
                // Try to reconnect after a delay
                setTimeout(() => {
                    if (this.isRunning) {
                        this.consumeMessages();
                    }
                }, 5000);
            }
        }
    }

    /**
     * Handles a single message from NATS
     *
     * @param msg NATS message
     */
    private async handleMessage(msg: JsMsg): Promise<void> {
        try {
            // Transform NATS message to Event
            const event = this.transformMessage(msg);

            this.logger.debug('Received event from NATS', {
                eventId: event.id,
                eventType: event.type,
                repository: event.repository,
                subject: msg.subject,
            });

            // Process the event
            await this.eventProcessor.process(event);

            // Acknowledge successful processing
            msg.ack();

            this.logger.debug('Event processed successfully', {
                eventId: event.id,
                eventType: event.type,
            });
        } catch (error) {
            this.logger.error('Failed to process message', error as Error, {
                subject: msg.subject,
                seq: msg.seq,
            });

            // Negative acknowledge - will be redelivered
            msg.nak();
        }
    }

    /**
     * Transforms a NATS message to an Event object
     *
     * @param msg NATS message
     * @returns Event object
     */
    private transformMessage(msg: JsMsg): Event {
        try {
            const data: NatsEventMessage = JSON.parse(msg.data.toString());

            // Validate schema version
            if (data.schema_version !== '1.0.0') {
                throw new Error(`Unsupported schema version: ${data.schema_version}`);
            }

            // Extract the event from the wrapper
            return data.event;
        } catch (error) {
            this.logger.error('Failed to parse NATS message', error as Error, {
                subject: msg.subject,
            });
            throw error;
        }
    }

    /**
     * Returns connection status
     */
    get connected(): boolean {
        return this.isRunning && this.nc !== null;
    }
}
