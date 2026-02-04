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

export class PromptRegistry {
    private promptsDir: string;
    private logger: Logger;

    /**
     * Creates a new PromptRegistry
     *
     * @param promptsDir Directory containing prompt template files (defaults to './prompts')
     */
    constructor(promptsDir: string = './prompts') {
        this.promptsDir = promptsDir;
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
     * Combines the base prompt with the specific prompt and renders using Handlebars.
     *
     * @param name Prompt name
     * @param event Event object
     * @returns Rendered prompt string
     */
    async render(name: string, event: Event): Promise<string> {
        // Load base prompt
        const basePrompt = await this.loadPromptTemplate('base');

        // Load specific prompt template
        const promptTemplate = await this.loadPromptTemplate(name);

        // Combine base and specific prompt
        const combinedTemplate = `${basePrompt}\n\n${promptTemplate}`;

        // Compile and render with Handlebars
        // TODO cache the compiled handlebar template by SHA(combinedTemplate)?
        const template = Handlebars.compile(combinedTemplate);
        const rendered = template({ event });

        return rendered;
    }

    /**
     * Lists all available prompt names by reading the prompts directory
     *
     * @returns Array of prompt names (without .hbs extension, excluding base.hbs)
     */
    async getPromptNames(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.promptsDir);
            return files
                .filter((file) => file.endsWith('.hbs') && file !== 'base.hbs')
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
