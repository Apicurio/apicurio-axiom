/**
 * Conversation Manager
 *
 * Manages the message history for an agent conversation.
 * Handles adding user messages, assistant responses, and tool results.
 */

import type { Message, MessageContent, MessageResponse } from '../types/agent.js';

export class Conversation {
    private systemPrompt: string;
    private messages: Message[];
    private complete: boolean;
    private result: MessageResponse | null;

    /**
     * Creates a new Conversation instance
     *
     * @param systemPrompt System prompt to set context
     * @param userGoal Initial user goal/task
     */
    constructor(systemPrompt: string, userGoal: string) {
        this.systemPrompt = systemPrompt;
        this.messages = [];
        this.complete = false;
        this.result = null;

        // Add initial user message with the goal
        this.addUserMessage(userGoal);
    }

    /**
     * Adds a user message to the conversation
     *
     * @param content Message content
     */
    addUserMessage(content: string): void {
        this.messages.push({
            role: 'user',
            content: content,
        });
    }

    /**
     * Adds an assistant message to the conversation
     *
     * @param response API response from the AI assistant
     */
    addAssistantMessage(response: MessageResponse): void {
        this.messages.push({
            role: 'assistant',
            content: response.content,
        });
    }

    /**
     * Adds tool results to the conversation
     *
     * @param toolUseId Tool use ID from the assistant's message
     * @param result Tool execution result
     */
    addToolResult(toolUseId: string, result: any): void {
        // Find the last user message or create a new one
        const lastMessage = this.messages[this.messages.length - 1];

        // Tool results go in a user message
        const toolResultContent: MessageContent = {
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: JSON.stringify(result, null, 2),
        };

        // If the last message is already a user message with tool results, append to it
        if (lastMessage && lastMessage.role === 'user' && Array.isArray(lastMessage.content)) {
            (lastMessage.content as MessageContent[]).push(toolResultContent);
        } else {
            // Otherwise create a new user message with the tool result
            this.messages.push({
                role: 'user',
                content: [toolResultContent],
            });
        }
    }

    /**
     * Gets all messages for API calls
     *
     * @returns Array of message objects
     */
    getMessages(): Message[] {
        return this.messages;
    }

    /**
     * Gets the system prompt
     *
     * @returns System prompt
     */
    getSystemPrompt(): string {
        return this.systemPrompt;
    }

    /**
     * Marks the conversation as complete
     *
     * @param finalResponse Final response from the assistant
     */
    markComplete(finalResponse: MessageResponse): void {
        this.complete = true;
        this.result = finalResponse;
    }

    /**
     * Checks if the conversation is complete
     *
     * @returns True if complete
     */
    isComplete(): boolean {
        return this.complete;
    }

    /**
     * Gets the final result
     *
     * @returns Final result or null if not complete
     */
    getResult(): MessageResponse | null {
        return this.result;
    }

    /**
     * Gets the number of messages in the conversation
     *
     * @returns Message count
     */
    getMessageCount(): number {
        return this.messages.length;
    }

    /**
     * Extracts text content from the final result
     *
     * @returns Text content or null
     */
    getFinalText(): string | null {
        if (!this.result || !this.result.content) {
            return null;
        }

        // Find text content blocks
        const textBlocks = this.result.content.filter((block) => block.type === 'text');
        return textBlocks.map((block) => block.text).join('\n');
    }
}
