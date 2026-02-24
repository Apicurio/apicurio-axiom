/**
 * FetchUrlTool - Fetch raw content from a URL with headers and metadata
 *
 * This tool fetches content from HTTP/HTTPS URLs with full control over headers,
 * timeouts, and redirects. It includes SSRF protection, size limits, and detailed
 * response metadata including status codes, headers, and redirect chains.
 */

import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import validator from 'validator';
import type { Tool, ToolContext } from '../../../types/agent.js';

/**
 * Check if an IP address is private or localhost (SSRF prevention)
 *
 * @param hostname Hostname or IP to check
 * @returns true if the hostname is private/localhost
 */
function isPrivateOrLocalhost(hostname: string): boolean {
    // Localhost variations
    if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '0.0.0.0' ||
        hostname.startsWith('127.')
    ) {
        return true;
    }

    // Private IP ranges (RFC 1918)
    const privateRanges = [
        /^10\./, // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
        /^192\.168\./, // 192.168.0.0/16
        /^169\.254\./, // Link-local
        /^fc00:/, // IPv6 private
        /^fe80:/, // IPv6 link-local
    ];

    return privateRanges.some((pattern) => pattern.test(hostname));
}

/**
 * Validate URL and check for SSRF risks
 *
 * @param url URL to validate
 * @returns Error message if invalid, null if valid
 */
function validateUrl(url: string): string | null {
    // First try to parse URL to check SSRF before full validation
    try {
        const parsedUrl = new URL(url);

        // Only allow HTTP and HTTPS
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return 'Invalid protocol. Only HTTP and HTTPS are allowed.';
        }

        // Check for SSRF (Server-Side Request Forgery) risks BEFORE full validation
        // This ensures we reject localhost/private IPs with appropriate error message
        if (isPrivateOrLocalhost(parsedUrl.hostname)) {
            return 'Access denied: Cannot fetch from localhost or private IP addresses (SSRF protection).';
        }
    } catch (error) {
        return `Invalid URL: ${(error as Error).message}`;
    }

    // Check if URL is valid HTTP/HTTPS
    if (!validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
        return 'Invalid URL format. Must be a valid HTTP or HTTPS URL.';
    }

    return null;
}

