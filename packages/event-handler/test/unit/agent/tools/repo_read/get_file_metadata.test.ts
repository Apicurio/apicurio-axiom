/**
 * Tests for GetFileMetadataTool (FSA-001)
 */

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GetFileMetadataTool } from '../../../../../src/agent/tools/repo_read/get_file_metadata.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';

describe('GetFileMetadataTool', () => {
    const fixturesPath = path.resolve(process.cwd(), 'packages/event-handler/test/fixtures/test-repo');

    describe('Basic Functionality', () => {
        it('should have correct tool metadata', () => {
            expect(GetFileMetadataTool.name).toBe('repo_read-get_file_metadata');
            expect(GetFileMetadataTool.description).toContain('detailed metadata');
            expect(GetFileMetadataTool.input_schema.required).toContain('path');
        });

        it('should get metadata for a text file', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.path).toBe('README.md');
            expect(result.exists).toBe(true);
            expect(result.type).toBe('file');
            expect(result.size).toBeGreaterThan(0);
            expect(result.is_text).toBe(true);
            expect(result.is_binary).toBe(false);
            expect(result.lines).toBeGreaterThan(0);
        });

        it('should get metadata for a directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'src' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('directory');
            expect(result.is_text).toBeUndefined();
            expect(result.is_binary).toBeUndefined();
            expect(result.lines).toBeUndefined();
        });

        it('should include timestamps', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.created).toBeDefined();
            expect(result.modified).toBeDefined();
            expect(result.accessed).toBeDefined();

            // Timestamps should be valid ISO 8601 format
            expect(new Date(result.created).toISOString()).toBe(result.created);
            expect(new Date(result.modified).toISOString()).toBe(result.modified);
            expect(new Date(result.accessed).toISOString()).toBe(result.accessed);
        });

        it('should include permissions', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.permissions).toBeDefined();
            expect(typeof result.permissions).toBe('string');
            expect(result.permissions).toMatch(/^[0-7]{3}$/); // Octal format like '644' or '755'
        });

        it('should include file extension', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.extension).toBe('md');
        });

        it('should handle files without extension', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.extension).toBeDefined();
        });
    });

    describe('File Type Detection', () => {
        it('should detect text files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'src/index.ts' }, context);

            assertToolSuccess(result);
            expect(result.is_text).toBe(true);
            expect(result.is_binary).toBe(false);
            expect(result.encoding).toBe('utf-8');
        });

        it('should detect binary files', async () => {
            const binaryPath = path.resolve(process.cwd(), 'packages/event-handler/test/fixtures/binary-files');
            const context = createMockContext(binaryPath);
            const result = await GetFileMetadataTool.execute({ path: 'sample.bin' }, context);

            assertToolSuccess(result);
            expect(result.is_binary).toBe(true);
            expect(result.is_text).toBe(false);
            expect(result.lines).toBeUndefined();
        });

        it('should count lines in text files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'src/index.ts' }, context);

            assertToolSuccess(result);
            expect(result.lines).toBeGreaterThan(0);
            expect(typeof result.lines).toBe('number');
        });
    });

    describe('Non-Existent Paths', () => {
        it('should return exists: false for non-existent file', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'nonexistent-file-12345.txt' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(false);
            expect(result.type).toBeNull();
        });

        it('should return exists: false for non-existent directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'nonexistent-directory-12345' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(false);
            expect(result.type).toBeNull();
        });
    });

    describe('Path Normalization', () => {
        it('should handle paths with ./ prefix', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: './README.md' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
        });

        it('should handle nested paths', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: 'src/utils/helper.ts' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('file');
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: '../../../etc/passwd' }, context);

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: '/etc/passwd' }, context);

            assertToolError(result, 'outside work directory');
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await GetFileMetadataTool.execute({ path: 'test.txt' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.execute({ path: '' }, context);

            assertToolError(result, 'path parameter is required');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty files', async () => {
            const edgeCasesPath = path.resolve(process.cwd(), 'packages/event-handler/test/fixtures/edge-cases');
            const context = createMockContext(edgeCasesPath);
            const result = await GetFileMetadataTool.execute({ path: 'empty.txt' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.size).toBe(0);
            expect(result.is_text).toBe(true);
            expect(result.lines).toBe(1); // Empty file has 1 line (empty string)
        });

        it('should handle unicode content', async () => {
            const edgeCasesPath = path.resolve(process.cwd(), 'packages/event-handler/test/fixtures/edge-cases');
            const context = createMockContext(edgeCasesPath);
            const result = await GetFileMetadataTool.execute({ path: 'unicode.txt' }, context);

            assertToolSuccess(result);
            expect(result.encoding).toBe('utf-8');
            expect(result.is_text).toBe(true);
        });
    });

    describe('Mock Execution', () => {
        it('should execute normally in mock mode (read-only tool)', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetFileMetadataTool.executeMock({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('file');
        });
    });
});
