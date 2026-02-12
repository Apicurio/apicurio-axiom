/**
 * Tests for DownloadFileTool (WCR-002)
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DownloadFileTool } from '../../../../../src/agent/tools/web_read/download_file.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';

describe.sequential('DownloadFileTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Test file URL (small file from httpbin.org)
    const testFileUrl = 'https://httpbin.org/robots.txt';

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `download-file-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fse.ensureDir(tempDir);
    });

    // Clean up temp directory after each test
    afterEach(async () => {
        if (tempDir) {
            try {
                await fse.remove(tempDir);
            } catch (_error) {
                // Ignore cleanup errors
            }
        }
    });

    describe('Basic Functionality', () => {
        it('should have correct tool metadata', () => {
            expect(DownloadFileTool.name).toBe('web_read-download_file');
            expect(DownloadFileTool.description).toContain('Download a file');
            expect(DownloadFileTool.input_schema.required).toContain('url');
            expect(DownloadFileTool.input_schema.required).toContain('destination');
        });

        it('should download a file successfully', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.url).toBe(testFileUrl);
            expect(result.destination).toBe('robots.txt');
            expect(result.size).toBeGreaterThan(0);
            expect(result.content_type).toBeDefined();
            expect(result.checksum).toBeDefined();
            expect(result.checksum).toHaveLength(64); // SHA-256 is 64 hex chars
            expect(result.checksum_verified).toBe(false); // No checksum provided
            expect(result.download_time).toBeGreaterThan(0);
            expect(result.created).toBe(true);

            // Verify file was created
            const filePath = path.join(tempDir, 'robots.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);

            // Verify file size matches
            const stats = await fs.stat(filePath);
            expect(stats.size).toBe(result.size);
        }, 30000);

        it('should create parent directories', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'deep/nested/dir/robots.txt',
                },
                context,
            );

            assertToolSuccess(result);

            const filePath = path.join(tempDir, 'deep/nested/dir/robots.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);
        }, 30000);

        it('should calculate correct checksum', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                },
                context,
            );

            assertToolSuccess(result);

            // Manually calculate checksum to verify
            const filePath = path.join(tempDir, 'robots.txt');
            const fileContent = await fs.readFile(filePath);
            const expectedChecksum = crypto.createHash('sha256').update(fileContent).digest('hex');

            expect(result.checksum).toBe(expectedChecksum);
        }, 30000);
    });

    describe('Overwrite Handling', () => {
        it('should not overwrite existing file by default', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            // Create existing file
            await fs.writeFile(filePath, 'Original content');

            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'test.txt',
                },
                context,
            );

            assertToolError(result, 'already exists');

            // Verify original file is unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Original content');
        });

        it('should overwrite when overwrite is true', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            // Create existing file
            await fs.writeFile(filePath, 'Original content');

            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'test.txt',
                    overwrite: true,
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.created).toBe(false); // File existed

            // Verify file was overwritten
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).not.toBe('Original content');
        }, 30000);
    });

    describe('Checksum Verification', () => {
        it('should verify checksum when provided and correct', async () => {
            const context = createMockContext(tempDir);

            // First download to get the checksum
            const firstResult = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots1.txt',
                },
                context,
            );

            assertToolSuccess(firstResult);
            const correctChecksum = firstResult.checksum;

            // Download again with checksum verification
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots2.txt',
                    verify_checksum: correctChecksum,
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.checksum_verified).toBe(true);
            expect(result.checksum).toBe(correctChecksum);
        }, 60000);

        it('should fail when checksum does not match', async () => {
            const context = createMockContext(tempDir);
            const wrongChecksum = 'a'.repeat(64); // Invalid checksum

            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                    verify_checksum: wrongChecksum,
                },
                context,
            );

            assertToolError(result, 'Checksum verification failed');

            // Verify file was NOT created (cleaned up on error)
            const filePath = path.join(tempDir, 'robots.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);
        }, 30000);

        it('should handle case-insensitive checksum comparison', async () => {
            const context = createMockContext(tempDir);

            // First download to get the checksum
            const firstResult = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots1.txt',
                },
                context,
            );

            assertToolSuccess(firstResult);
            const checksumUpper = firstResult.checksum.toUpperCase();

            // Download again with uppercase checksum
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots2.txt',
                    verify_checksum: checksumUpper,
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.checksum_verified).toBe(true);
        }, 60000);
    });

    describe('Size Limits', () => {
        it('should use default max size', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.size).toBeLessThan(104857600); // 100MB default
        }, 30000);

        it('should enforce custom max size', async () => {
            const context = createMockContext(tempDir);

            // Set a very small size limit that the file will exceed
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                    max_size: 10, // 10 bytes - too small
                },
                context,
            );

            assertToolError(result, 'exceeds maximum');

            // Verify file was NOT created
            const filePath = path.join(tempDir, 'robots.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);
        }, 30000);

        it('should reject negative max_size', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                    max_size: -100,
                },
                context,
            );

            assertToolError(result, 'must be a positive number');
        });
    });

    describe('Input Validation', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'test.txt',
                },
                context,
            );

            assertToolError(result, 'workDir is required');
        });

        it('should require url parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: '',
                    destination: 'test.txt',
                },
                context,
            );

            assertToolError(result, 'url parameter is required');
        });

        it('should validate url is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 123 as any,
                    destination: 'test.txt',
                },
                context,
            );

            assertToolError(result, 'must be a string');
        });

        it('should require destination parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: '',
                },
                context,
            );

            assertToolError(result, 'destination parameter is required');
        });

        it('should validate destination is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 123 as any,
                },
                context,
            );

            assertToolError(result, 'must be a string');
        });

        it('should reject non-HTTP(S) URLs', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'ftp://example.com/file.txt',
                    destination: 'file.txt',
                },
                context,
            );

            assertToolError(result, 'Invalid protocol');
        });

        it('should reject file:// URLs', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'file:///etc/passwd',
                    destination: 'passwd.txt',
                },
                context,
            );

            assertToolError(result, 'Invalid protocol');
        });

        it('should reject malformed URLs', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'not-a-valid-url',
                    destination: 'file.txt',
                },
                context,
            );

            assertToolError(result, 'Invalid URL');
        });
    });

    describe('Security (SSRF Protection)', () => {
        it('should block localhost', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'http://localhost:8080/file.txt',
                    destination: 'file.txt',
                },
                context,
            );

            assertToolError(result, 'SSRF protection');
        });

        it('should block 127.0.0.1', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'http://127.0.0.1/file.txt',
                    destination: 'file.txt',
                },
                context,
            );

            assertToolError(result, 'SSRF protection');
        });

        it('should block private IP 10.x.x.x', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'http://10.0.0.1/file.txt',
                    destination: 'file.txt',
                },
                context,
            );

            assertToolError(result, 'SSRF protection');
        });

        it('should block private IP 192.168.x.x', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'http://192.168.1.1/file.txt',
                    destination: 'file.txt',
                },
                context,
            );

            assertToolError(result, 'SSRF protection');
        });

        it('should block private IP 172.16.x.x', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'http://172.16.0.1/file.txt',
                    destination: 'file.txt',
                },
                context,
            );

            assertToolError(result, 'SSRF protection');
        });

        it('should reject path traversal in destination', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: '../../../etc/passwd',
                },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: '/tmp/malicious.txt',
                },
                context,
            );

            assertToolError(result, 'outside work directory');
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'https://this-domain-definitely-does-not-exist-12345.com/file.txt',
                    destination: 'file.txt',
                },
                context,
            );

            assertToolError(result);
            expect(result.message).toContain('Failed to download file');
        }, 30000);

        it('should handle HTTP 404 errors', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'https://httpbin.org/status/404',
                    destination: 'notfound.txt',
                },
                context,
            );

            assertToolError(result);
            expect(result.message).toContain('404');
        }, 30000);

        it('should provide download_time even on error', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: 'http://localhost/',
                    destination: 'file.txt',
                },
                context,
            );

            assertToolError(result);
            // SSRF errors happen before download, so may not have download_time
        });

        it('should clean up temp file on error', async () => {
            const context = createMockContext(tempDir);

            // Use a URL that will fail after starting download
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'file.txt',
                    max_size: 10, // Will fail due to size
                },
                context,
            );

            assertToolError(result);

            // Verify no temp files left behind
            const files = await fs.readdir(tempDir);
            const tempFiles = files.filter((f) => f.endsWith('.download'));
            expect(tempFiles).toHaveLength(0);
        }, 30000);
    });

    describe('Mock Execution', () => {
        it('should not download file in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.executeMock(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.url).toBe(testFileUrl);
            expect(result.destination).toBe('robots.txt');
            expect(result.created).toBe(true);

            // Verify file was NOT actually downloaded
            const filePath = path.join(tempDir, 'robots.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);
        });

        it('should report correct state in mock mode for existing file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'existing.txt');

            // Create existing file
            await fs.writeFile(filePath, 'Original');

            const result = await DownloadFileTool.executeMock(
                {
                    url: testFileUrl,
                    destination: 'existing.txt',
                    overwrite: true,
                },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.created).toBe(false);

            // Verify original file is unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Original');
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.executeMock(
                {
                    url: 'http://localhost/file.txt',
                    destination: 'file.txt',
                },
                context,
            );

            expect(result.error).toBe(true);
            expect(result.message).toContain('SSRF protection');
        });

        it('should validate overwrite in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'existing.txt');

            // Create existing file
            await fs.writeFile(filePath, 'Original');

            const result = await DownloadFileTool.executeMock(
                {
                    url: testFileUrl,
                    destination: 'existing.txt',
                    overwrite: false,
                },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('already exists');
        });
    });

    describe('Edge Cases', () => {
        it('should handle relative paths with ./', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: './robots.txt',
                },
                context,
            );

            assertToolSuccess(result);

            const filePath = path.join(tempDir, 'robots.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);
        }, 30000);

        it('should handle destinations with subdirectories', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'sub/dir/robots.txt',
                },
                context,
            );

            assertToolSuccess(result);

            const filePath = path.join(tempDir, 'sub/dir/robots.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);
        }, 30000);
    });

    describe('Response Metadata', () => {
        it('should include all required response fields', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                },
                context,
            );

            assertToolSuccess(result);
            expect(result).toHaveProperty('url');
            expect(result).toHaveProperty('destination');
            expect(result).toHaveProperty('size');
            expect(result).toHaveProperty('content_type');
            expect(result).toHaveProperty('checksum');
            expect(result).toHaveProperty('checksum_verified');
            expect(result).toHaveProperty('download_time');
            expect(result).toHaveProperty('created');
        }, 30000);

        it('should report download_time in milliseconds', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.download_time).toBeGreaterThan(0);
            expect(result.download_time).toBeLessThan(120000); // Should complete within 2 minutes
        }, 30000);

        it('should detect content type', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.content_type).toBeDefined();
            expect(result.content_type.length).toBeGreaterThan(0);
        }, 30000);
    });

    describe('Real-world Scenarios', () => {
        it('should download a text file', async () => {
            const context = createMockContext(tempDir);
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                },
                context,
            );

            assertToolSuccess(result);

            const filePath = path.join(tempDir, 'robots.txt');
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content.length).toBeGreaterThan(0);
        }, 30000);

        it('should safely update file with overwrite', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'robots.txt');

            // Create initial version
            await fs.writeFile(filePath, 'Old version');

            // Download new version
            const result = await DownloadFileTool.execute(
                {
                    url: testFileUrl,
                    destination: 'robots.txt',
                    overwrite: true,
                },
                context,
            );

            assertToolSuccess(result);

            // Verify file was updated
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).not.toBe('Old version');
        }, 30000);
    });
});
