/**
 * Vertex AI Client Wrapper
 *
 * Provides a clean interface to Google Cloud Vertex AI for accessing Claude models.
 * Handles authentication, request formatting, and error handling.
 */

import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import type { Logger } from '@axiom/common';
import type { CreateMessageParams, MessageResponse, VertexConfig, VertexInfo } from '../types/agent.js';

export class VertexClient {
    private projectId: string;
    private region: string;
    private defaultModel: string;
    private client: AnthropicVertex;
    private logger: Logger;

    /**
     * Creates a new VertexClient instance
     *
     * @param config Configuration object
     * @param logger The logger to use
     */
    constructor(config: VertexConfig, logger: Logger) {
        this.projectId = config.projectId;
        this.region = config.region || 'us-east5';
        this.defaultModel = config.model || 'claude-sonnet-4-5@20250929';
        this.logger = logger;

        // Create the Anthropic Vertex client
        this.client = new AnthropicVertex({
            projectId: this.projectId,
            region: this.region,
        });

        this.logger.info(
            `VertexClient initialized: project=${this.projectId}, region=${this.region}, model=${this.defaultModel}`,
        );
    }

    /**
     * Creates a message with the model
     *
     * @param params Message parameters
     * @returns API response
     */
    async createMessage(params: CreateMessageParams): Promise<MessageResponse> {
        const request: any = {
            ...params,
            model: params.model || this.defaultModel,
            max_tokens: params.max_tokens || 4096,
        };

        try {
            const response = await this.client.messages.create(request);
            return response as MessageResponse;
        } catch (error) {
            // Enhance error with context
            const enhancedError: any = new Error(`Vertex AI API call failed: ${(error as Error).message}`);
            enhancedError.originalError = error;
            enhancedError.projectId = this.projectId;
            enhancedError.region = this.region;
            enhancedError.model = request.model;

            throw enhancedError;
        }
    }

    /**
     * Gets information about the configured connection
     *
     * @returns Connection info
     */
    getInfo(): VertexInfo {
        return {
            projectId: this.projectId,
            region: this.region,
            model: this.defaultModel,
        };
    }
}
