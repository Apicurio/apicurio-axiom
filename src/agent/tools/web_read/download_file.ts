/**
 * DownloadFileTool - Download file from URL to local repository
 *
 * This tool downloads files from HTTP/HTTPS URLs and saves them to the local
 * repository with integrity verification. It uses streaming for memory efficiency,
 * calculates SHA-256 checksums, and enforces size limits for security.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import axios from 'axios';
import fse from 'fs-extra';
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

        // Check for SSRF (Server-Side Request Forgery) risks
        if (isPrivateOrLocalhost(parsedUrl.hostname)) {
            return 'Access denied: Cannot download from localhost or private IP addresses (SSRF protection).';
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

export const DownloadFileTool: Tool = {
    name: 'web_read-download_file',
    description:
        'Download a file from a URL and save it to the local repository with integrity verification. Supports streaming downloads, SHA-256 checksum verification, size limits, and overwrite control.',
    input_schema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL of file to download',
                pattern: '^https?://.+',
            },
            destination: {
                type: 'string',
                description: 'Relative path where file should be saved',
            },
            overwrite: {
                type: 'boolean',
                description: 'Whether to overwrite existing file',
            },
            verify_checksum: {
                type: 'string',
                description: 'Expected SHA-256 checksum to verify (optional)',
            },
            max_size: {
                type: 'number',
                description: 'Maximum file size in bytes',
            },
        },
        required: ['url', 'destination'],
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
            destination: string;
            overwrite?: boolean;
            verify_checksum?: string;
            max_size?: number;
        },
        context: ToolContext,
    ): Promise<any> {
        const startTime = Date.now();
        let tempFilePath: string | undefined;

        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for web_read-download_file',
                    tool: 'web_read-download_file',
                };
            }

            // Validate input
            if (!input.url || typeof input.url !== 'string') {
                return {
                    error: true,
                    message: 'url parameter is required and must be a string',
                    tool: this.name,
                };
            }

            if (!input.destination || typeof input.destination !== 'string') {
                return {
                    error: true,
                    message: 'destination parameter is required and must be a string',
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

            // Validate destination path is within workDir
            const fullPath = path.resolve(context.workDir, input.destination);
            const normalizedWorkDir = path.resolve(context.workDir);

            if (!fullPath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: destination path is outside work directory',
                    tool: this.name,
                };
            }

            // Set defaults
            const overwrite = input.overwrite === true; // default false
            const maxSize = input.max_size !== undefined ? input.max_size : 104857600; // 100MB default

            // Validate max_size
            if (maxSize < 0) {
                return {
                    error: true,
                    message: 'max_size must be a positive number',
                    tool: this.name,
                };
            }

            // Check if file exists
            const fileExists = await fse.pathExists(fullPath);

            if (fileExists && !overwrite) {
                return {
                    error: true,
                    message: `File already exists at ${input.destination}. Use overwrite: true to replace it.`,
                    tool: this.name,
                };
            }

            context.logger.info(
                `Downloading file from ${input.url} to ${input.destination} (max size: ${maxSize} bytes)`,
            );

            // Ensure parent directory exists
            const dirPath = path.dirname(fullPath);
            await fse.ensureDir(dirPath);

            // Create temporary file for download
            tempFilePath = `${fullPath}.download`;

            // Start streaming download
            const response = await axios({
                method: 'GET',
                url: input.url,
                responseType: 'stream',
                timeout: 120000, // 2 minute timeout
                maxContentLength: maxSize,
                maxBodyLength: maxSize,
                validateStatus: () => true, // Don't throw on any status
                headers: {
                    'User-Agent': 'Apicurio-Axiom-Bot/1.0 (AI Agent)',
                },
            });

            // Check status code
            if (response.status !== 200) {
                return {
                    error: true,
                    message: `HTTP ${response.status}: ${response.statusText || 'Download failed'}`,
                    tool: this.name,
                    download_time: Date.now() - startTime,
                };
            }

            // Get content type from response
            const contentType = response.headers['content-type'] || 'application/octet-stream';

            // Track download size and calculate checksum
            let downloadedSize = 0;
            const hash = crypto.createHash('sha256');

            // Create a transform stream to monitor size and calculate checksum
            const transformStream = new Transform({
                transform(chunk: Buffer, _encoding, callback) {
                    downloadedSize += chunk.length;

                    // Enforce size limit during download
                    if (downloadedSize > maxSize) {
                        callback(new Error(`Download size exceeds maximum of ${maxSize} bytes`));
                        return;
                    }

                    // Update checksum
                    hash.update(chunk);

                    // Pass chunk through
                    callback(null, chunk);
                },
            });

            // Create write stream
            const fileStream = fs.createWriteStream(tempFilePath);

            // Stream: response -> transform (size check + checksum) -> file
            await pipeline(response.data, transformStream, fileStream);

            // Calculate final checksum
            const checksum = hash.digest('hex');

            // Verify checksum if provided
            let checksumVerified = false;
            if (input.verify_checksum) {
                const expectedChecksum = input.verify_checksum.toLowerCase();
                const actualChecksum = checksum.toLowerCase();

                if (expectedChecksum !== actualChecksum) {
                    // Clean up temp file
                    await fse.remove(tempFilePath);

                    return {
                        error: true,
                        message: `Checksum verification failed. Expected: ${expectedChecksum}, Got: ${actualChecksum}`,
                        tool: this.name,
                        checksum: actualChecksum,
                    };
                }

                checksumVerified = true;
                context.logger.info(`Checksum verified: ${checksum}`);
            }

            // Move temp file to final destination
            await fse.move(tempFilePath, fullPath, { overwrite: true });
            tempFilePath = undefined; // Mark as moved

            const downloadTime = Date.now() - startTime;

            context.logger.info(
                `Download completed: ${downloadedSize} bytes in ${downloadTime}ms (${input.destination})`,
            );

            return {
                success: true,
                url: input.url,
                destination: input.destination,
                size: downloadedSize,
                content_type: contentType,
                checksum,
                checksum_verified: checksumVerified,
                download_time: downloadTime,
                created: !fileExists,
            };
        } catch (error: any) {
            // Clean up temp file on error
            if (tempFilePath) {
                try {
                    await fse.remove(tempFilePath);
                } catch (_cleanupError) {
                    // Ignore cleanup errors
                }
            }

            const downloadTime = Date.now() - startTime;

            context.logger.error(`Error in web_read-download_file: ${error.message}`);

            // Handle specific axios errors
            if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                return {
                    error: true,
                    message: 'Download timeout after 120 seconds',
                    tool: this.name,
                    download_time: downloadTime,
                };
            }

            if (error.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' || error.message?.includes('exceeds maximum')) {
                return {
                    error: true,
                    message: error.message,
                    tool: this.name,
                    download_time: downloadTime,
                };
            }

            if (error.response?.status) {
                return {
                    error: true,
                    message: `HTTP ${error.response.status}: ${error.response.statusText || 'Download failed'}`,
                    tool: this.name,
                    download_time: downloadTime,
                };
            }

            return {
                error: true,
                message: `Failed to download file: ${error.message}`,
                tool: this.name,
                download_time: downloadTime,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     *
     * For this tool, we simulate the download without actually fetching or writing the file
     */
    async executeMock(
        input: {
            url: string;
            destination: string;
            overwrite?: boolean;
            verify_checksum?: string;
            max_size?: number;
        },
        context: ToolContext,
    ): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for web_read-download_file',
                    tool: 'web_read-download_file',
                };
            }

            // Validate input
            if (!input.url || typeof input.url !== 'string') {
                return {
                    error: true,
                    message: 'url parameter is required and must be a string',
                    tool: this.name,
                };
            }

            if (!input.destination || typeof input.destination !== 'string') {
                return {
                    error: true,
                    message: 'destination parameter is required and must be a string',
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

            // Validate destination path is within workDir
            const fullPath = path.resolve(context.workDir, input.destination);
            const normalizedWorkDir = path.resolve(context.workDir);

            if (!fullPath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: destination path is outside work directory',
                    tool: this.name,
                };
            }

            // Check if file exists
            const fileExists = await fse.pathExists(fullPath);
            const overwrite = input.overwrite === true;

            if (fileExists && !overwrite) {
                return {
                    dry_run: true,
                    error: true,
                    message: `File already exists at ${input.destination}. Use overwrite: true to replace it.`,
                    tool: this.name,
                };
            }

            const maxSize = input.max_size !== undefined ? input.max_size : 104857600;

            return {
                dry_run: true,
                message: `Would download file from ${input.url} to ${input.destination}`,
                success: true,
                url: input.url,
                destination: input.destination,
                size: 0, // Unknown in dry-run
                content_type: 'unknown',
                checksum: 'dry-run-checksum',
                checksum_verified: input.verify_checksum !== undefined,
                download_time: 0,
                created: !fileExists,
                max_size: maxSize,
            };
        } catch (error) {
            return {
                dry_run: true,
                error: true,
                message: `Dry-run validation failed: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },
};
