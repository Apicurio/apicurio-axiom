/**
 * Tests for FindFilesTool (FSA-004)
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { FindFilesTool } from '../../../../../src/agent/tools/repo_read/find_files.js';
import { createMockContext } from '../../../../helpers/mock-context.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';

describe('FindFilesTool', () => {
    const fixturesPath = path.resolve(process.cwd(), 'test/fixtures/test-repo');

    describe('Basic Functionality', () => {
        it('should have correct tool metadata', () => {
            expect(FindFilesTool.name).toBe('repo_read-find_files');
            expect(FindFilesTool.description).toContain('glob');
            expect(FindFilesTool.input_schema.required).toContain('pattern');
        });

        it('should find files matching simple pattern', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '*.md' }, context);

            assertToolSuccess(result);
            expect(result.files).toBeDefined();
            expect(Array.isArray(result.files)).toBe(true);
            expect(result.files.length).toBeGreaterThan(0);
            expect(result.count).toBe(result.files.length);
        });

        it('should find TypeScript files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '**/*.ts' }, context);

            assertToolSuccess(result);
            expect(result.files.length).toBeGreaterThan(0);
            result.files.forEach((file) => {
                expect(file).toMatch(/\.ts$/);
            });
        });

        it('should find Java files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '**/*.java' }, context);

            assertToolSuccess(result);
            expect(result.files.length).toBeGreaterThan(0);
            result.files.forEach((file) => {
                expect(file).toMatch(/\.java$/);
            });
        });
    });

    describe('Glob Patterns', () => {
        it('should support ** for recursive matching', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '**/*.ts' }, context);

            assertToolSuccess(result);
            expect(result.files.length).toBeGreaterThan(0);
            // Should find files in nested directories
            expect(result.files.some((f) => f.includes('/'))).toBe(true);
        });

        it('should support multiple extensions with braces', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '**/*.{ts,java,json}' }, context);

            assertToolSuccess(result);
            expect(result.files.length).toBeGreaterThan(0);
            result.files.forEach((file) => {
                expect(file).toMatch(/\.(ts|java|json)$/);
            });
        });

        it('should support ? wildcard', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '*.??' }, context);

            assertToolSuccess(result);
            // Should match files with 2-character extensions
            if (result.files.length > 0) {
                result.files.forEach((file) => {
                    const ext = path.extname(file);
                    expect(ext.length).toBe(3); // dot + 2 chars
                });
            }
        });

        it('should support directory-specific patterns', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: 'src/**/*.ts' }, context);

            assertToolSuccess(result);
            result.files.forEach((file) => {
                expect(file).toMatch(/^src\//);
            });
        });
    });

    describe('Path Scoping', () => {
        it('should search from repository root by default', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '**/*.ts' }, context);

            assertToolSuccess(result);
            expect(result.files.length).toBeGreaterThan(0);
        });

        it('should search from specified path', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '*.ts', path: 'src' }, context);

            assertToolSuccess(result);
            result.files.forEach((file) => {
                expect(file).toMatch(/^src\//);
            });
        });

        it('should search nested directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute(
                { pattern: '*.ts', path: 'src/utils' },
                context,
            );

            assertToolSuccess(result);
            result.files.forEach((file) => {
                expect(file).toMatch(/^src\/utils\//);
            });
        });
    });

    describe('Exclusion Patterns', () => {
        it('should exclude files matching exclude patterns', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute(
                { pattern: '**/*', exclude: ['**/*.ts'] },
                context,
            );

            assertToolSuccess(result);
            result.files.forEach((file) => {
                expect(file).not.toMatch(/\.ts$/);
            });
        });

        it('should support multiple exclude patterns', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute(
                { pattern: '**/*', exclude: ['**/*.ts', '**/*.java'] },
                context,
            );

            assertToolSuccess(result);
            result.files.forEach((file) => {
                expect(file).not.toMatch(/\.(ts|java)$/);
            });
        });

        it('should exclude .git directory by default', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '**/*' }, context);

            assertToolSuccess(result);
            result.files.forEach((file) => {
                expect(file).not.toContain('.git/');
            });
        });
    });

    describe('Result Limiting', () => {
        it('should limit results to max_results', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute(
                { pattern: '**/*', max_results: 5 },
                context,
            );

            assertToolSuccess(result);
            expect(result.files.length).toBeLessThanOrEqual(5);
        });

        it('should indicate when results are truncated', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute(
                { pattern: '**/*', max_results: 2 },
                context,
            );

            assertToolSuccess(result);
            if (result.count > 2) {
                expect(result.truncated).toBe(true);
                expect(result.files.length).toBe(2);
            }
        });

        it('should use default limit of 1000', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '**/*' }, context);

            assertToolSuccess(result);
            expect(result.files.length).toBeLessThanOrEqual(1000);
        });
    });

    describe('Empty Results', () => {
        it('should return empty array when no matches found', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute(
                { pattern: '**/*.nonexistent' },
                context,
            );

            assertToolSuccess(result);
            expect(result.files).toEqual([]);
            expect(result.count).toBe(0);
            expect(result.truncated).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await FindFilesTool.execute({ pattern: '*.txt' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require pattern parameter', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: '' }, context);

            assertToolError(result, 'pattern parameter is required');
        });

        it('should validate pattern is a string', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute({ pattern: 123 as any }, context);

            assertToolError(result, 'must be a string');
        });

        it('should return error for non-existent start path', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute(
                { pattern: '*.ts', path: 'nonexistent-dir' },
                context,
            );

            assertToolError(result, 'does not exist');
        });
    });

    describe('Security', () => {
        it('should reject path traversal in start path', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.execute(
                { pattern: '*.txt', path: '../../../etc' },
                context,
            );

            assertToolError(result, 'outside the repository');
        });
    });

    describe('Mock Execution', () => {
        it('should execute normally in mock mode (read-only tool)', async () => {
            const context = createMockContext(fixturesPath);
            const result = await FindFilesTool.executeMock({ pattern: '*.md' }, context);

            assertToolSuccess(result);
            expect(result.files.length).toBeGreaterThan(0);
        });
    });
});
