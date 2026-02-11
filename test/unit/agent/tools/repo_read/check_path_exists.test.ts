/**
 * Tests for CheckPathExistsTool (FSA-002)
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { CheckPathExistsTool } from '../../../../../src/agent/tools/repo_read/check_path_exists.js';
import { createMockContext } from '../../../../helpers/mock-context.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';

describe('CheckPathExistsTool', () => {
    const fixturesPath = path.resolve(process.cwd(), 'test/fixtures/test-repo');

    describe('Basic Functionality', () => {
        it('should have correct tool metadata', () => {
            expect(CheckPathExistsTool.name).toBe('repo_read-check_path_exists');
            expect(CheckPathExistsTool.description).toContain('check');
            expect(CheckPathExistsTool.input_schema.required).toContain('path');
        });

        it('should return true for existing file', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('file');
        });

        it('should return true for existing directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute({ path: 'src' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('directory');
        });

        it('should return false for non-existent path', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute(
                { path: 'nonexistent-file-12345.txt' },
                context,
            );

            assertToolSuccess(result);
            expect(result.exists).toBe(false);
            expect(result.type).toBeUndefined();
        });
    });

    describe('File Types', () => {
        it('should identify files correctly', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute({ path: 'package.json' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('file');
        });

        it('should identify directories correctly', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute({ path: 'lib' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('directory');
        });

        it('should handle nested paths', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute(
                { path: 'src/utils/helper.ts' },
                context,
            );

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('file');
        });
    });

    describe('Path Normalization', () => {
        it('should handle ./ prefix', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute({ path: './README.md' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
        });

        it('should handle trailing slash for directories', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute({ path: 'src/' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('directory');
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute(
                { path: '../../../etc/passwd' },
                context,
            );

            expect(result.error).toBe(true);
            expect(result.message).toContain('outside the repository');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute({ path: '/etc/passwd' }, context);

            expect(result.error).toBe(true);
            expect(result.message).toContain('outside the repository');
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await CheckPathExistsTool.execute({ path: 'test.txt' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.execute({ path: '' }, context);

            expect(result.error).toBe(true);
            expect(result.message).toContain('path parameter is required');
        });
    });

    describe('Performance', () => {
        it('should be faster than get_file_metadata for simple existence check', async () => {
            const context = createMockContext(fixturesPath);

            const start = Date.now();
            await CheckPathExistsTool.execute({ path: 'README.md' }, context);
            const duration = Date.now() - start;

            // Should complete very quickly (under 50ms)
            expect(duration).toBeLessThan(50);
        });
    });

    describe('Mock Execution', () => {
        it('should execute normally in mock mode (read-only tool)', async () => {
            const context = createMockContext(fixturesPath);
            const result = await CheckPathExistsTool.executeMock({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.exists).toBe(true);
            expect(result.type).toBe('file');
        });
    });
});
