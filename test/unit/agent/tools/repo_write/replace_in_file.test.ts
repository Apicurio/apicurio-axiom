/**
 * Tests for ReplaceInFileTool (FM-004)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReplaceInFileTool } from '../../../../../src/agent/tools/repo_write/replace_in_file.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';

describe.sequential('ReplaceInFileTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `replace-file-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            expect(ReplaceInFileTool.name).toBe('repo_write-replace_in_file');
            expect(ReplaceInFileTool.description).toContain('Search for text');
            expect(ReplaceInFileTool.input_schema.required).toContain('path');
            expect(ReplaceInFileTool.input_schema.required).toContain('search');
            expect(ReplaceInFileTool.input_schema.required).toContain('replace');
        });

        it('should replace literal text', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Hello World! Hello Universe!');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'Hello', replace: 'Hi' },
                context,
            );

            assertToolSuccess(result);
            expect(result.path).toBe('test.txt');
            expect(result.replacements_made).toBe(2); // Both occurrences
            expect(result.lines_affected).toEqual([1]);
            expect(result.preview).toBeDefined();

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Hi World! Hi Universe!');
        });

        it('should return success with 0 replacements when no match found', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Hello World');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'Goodbye', replace: 'Hi' },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(0);
            expect(result.lines_affected).toEqual([]);
            expect(result.preview).toBe('');

            // Content should be unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Hello World');
        });

        it('should handle multi-line files', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1: foo\nLine 2: bar\nLine 3: foo');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'foo', replace: 'baz' },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(2);
            expect(result.lines_affected).toContain(1);
            expect(result.lines_affected).toContain(3);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1: baz\nLine 2: bar\nLine 3: baz');
        });
    });

    describe('All Occurrences Control', () => {
        it('should replace all occurrences by default', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'foo foo foo');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'foo', replace: 'bar' },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(3);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('bar bar bar');
        });

        it('should replace all when all_occurrences is true', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'foo foo foo');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'foo', replace: 'bar', all_occurrences: true },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(3);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('bar bar bar');
        });

        it('should replace only first occurrence when all_occurrences is false', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'foo foo foo');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'foo', replace: 'bar', all_occurrences: false },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(1);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('bar foo foo');
        });
    });

    describe('Regex Support', () => {
        it('should support basic regex patterns', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'abc123 def456 ghi789');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: '\\d+', replace: 'NUM', regex: true },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(3);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('abcNUM defNUM ghiNUM');
        });

        it('should match with regex patterns', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'firstName lastName');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: '\\w+Name', replace: 'newName', regex: true },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(2); // firstName and lastName

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('newName newName');
        });

        it('should support word boundaries', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'test testing tested');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: '\\btest\\b', replace: 'exam', regex: true },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(1); // Only matches standalone "test"

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('exam testing tested');
        });

        it('should return error for invalid regex', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'content');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: '[invalid(regex', replace: 'x', regex: true },
                context,
            );

            assertToolError(result, 'Invalid regex pattern');
        });

        it('should escape special regex characters in literal mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Price: $10.50');

            // In literal mode, $10.50 should match literally, not as regex
            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: '$10.50', replace: '$20.00', regex: false },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(1);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Price: $20.00');
        });

        it('should handle parentheses in literal search', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'function(arg) { }');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'function(arg)', replace: 'method(param)', regex: false },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('method(param) { }');
        });
    });

    describe('Case Preservation', () => {
        it('should not preserve case by default', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'hello HELLO Hello');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'hello', replace: 'goodbye' },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(1); // Only lowercase "hello"

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('goodbye HELLO Hello');
        });

        it('should preserve case when preserve_case is true', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'hello HELLO Hello');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'hello', replace: 'goodbye', preserve_case: true },
                context,
            );

            assertToolSuccess(result);
            expect(result.replacements_made).toBe(3);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('goodbye GOODBYE Goodbye');
        });

        it('should preserve all uppercase', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'ERROR WARNING INFO');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'error', replace: 'critical', preserve_case: true },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('CRITICAL WARNING INFO');
        });

        it('should preserve all lowercase', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'error warning info');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'ERROR', replace: 'CRITICAL', preserve_case: true },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('critical warning info');
        });

        it('should preserve title case', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Error Warning Info');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'error', replace: 'critical', preserve_case: true },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Critical Warning Info');
        });
    });

    describe('File Existence', () => {
        it('should return error when file does not exist', async () => {
            const context = createMockContext(tempDir);

            const result = await ReplaceInFileTool.execute(
                { path: 'nonexistent.txt', search: 'foo', replace: 'bar' },
                context,
            );

            assertToolError(result, 'File does not exist');
        });

        it('should work with file in subdirectory', async () => {
            const context = createMockContext(tempDir);
            const subdir = path.join(tempDir, 'sub');
            await fse.ensureDir(subdir);

            const filePath = path.join(subdir, 'file.txt');
            await fs.writeFile(filePath, 'old text');

            const result = await ReplaceInFileTool.execute(
                { path: 'sub/file.txt', search: 'old', replace: 'new' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('new text');
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'foo', replace: 'bar' },
                context,
            );

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceInFileTool.execute({ path: '', search: 'foo', replace: 'bar' }, context);

            assertToolError(result, 'path parameter is required');
        });

        it('should validate path is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceInFileTool.execute(
                { path: 123 as any, search: 'foo', replace: 'bar' },
                context,
            );

            assertToolError(result, 'must be a string');
        });

        it('should require search parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: undefined as any, replace: 'bar' },
                context,
            );

            assertToolError(result, 'search parameter is required');
        });

        it('should validate search is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 123 as any, replace: 'bar' },
                context,
            );

            assertToolError(result, 'must be a string');
        });

        it('should require replace parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'foo', replace: undefined as any },
                context,
            );

            assertToolError(result, 'replace parameter is required');
        });

        it('should validate replace is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'foo', replace: 123 as any },
                context,
            );

            assertToolError(result, 'must be a string');
        });

        it('should allow empty string replacements', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Hello World');

            const result = await ReplaceInFileTool.execute(
                { path: 'test.txt', search: 'Hello ', replace: '' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('World');
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceInFileTool.execute(
                { path: '../../../etc/passwd', search: 'foo', replace: 'bar' },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceInFileTool.execute(
                { path: '/tmp/malicious.txt', search: 'foo', replace: 'bar' },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should allow absolute paths within workDir', async () => {
            const context = createMockContext(tempDir);
            const absolutePath = path.join(tempDir, 'allowed.txt');

            await fs.writeFile(absolutePath, 'old content');

            const result = await ReplaceInFileTool.execute(
                { path: absolutePath, search: 'old', replace: 'new' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(absolutePath, 'utf-8');
            expect(content).toBe('new content');
        });
    });

    describe('Mock Execution', () => {
        it('should not modify file in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Hello World');

            const result = await ReplaceInFileTool.executeMock(
                { path: 'test.txt', search: 'Hello', replace: 'Goodbye' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.path).toBe('test.txt');
            expect(result.replacements_made).toBe(1);

            // Verify original content unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Hello World');
        });

        it('should calculate correct replacement count in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'foo bar foo baz foo');

            const result = await ReplaceInFileTool.executeMock(
                { path: 'test.txt', search: 'foo', replace: 'qux' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.replacements_made).toBe(3);
        });

        it('should respect all_occurrences in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'foo foo foo');

            const result = await ReplaceInFileTool.executeMock(
                { path: 'test.txt', search: 'foo', replace: 'bar', all_occurrences: false },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.replacements_made).toBe(1);
        });

        it('should validate regex in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'content');

            const result = await ReplaceInFileTool.executeMock(
                { path: 'test.txt', search: '[invalid', replace: 'x', regex: true },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Invalid regex pattern');
        });

        it('should validate file existence in mock mode', async () => {
            const context = createMockContext(tempDir);

            const result = await ReplaceInFileTool.executeMock(
                { path: 'nonexistent.txt', search: 'foo', replace: 'bar' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('File does not exist');
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceInFileTool.executeMock(
                { path: '../../../etc/passwd', search: 'foo', replace: 'bar' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('outside work directory');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should update version numbers', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'package.json');

            const packageJson = '{\n  "name": "myapp",\n  "version": "1.0.0"\n}';
            await fs.writeFile(filePath, packageJson);

            await ReplaceInFileTool.execute(
                { path: 'package.json', search: '"version": "1.0.0"', replace: '"version": "1.1.0"' },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('"version": "1.1.0"');
        });

        it('should refactor function names', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'code.ts');

            await fs.writeFile(filePath, 'function oldName() { }\nconst x = oldName();');

            await ReplaceInFileTool.execute(
                { path: 'code.ts', search: 'oldName', replace: 'newName', all_occurrences: true },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('function newName() { }\nconst x = newName();');
        });

        it('should update import paths', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'module.ts');

            await fs.writeFile(
                filePath,
                "import { util } from './old/path';\nimport { helper } from './old/path/helper';",
            );

            await ReplaceInFileTool.execute(
                { path: 'module.ts', search: './old/path', replace: './new/path', all_occurrences: true },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain("from './new/path'");
            expect(content).toContain("from './new/path/helper'");
        });

        it('should fix typos in documentation', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'README.md');

            await fs.writeFile(filePath, '# Documenation\n\nThis is teh documentation.');

            await ReplaceInFileTool.execute(
                { path: 'README.md', search: 'Documenation', replace: 'Documentation' },
                context,
            );

            await ReplaceInFileTool.execute({ path: 'README.md', search: 'teh', replace: 'the' }, context);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('# Documentation\n\nThis is the documentation.');
        });

        it('should normalize line endings', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(filePath, 'Line 1\r\nLine 2\r\nLine 3');

            await ReplaceInFileTool.execute(
                { path: 'file.txt', search: '\\r\\n', replace: '\n', regex: true },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nLine 2\nLine 3');
        });

        it('should update API endpoints with regex', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'api.ts');

            await fs.writeFile(
                filePath,
                'const url1 = "http://api.example.com/v1/users";\nconst url2 = "http://api.example.com/v1/posts";',
            );

            await ReplaceInFileTool.execute(
                {
                    path: 'api.ts',
                    search: 'http://api\\.example\\.com/v1',
                    replace: 'https://api.example.com/v2',
                    regex: true,
                },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('https://api.example.com/v2/users');
            expect(content).toContain('https://api.example.com/v2/posts');
        });
    });
});
