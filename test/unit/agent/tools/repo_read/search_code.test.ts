/**
 * Tests for SearchCodeTool
 */

import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SearchCodeTool } from '../../../../../src/agent/tools/repo_read/search_code.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';
import { cleanupTempRepo, createTempRepo } from '../../../../helpers/temp-repo.js';

describe('SearchCodeTool', () => {
    const fixturesPath = path.resolve(process.cwd(), 'test/fixtures/test-repo');
    let tempDir: string;

    describe('Basic Functionality', () => {
        it('should have correct tool metadata', () => {
            expect(SearchCodeTool.name).toBe('repo_read-search_code');
            expect(SearchCodeTool.description).toContain('Search for text patterns');
            expect(SearchCodeTool.input_schema.required).toContain('pattern');
        });

        it('should find simple text matches', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'function' }, context);

            assertToolSuccess(result);
            expect(result.matches).toBeDefined();
            expect(result.count).toBeGreaterThan(0);
            expect(result.pattern).toBe('function');
        });

        it('should find matches case-insensitively by default', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'FUNCTION' }, context);

            assertToolSuccess(result);
            expect(result.count).toBeGreaterThan(0);
            expect(result.case_sensitive).toBe(false);
        });

        it('should respect case-sensitive flag', async () => {
            const context = createMockContext(fixturesPath);

            // Case-insensitive search (should find matches)
            const insensitiveResult = await SearchCodeTool.execute(
                { pattern: 'FUNCTION', case_sensitive: false },
                context,
            );
            expect(insensitiveResult.count).toBeGreaterThan(0);

            // Case-sensitive search (should find no matches)
            const sensitiveResult = await SearchCodeTool.execute(
                { pattern: 'FUNCTION', case_sensitive: true },
                context,
            );
            expect(sensitiveResult.count).toBe(0);
        });

        it('should return match details with file, line number, and content', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'helper' }, context);

            assertToolSuccess(result);
            expect(result.matches.length).toBeGreaterThan(0);

            const match = result.matches[0];
            expect(match.file).toBeDefined();
            expect(match.line_number).toBeGreaterThan(0);
            expect(match.content).toBeDefined();
            expect(typeof match.content).toBe('string');
        });

        it('should return empty results when no matches found', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'NONEXISTENT_PATTERN_12345' }, context);

            assertToolSuccess(result);
            expect(result.matches).toEqual([]);
            expect(result.count).toBe(0);
        });
    });

    describe('File Pattern Filtering', () => {
        it('should filter by file pattern', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'function', file_pattern: '**/*.ts' }, context);

            assertToolSuccess(result);
            expect(result.matches.length).toBeGreaterThan(0);

            // All matches should be from .ts files
            for (const match of result.matches) {
                expect(match.file).toMatch(/\.ts$/);
            }
        });

        it('should support glob patterns', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'helper', file_pattern: 'src/**/*.ts' }, context);

            assertToolSuccess(result);
            expect(result.matches.length).toBeGreaterThan(0);

            // All matches should be from src directory
            for (const match of result.matches) {
                expect(match.file).toMatch(/^src\//);
                expect(match.file).toMatch(/\.ts$/);
            }
        });

        it('should handle multiple file extensions', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute(
                { pattern: 'process', file_pattern: '**/*.{ts,java}' },
                context,
            );

            assertToolSuccess(result);
            expect(result.matches.length).toBeGreaterThan(0);

            // All matches should be from .ts or .java files
            for (const match of result.matches) {
                expect(match.file).toMatch(/\.(ts|java)$/);
            }
        });
    });

    describe('Context Lines', () => {
        it('should not include context lines by default', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'helper' }, context);

            assertToolSuccess(result);
            const match = result.matches[0];
            expect(match.context_before).toBeUndefined();
            expect(match.context_after).toBeUndefined();
        });

        it('should include context lines when requested', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'helper', context_lines: 2 }, context);

            assertToolSuccess(result);
            const match = result.matches[0];

            if (match.line_number > 1) {
                expect(match.context_before).toBeDefined();
                expect(Array.isArray(match.context_before)).toBe(true);
            }

            expect(match.context_after).toBeDefined();
            expect(Array.isArray(match.context_after)).toBe(true);
        });

        it('should limit context lines to maximum of 10', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute(
                { pattern: 'helper', context_lines: 20 }, // Request 20, should get max 10
                context,
            );

            assertToolSuccess(result);
            const match = result.matches[0];

            if (match.context_before) {
                expect(match.context_before.length).toBeLessThanOrEqual(10);
            }
            if (match.context_after) {
                expect(match.context_after.length).toBeLessThanOrEqual(10);
            }
        });
    });

    describe('Exclusion Patterns', () => {
        beforeEach(async () => {
            // Create a temp repo with node_modules for exclusion testing
            tempDir = await createTempRepo({
                src: {
                    'index.ts': 'function test() { console.log("source"); }',
                },
                node_modules: {
                    package: {
                        'index.js': 'function test() { console.log("dependency"); }',
                    },
                },
                dist: {
                    'build.js': 'function test() { console.log("build"); }',
                },
            });
        });

        afterEach(async () => {
            await cleanupTempRepo(tempDir);
        });

        it('should exclude node_modules by default', async () => {
            const context = createMockContext(tempDir);
            const result = await SearchCodeTool.execute({ pattern: 'function test' }, context);

            assertToolSuccess(result);

            // Should not find matches in node_modules
            for (const match of result.matches) {
                expect(match.file).not.toContain('node_modules');
            }
        });

        it('should exclude dist directory by default', async () => {
            const context = createMockContext(tempDir);
            const result = await SearchCodeTool.execute({ pattern: 'function test' }, context);

            assertToolSuccess(result);

            // Should not find matches in dist
            for (const match of result.matches) {
                expect(match.file).not.toContain('dist');
            }
        });

        it('should support custom exclusion patterns', async () => {
            const context = createMockContext(tempDir);
            const result = await SearchCodeTool.execute({ pattern: 'function test', exclude: ['src/**'] }, context);

            assertToolSuccess(result);

            // Should not find matches in src
            for (const match of result.matches) {
                expect(match.file).not.toMatch(/^src\//);
            }
        });
    });

    describe('Result Limiting', () => {
        it('should limit results to default 1000', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: '.' }, context); // Match everything

            assertToolSuccess(result);
            expect(result.matches.length).toBeLessThanOrEqual(1000);
        });

        it('should respect custom max_results', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'function', max_results: 5 }, context);

            assertToolSuccess(result);
            expect(result.matches.length).toBeLessThanOrEqual(5);
        });

        it('should indicate when results are truncated', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: '.', max_results: 5 }, context);

            assertToolSuccess(result);
            if (result.count > 5) {
                expect(result.truncated).toBe(true);
                expect(result.matches.length).toBe(5);
            }
        });
    });

    describe('Path Scoping', () => {
        it('should search in specific directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'helper', path: 'src/utils' }, context);

            assertToolSuccess(result);

            // All matches should be from src/utils
            for (const match of result.matches) {
                expect(match.file).toMatch(/^src\/utils\//);
            }
        });

        it('should search entire repo when path is "."', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'test', path: '.' }, context);

            assertToolSuccess(result);
            expect(result.path).toBe('.');
        });
    });

    describe('Regex Support', () => {
        it('should support regex patterns', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'function\\s+\\w+' }, context);

            assertToolSuccess(result);
            expect(result.count).toBeGreaterThan(0);
        });

        it('should support special regex characters', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: '\\(.*\\)' }, context);

            assertToolSuccess(result);
            expect(result.count).toBeGreaterThan(0);
        });

        it('should return error for invalid regex', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: '[invalid(' }, context);

            assertToolError(result, 'Invalid regex pattern');
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await SearchCodeTool.execute({ pattern: 'test' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require pattern parameter', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: '' }, context);

            assertToolError(result, 'pattern parameter is required');
        });

        it('should validate pattern is a string', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 123 as any }, context);

            assertToolError(result, 'must be a string');
        });

        it('should reject paths outside work directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'test', path: '../../../etc' }, context);

            assertToolError(result, 'outside work directory');
        });

        it('should return error for non-existent directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'test', path: 'nonexistent-dir-12345' }, context);

            assertToolError(result, 'Directory not found');
        });

        it('should return error when path is a file not a directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: 'test', path: 'README.md' }, context);

            assertToolError(result, 'Path is not a directory');
        });
    });

    describe('Binary Files', () => {
        it('should skip binary files gracefully', async () => {
            const binaryPath = path.resolve(process.cwd(), 'test/fixtures/binary-files');
            const context = createMockContext(binaryPath);
            const result = await SearchCodeTool.execute({ pattern: 'test' }, context);

            // Should not error, just return no matches
            assertToolSuccess(result);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty files', async () => {
            const edgeCasesPath = path.resolve(process.cwd(), 'test/fixtures/edge-cases');
            const context = createMockContext(edgeCasesPath);
            const result = await SearchCodeTool.execute({ pattern: 'test' }, context);

            assertToolSuccess(result);
        });

        it('should handle unicode content', async () => {
            const edgeCasesPath = path.resolve(process.cwd(), 'test/fixtures/edge-cases');
            const context = createMockContext(edgeCasesPath);
            const result = await SearchCodeTool.execute({ pattern: '世界' }, context);

            assertToolSuccess(result);
            expect(result.count).toBeGreaterThan(0);
        });

        it('should handle very long lines', async () => {
            const edgeCasesPath = path.resolve(process.cwd(), 'test/fixtures/edge-cases');
            const context = createMockContext(edgeCasesPath);
            const result = await SearchCodeTool.execute({ pattern: 'searchable' }, context);

            assertToolSuccess(result);
            expect(result.count).toBeGreaterThan(0);
        });
    });

    describe('Mock Execution', () => {
        it('should execute normally in mock mode (read-only tool)', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.executeMock({ pattern: 'function' }, context);

            assertToolSuccess(result);
            expect(result.matches.length).toBeGreaterThan(0);
        });
    });

    describe('Logger Integration', () => {
        it('should log search operations', async () => {
            const context = createMockContext(fixturesPath);
            await SearchCodeTool.execute({ pattern: 'function' }, context);

            expect(context.logger.info).toHaveBeenCalled();
            expect(context.logger.info).toHaveBeenCalledWith(expect.stringContaining('Searching for pattern'));
        });

        it('should log completion with result count', async () => {
            const context = createMockContext(fixturesPath);
            await SearchCodeTool.execute({ pattern: 'function' }, context);

            expect(context.logger.info).toHaveBeenCalledWith(expect.stringContaining('Search completed'));
            expect(context.logger.info).toHaveBeenCalledWith(expect.stringContaining('matches'));
        });

        it('should not log validation errors', async () => {
            const context = createMockContext(fixturesPath);
            const result = await SearchCodeTool.execute({ pattern: '[invalid(' }, context);

            // Validation errors should be returned, not logged
            assertToolError(result, 'Invalid regex pattern');
            expect(context.logger.error).not.toHaveBeenCalled();
        });
    });
});
