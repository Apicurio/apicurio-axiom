/**
 * Prompt Registry
 *
 * Manages AI agent prompts using Handlebars templates.
 * Prompts are loaded on-demand from template files and combined with the base prompt.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import { getLogger, type Logger } from '../../logging/logger.js';
import type { Event } from '../../types/events.js';

export interface RenderedPrompts {
    systemPrompt: string;
    actionPrompt: string;
}

export class PromptRegistry {
    private promptsDir: string;
    private systemTemplate: string;
    private logger: Logger;

    /**
     * Creates a new PromptRegistry
     *
     * @param promptsDir Directory containing prompt template files (defaults to './prompts')
     * @param systemTemplate Name of the system prompt template (defaults to 'system')
     */
    constructor(promptsDir: string = './prompts', systemTemplate: string = 'system') {
        this.promptsDir = promptsDir;
        this.systemTemplate = systemTemplate;
        this.logger = getLogger();
    }

    /**
     * Loads a prompt template by name
     *
     * @param name Prompt name (without .hbs extension)
     * @returns Raw template content
     */
    private async loadPromptTemplate(name: string): Promise<string> {
        const promptPath = join(this.promptsDir, `${name}.hbs`);
        try {
            return await fs.readFile(promptPath, 'utf-8');
        } catch (error) {
            throw new Error(`Prompt "${name}" not found at ${promptPath}: ${(error as Error).message}`);
        }
    }

    /**
     * Gets a prompt template by name (loads from filesystem)
     *
     * @param name Prompt name
     * @returns Prompt template string
     * @throws Error if prompt not found
     */
    async get(name: string): Promise<string> {
        return await this.loadPromptTemplate(name);
    }

    /**
     * Renders a prompt template with event data
     *
     * Returns both the system prompt and the action-specific prompt separately.
     *
     * @param name Action prompt name
     * @param event Event object
     * @returns Object containing rendered system and action prompts
     */
    async render(name: string, event: Event): Promise<RenderedPrompts> {
        // Load system prompt
        const systemPromptTemplate = await this.loadPromptTemplate(this.systemTemplate);

        // Load action-specific prompt template
        const actionPromptTemplate = await this.loadPromptTemplate(name);

        // Compile and render both with Handlebars
        const systemTemplate = Handlebars.compile(systemPromptTemplate);
        const actionTemplate = Handlebars.compile(actionPromptTemplate);

        return {
            systemPrompt: systemTemplate({ event }),
            actionPrompt: actionTemplate({ event }),
        };
    }

    /**
     * Lists all available prompt names by reading the prompts directory
     *
     * @returns Array of prompt names (without .hbs extension, excluding system template)
     */
    async getPromptNames(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.promptsDir);
            const systemTemplateFile = `${this.systemTemplate}.hbs`;
            return files
                .filter((file) => file.endsWith('.hbs') && file !== systemTemplateFile)
                .map((file) => file.replace(/\.hbs$/, ''))
                .sort();
        } catch (error) {
            this.logger.warn(`Failed to list prompts from ${this.promptsDir}: ${(error as Error).message}`);
            return [];
        }
    }

    /**
     * Checks if a prompt exists
     *
     * @param name Prompt name
     * @returns True if prompt exists
     */
    async has(name: string): Promise<boolean> {
        const promptPath = join(this.promptsDir, `${name}.hbs`);
        try {
            await fs.access(promptPath);
            return true;
        } catch {
            return false;
        }
    }
}
