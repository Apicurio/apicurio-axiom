/**
 * SearchWebTool - Perform web search and return ranked results
 *
 * This tool performs web searches using DuckDuckGo (default) or other search engines
 * and returns ranked results with titles, URLs, and snippets. Useful for finding
 * information, documentation, and resources on the web.
 */

import { SafeSearchType, search } from 'duck-duck-scrape';
import type { Tool, ToolContext } from '../../../types/agent.js';

/**
 * Extract domain from URL
 *
 * @param url URL to extract domain from
 * @returns Domain name
 */
function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return url;
    }
}

export const SearchWebTool: Tool = {
    name: 'web_read-search_web',
    description:
        'Perform web search using DuckDuckGo and return ranked results with titles, URLs, and snippets. Useful for finding information, documentation, and resources.',
    input_schema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query',
                minLength: 1,
                maxLength: 500,
            },
            engine: {
                type: 'string',
                enum: ['google', 'bing', 'duckduckgo'],
                description: 'Search engine to use (only duckduckgo currently supported)',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of results to return',
                minimum: 1,
                maximum: 50,
            },
            language: {
                type: 'string',
                description: 'Language code (e.g., "en", "es")',
            },
            safe_search: {
                type: 'boolean',
                description: 'Enable safe search filtering',
            },
        },
        required: ['query'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Result or error
     */
    async execute(
        input: {
            query: string;
            engine?: 'google' | 'bing' | 'duckduckgo';
            max_results?: number;
            language?: string;
            safe_search?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        const startTime = Date.now();

        try {
            // Validate input
            if (typeof input.query !== 'string') {
                return {
                    error: true,
                    message: 'query parameter is required and must be a string',
                    tool: this.name,
                };
            }

            // Validate query length
            if (input.query.length === 0) {
                return {
                    error: true,
                    message: 'query must not be empty',
                    tool: this.name,
                };
            }

            if (input.query.length > 500) {
                return {
                    error: true,
                    message: 'query must not exceed 500 characters',
                    tool: this.name,
                };
            }

            // Set defaults
            const engine = input.engine || 'duckduckgo';
            const maxResults = input.max_results !== undefined ? input.max_results : 10;
            const safeSearch = input.safe_search !== false; // default true

            // Validate max_results
            if (maxResults < 1 || maxResults > 50) {
                return {
                    error: true,
                    message: 'max_results must be between 1 and 50',
                    tool: this.name,
                };
            }

            // Check if engine is supported
            if (engine !== 'duckduckgo') {
                return {
                    error: true,
                    message: `Search engine '${engine}' requires API keys (not yet implemented). Please use 'duckduckgo' engine.`,
                    tool: this.name,
                };
            }

            context.logger.info(`Searching web: "${input.query}" (engine: ${engine}, max: ${maxResults})`);

            // Perform DuckDuckGo search
            const safeSearchMode: SafeSearchType = safeSearch ? SafeSearchType.STRICT : SafeSearchType.OFF;

            const searchResults = await search(input.query, {
                safeSearch: safeSearchMode,
                // DuckDuckGo doesn't have explicit language parameter in this library
                // Results are influenced by query language
            });

            // Process and format results
            const results = searchResults.results.slice(0, maxResults).map((result, index) => ({
                title: result.title,
                url: result.url,
                snippet: result.description || '',
                rank: index + 1,
                domain: extractDomain(result.url),
            }));

            const searchTime = Date.now() - startTime;

            context.logger.info(`Search completed: ${results.length} results in ${searchTime}ms`);

            return {
                success: true,
                query: input.query,
                engine,
                results,
                search_time: searchTime,
                total_results: searchResults.noResults ? 0 : results.length,
            };
        } catch (error: any) {
            const searchTime = Date.now() - startTime;

            context.logger.error(`Error in web_read-search_web: ${error.message}`);

            // Handle specific errors
            if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
                return {
                    error: true,
                    message: 'Search request timed out',
                    tool: this.name,
                    search_time: searchTime,
                };
            }

            if (error.message?.includes('rate limit') || error.response?.status === 429) {
                return {
                    error: true,
                    message: 'Rate limit exceeded for search engine',
                    tool: this.name,
                    search_time: searchTime,
                };
            }

            return {
                error: true,
                message: `Failed to perform web search: ${error.message}`,
                tool: this.name,
                search_time: searchTime,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     *
     * For read-only tools like this, mock execution performs the actual search
     * since it doesn't modify any state.
     */
    async executeMock(
        input: {
            query: string;
            engine?: 'google' | 'bing' | 'duckduckgo';
            max_results?: number;
            language?: string;
            safe_search?: boolean;
        },
        context: ToolContext,
    ): Promise<any> {
        // For read-only operations, execute normally
        return this.execute(input, context);
    },
};