export const FetchUrlTool: Tool = {
    name: 'web_read-fetch_url',
    description:
        'Fetch raw content from a URL with full HTTP headers, status codes, and metadata. Supports custom headers, timeouts, and redirect tracking. Includes SSRF protection and size limits.',
    input_schema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL to fetch (must be valid HTTP/HTTPS URL)',
                pattern: '^https?://.+',
            },
            method: {
                type: 'string',
                enum: ['GET', 'POST', 'HEAD'],
                description: 'HTTP method to use',
            },
            headers: {
                type: 'object',
                description: 'Custom HTTP headers to include',
                additionalProperties: { type: 'string' },
            },
            timeout: {
                type: 'number',
                description: 'Request timeout in milliseconds',
                minimum: 1000,
                maximum: 120000,
            },
            follow_redirects: {
                type: 'boolean',
                description: 'Whether to follow HTTP redirects',
            },
            max_size: {
                type: 'number',
                description: 'Maximum response size in bytes (prevents large downloads)',
            },
        },
        required: ['url'],
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
            url: string;
            method?: 'GET' | 'POST' | 'HEAD';
            headers?: Record<string, string>;
            timeout?: number;
            follow_redirects?: boolean;
            max_size?: number;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate input
            if (!input.url || typeof input.url !== 'string') {
                return {
                    error: true,
                    message: 'url parameter is required and must be a string',
                    tool: this.name,
                };
            }

            // Validate URL and check SSRF
            const urlValidationError = validateUrl(input.url);
            if (urlValidationError) {
                return {
                    error: true,
                    message: urlValidationError,
                    tool: this.name,
                };
            }

            // Set defaults
            const method = input.method || 'GET';
            const timeout = input.timeout !== undefined ? input.timeout : 30000;
            const followRedirects = input.follow_redirects !== false; // default true
            const maxSize = input.max_size !== undefined ? input.max_size : 10485760; // 10MB default

            // Validate timeout range
            if (timeout < 1000 || timeout > 120000) {
                return {
                    error: true,
                    message: 'timeout must be between 1000 and 120000 milliseconds',
                    tool: this.name,
                };
            }

            context.logger.info(`Fetching URL: ${input.url} (method: ${method}, timeout: ${timeout}ms)`);

            // Track redirect chain
            const redirectChain: string[] = [];
            let wasRedirected = false;

            // Configure axios request
            const axiosConfig: AxiosRequestConfig = {
                method,
                url: input.url,
                headers: {
                    'User-Agent': 'Apicurio-Axiom-Bot/1.0 (AI Agent)',
                    ...input.headers,
                },
                timeout,
                maxRedirects: followRedirects ? 5 : 0,
                validateStatus: () => true, // Don't throw on any status code
                maxContentLength: maxSize,
                maxBodyLength: maxSize,
                // Track redirects
                beforeRedirect: (options: any, responseDetails: any) => {
                    wasRedirected = true;
                    if (responseDetails.headers.location) {
                        const redirectUrl = new URL(
                            responseDetails.headers.location,
                            options.url || input.url,
                        ).toString();
                        redirectChain.push(redirectUrl);

                        // Validate redirect URL for SSRF
                        const redirectValidationError = validateUrl(redirectUrl);
                        if (redirectValidationError) {
                            throw new Error(`Redirect blocked: ${redirectValidationError}`);
                        }
                    }
                },
            };

            // Execute request
            const startTime = Date.now();
            let response: AxiosResponse;

            try {
                response = await axios.request(axiosConfig);
            } catch (error: any) {
                const fetchTime = Date.now() - startTime;

                // Handle specific axios errors
                if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                    return {
                        error: true,
                        message: `Request timeout after ${timeout}ms`,
                        tool: this.name,
                        fetch_time: fetchTime,
                    };
                }

                if (error.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED') {
                    return {
                        error: true,
                        message: `Response size exceeds maximum of ${maxSize} bytes`,
                        tool: this.name,
                        fetch_time: fetchTime,
                    };
                }

                if (error.message?.includes('Redirect blocked')) {
                    return {
                        error: true,
                        message: error.message,
                        tool: this.name,
                        fetch_time: fetchTime,
                    };
                }

                return {
                    error: true,
                    message: `Failed to fetch URL: ${error.message}`,
                    tool: this.name,
                    fetch_time: fetchTime,
                };
            }

            const fetchTime = Date.now() - startTime;

            // Extract response details
            const finalUrl = response.request?.res?.responseUrl || input.url;
            const statusCode = response.status;
            const statusText = response.statusText;
            const responseHeaders = response.headers;
            const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            const contentType = responseHeaders['content-type'] || 'unknown';
            const contentLength = content.length;

            // Detect encoding from content-type or default to utf-8
            let encoding = 'utf-8';
            const contentTypeHeader = responseHeaders['content-type'];
            if (contentTypeHeader) {
                const charsetMatch = contentTypeHeader.match(/charset=([^;]+)/i);
                if (charsetMatch) {
                    encoding = charsetMatch[1].trim();
                }
            }

            context.logger.info(
                `Fetch completed: ${statusCode} ${statusText} (${contentLength} bytes, ${fetchTime}ms)`,
            );

            return {
                success: true,
                url: finalUrl,
                original_url: input.url,
                status_code: statusCode,
                status_text: statusText,
                headers: responseHeaders,
                content,
                content_type: contentType,
                content_length: contentLength,
                encoding,
                redirected: wasRedirected,
                redirect_chain: redirectChain.length > 0 ? redirectChain : undefined,
                fetch_time: fetchTime,
                cached: false, // TODO: Implement caching in future
            };
        } catch (error) {
            context.logger.error(`Error in web_read-fetch_url: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to fetch URL: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     *
     * For read-only tools like this, mock execution performs the actual fetch
     * since it doesn't modify any state.
     */
    async executeMock(
        input: {
            url: string;
            method?: 'GET' | 'POST' | 'HEAD';
            headers?: Record<string, string>;
            timeout?: number;
            follow_redirects?: boolean;
            max_size?: number;
        },
        context: ToolContext,
    ): Promise<any> {
        // For read-only operations, execute normally
        return this.execute(input, context);
    },
};
