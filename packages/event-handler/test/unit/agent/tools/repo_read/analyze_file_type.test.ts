/**
 * Tests for AnalyzeFileTypeTool (FSA-005)
 */

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AnalyzeFileTypeTool } from '../../../../../src/agent/tools/repo_read/analyze_file_type.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';

describe('AnalyzeFileTypeTool', () => {
    const fixturesPath = path.resolve(process.cwd(), 'packages/event-handler/test/fixtures/test-repo');

    describe('Basic Functionality', () => {
        it('should have correct tool metadata', () => {
            expect(AnalyzeFileTypeTool.name).toBe('repo_read-analyze_file_type');
            expect(AnalyzeFileTypeTool.description).toContain('file type');
            expect(AnalyzeFileTypeTool.input_schema.required).toContain('path');
        });

        it('should detect TypeScript files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'src/index.ts' }, context);

            assertToolSuccess(result);
            expect(result.language).toBe('typescript');
            expect(result.is_text).toBe(true);
            expect(result.is_binary).toBe(false);
        });

        it('should detect Java files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'src/Sample.java' }, context);

            assertToolSuccess(result);
            expect(result.language).toBe('java');
            expect(result.is_text).toBe(true);
            expect(result.is_binary).toBe(false);
        });

        it('should detect JSON files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'package.json' }, context);

            assertToolSuccess(result);
            expect(result.language).toBe('json');
            expect(result.is_text).toBe(true);
        });

        it('should detect Markdown files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.language).toBe('markdown');
            expect(result.is_text).toBe(true);
        });
    });

    describe('Binary File Detection', () => {
        it('should detect binary files', async () => {
            const binaryPath = path.resolve(process.cwd(), 'packages/event-handler/test/fixtures/binary-files');
            const context = createMockContext(binaryPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'sample.bin' }, context);

            assertToolSuccess(result);
            expect(result.is_binary).toBe(true);
            expect(result.is_text).toBe(false);
        });
    });

    describe('File Characteristics', () => {
        it('should include language and confidence', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'src/index.ts' }, context);

            assertToolSuccess(result);
            expect(result.language).toBeDefined();
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(100);
        });

        it('should include MIME type if detected', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'package.json' }, context);

            assertToolSuccess(result);
            expect(result.mime_type).toBeDefined();
        });

        it('should include path in result', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.path).toBe('README.md');
        });
    });

    describe('Language Detection', () => {
        it('should detect language from extension', async () => {
            const context = createMockContext(fixturesPath);

            const tsResult = await AnalyzeFileTypeTool.execute({ path: 'src/index.ts' }, context);
            expect(tsResult.language).toBe('typescript');

            const javaResult = await AnalyzeFileTypeTool.execute({ path: 'src/Sample.java' }, context);
            expect(javaResult.language).toBe('java');
        });

        it('should detect JSON files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'lib/config.json' }, context);

            assertToolSuccess(result);
            expect(result.language).toBe('json');
        });
    });

    describe('File Categories', () => {
        it('should detect code file language', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'src/index.ts' }, context);

            assertToolSuccess(result);
            expect(result.language).toBe('typescript');
            expect(result.is_text).toBe(true);
        });

        it('should detect JSON language', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'package.json' }, context);

            assertToolSuccess(result);
            expect(result.language).toBe('json');
        });

        it('should detect Markdown language', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.language).toBe('markdown');
        });
    });

    describe('Edge Cases', () => {
        it('should detect executable files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'README.md' }, context);

            assertToolSuccess(result);
            expect(result.is_executable).toBeDefined();
            expect(typeof result.is_executable).toBe('boolean');
        });

        it('should handle empty files', async () => {
            const edgeCasesPath = path.resolve(process.cwd(), 'packages/event-handler/test/fixtures/edge-cases');
            const context = createMockContext(edgeCasesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'empty.txt' }, context);

            assertToolSuccess(result);
            expect(result.is_text).toBe(true);
        });

        it('should handle unicode files', async () => {
            const edgeCasesPath = path.resolve(process.cwd(), 'packages/event-handler/test/fixtures/edge-cases');
            const context = createMockContext(edgeCasesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'unicode.txt' }, context);

            assertToolSuccess(result);
            expect(result.is_text).toBe(true);
            expect(result.language).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await AnalyzeFileTypeTool.execute({ path: 'test.txt' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: '' }, context);

            assertToolError(result, 'path parameter is required');
        });

        it('should return error for non-existent file', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'nonexistent-file.txt' }, context);

            assertToolError(result);
        });

        it('should return error for directories', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: 'src' }, context);

            assertToolError(result);
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: '../../../etc/passwd' }, context);

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.execute({ path: '/etc/passwd' }, context);

            assertToolError(result, 'outside work directory');
        });
    });

    describe('Mock Execution', () => {
        it('should execute normally in mock mode (read-only tool)', async () => {
            const context = createMockContext(fixturesPath);
            const result = await AnalyzeFileTypeTool.executeMock({ path: 'src/index.ts' }, context);

            assertToolSuccess(result);
            expect(result.language).toBe('typescript');
        });
    });
});
