/**
 * Tests for AppendToFileTool (FM-002)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { AppendToFileTool } from '../../../../../src/agent/tools/repo_write/append_to_file.js';
import { createMockContext } from '../../../../helpers/mock-context.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';

describe.sequential('AppendToFileTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `append-file-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fse.ensureDir(tempDir);
    });

    // Clean up temp directory after each test
    afterEach(async () => {
        if (tempDir) {
            try {
                await fse.remove(tempDir);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });

    describe('Basic Functionality', () => {
        it('should have correct tool metadata', () => {
            expect(AppendToFileTool.name).toBe('repo_write-append_to_file');
            expect(AppendToFileTool.description).toContain('Append content');
            expect(AppendToFileTool.input_schema.required).toContain('path');
            expect(AppendToFileTool.input_schema.required).toContain('content');
        });

        it('should append content to existing file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            // Create initial file
            await fs.writeFile(filePath, 'Line 1');

            const result = await AppendToFileTool.execute(
                { path: 'test.txt', content: 'Line 2' },
                context,
            );

            assertToolSuccess(result);
            expect(result.path).toBe('test.txt');
            expect(result.bytes_appended).toBeGreaterThan(0);
            expect(result.new_size).toBeGreaterThan(6); // "Line 1" is 6 bytes

            // Verify content was appended
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nLine 2');
        });

        it('should append multiple times', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'log.txt');

            // Create initial file
            await fs.writeFile(filePath, 'Entry 1');

            // Append twice
            await AppendToFileTool.execute({ path: 'log.txt', content: 'Entry 2' }, context);
            const result = await AppendToFileTool.execute(
                { path: 'log.txt', content: 'Entry 3' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Entry 1\nEntry 2\nEntry 3');
        });

        it('should append empty content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Original');

            const result = await AppendToFileTool.execute({ path: 'test.txt', content: '' }, context);

            assertToolSuccess(result);
            expect(result.bytes_appended).toBe(1); // Just the newline

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Original\n');
        });

        it('should return correct byte counts', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Start');
            const appendText = 'Added';

            const result = await AppendToFileTool.execute(
                { path: 'test.txt', content: appendText },
                context,
            );

            assertToolSuccess(result);
            // bytes_appended = newline (1) + content length
            expect(result.bytes_appended).toBe(appendText.length + 1);
            expect(result.new_size).toBe(5 + appendText.length + 1); // "Start" = 5 bytes
        });
    });

    describe('Newline Behavior', () => {
        it('should add newline by default', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'First');

            await AppendToFileTool.execute({ path: 'test.txt', content: 'Second' }, context);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('First\nSecond');
        });

        it('should add newline when newline is true', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'First');

            await AppendToFileTool.execute(
                { path: 'test.txt', content: 'Second', newline: true },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('First\nSecond');
        });

        it('should not add newline when newline is false', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'First');

            const result = await AppendToFileTool.execute(
                { path: 'test.txt', content: 'Second', newline: false },
                context,
            );

            assertToolSuccess(result);
            expect(result.bytes_appended).toBe(6); // "Second" without newline

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('FirstSecond');
        });

        it('should handle multiple appends with mixed newline settings', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Start');
            await AppendToFileTool.execute({ path: 'test.txt', content: ' Middle', newline: false }, context);
            await AppendToFileTool.execute({ path: 'test.txt', content: 'End', newline: true }, context);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Start Middle\nEnd');
        });
    });

    describe('File Existence', () => {
        it('should return error when file does not exist', async () => {
            const context = createMockContext(tempDir);

            const result = await AppendToFileTool.execute(
                { path: 'nonexistent.txt', content: 'test' },
                context,
            );

            assertToolError(result, 'File does not exist');
        });

        it('should work with existing file in subdirectory', async () => {
            const context = createMockContext(tempDir);
            const subdir = path.join(tempDir, 'sub');
            await fse.ensureDir(subdir);

            const filePath = path.join(subdir, 'file.txt');
            await fs.writeFile(filePath, 'Content');

            const result = await AppendToFileTool.execute(
                { path: 'sub/file.txt', content: 'More' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Content\nMore');
        });

        it('should return error for directory path', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'subdir');
            await fse.ensureDir(dirPath);

            const result = await AppendToFileTool.execute(
                { path: 'subdir', content: 'test' },
                context,
            );

            // Will fail because it's a directory, not a file
            expect(result.error).toBe(true);
        });
    });

    describe('Content Types', () => {
        it('should append multi-line content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Header');

            const multiLine = 'Line 1\nLine 2\nLine 3';
            await AppendToFileTool.execute({ path: 'test.txt', content: multiLine }, context);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Header\nLine 1\nLine 2\nLine 3');
        });

        it('should append unicode content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'English');

            const unicode = '中文 🎉';
            await AppendToFileTool.execute({ path: 'test.txt', content: unicode }, context);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('English\n中文 🎉');
        });

        it('should append special characters', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Normal');

            const special = 'Tab:\t Quote:" Backslash:\\';
            await AppendToFileTool.execute({ path: 'test.txt', content: special }, context);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain(special);
        });

        it('should append JSON content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'data.json');

            await fs.writeFile(filePath, '{"items": [1');

            const jsonFragment = ', 2, 3]}';
            await AppendToFileTool.execute(
                { path: 'data.json', content: jsonFragment, newline: false },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed.items).toEqual([1, 2, 3]);
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await AppendToFileTool.execute(
                { path: 'test.txt', content: 'test' },
                context,
            );

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await AppendToFileTool.execute({ path: '', content: 'test' }, context);

            assertToolError(result, 'path parameter is required');
        });

        it('should validate path is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await AppendToFileTool.execute(
                { path: 123 as any, content: 'test' },
                context,
            );

            assertToolError(result, 'must be a string');
        });

        it('should require content parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await AppendToFileTool.execute(
                { path: 'test.txt', content: undefined as any },
                context,
            );

            assertToolError(result, 'content parameter is required');
        });

        it('should handle null content', async () => {
            const context = createMockContext(tempDir);
            const result = await AppendToFileTool.execute(
                { path: 'test.txt', content: null as any },
                context,
            );

            assertToolError(result, 'content parameter is required');
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const result = await AppendToFileTool.execute(
                { path: '../../../etc/passwd', content: 'malicious' },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await AppendToFileTool.execute(
                { path: '/tmp/malicious.txt', content: 'malicious' },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should allow absolute paths within workDir', async () => {
            const context = createMockContext(tempDir);
            const absolutePath = path.join(tempDir, 'allowed.txt');

            // Create the file first
            await fs.writeFile(absolutePath, 'Original');

            const result = await AppendToFileTool.execute(
                { path: absolutePath, content: 'Appended' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(absolutePath, 'utf-8');
            expect(content).toBe('Original\nAppended');
        });
    });

    describe('Path Handling', () => {
        it('should handle relative paths with ./', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Start');

            const result = await AppendToFileTool.execute(
                { path: './test.txt', content: 'End' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Start\nEnd');
        });

        it('should handle nested directory paths', async () => {
            const context = createMockContext(tempDir);
            const nestedPath = path.join(tempDir, 'a', 'b', 'c');
            await fse.ensureDir(nestedPath);

            const filePath = path.join(nestedPath, 'deep.txt');
            await fs.writeFile(filePath, 'Deep');

            const result = await AppendToFileTool.execute(
                { path: 'a/b/c/deep.txt', content: 'Content' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Deep\nContent');
        });
    });

    describe('Mock Execution', () => {
        it('should not append in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Original');

            const result = await AppendToFileTool.executeMock(
                { path: 'test.txt', content: 'Should not append' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.path).toBe('test.txt');
            expect(result.bytes_appended).toBe(18); // "\nShould not append" = 18 bytes

            // Verify original content is unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Original');
        });

        it('should calculate correct sizes in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Start'); // 5 bytes

            const result = await AppendToFileTool.executeMock(
                { path: 'test.txt', content: 'More', newline: true },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.bytes_appended).toBe(5); // "\nMore" = 5 bytes
            expect(result.new_size).toBe(10); // 5 + 5

            // Verify nothing changed
            const stats = await fs.stat(filePath);
            expect(stats.size).toBe(5);
        });

        it('should respect newline parameter in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Start'); // 5 bytes

            const result = await AppendToFileTool.executeMock(
                { path: 'test.txt', content: 'More', newline: false },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.bytes_appended).toBe(4); // "More" without newline = 4 bytes
            expect(result.new_size).toBe(9); // 5 + 4
        });

        it('should return error in mock mode when file does not exist', async () => {
            const context = createMockContext(tempDir);

            const result = await AppendToFileTool.executeMock(
                { path: 'nonexistent.txt', content: 'test' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('File does not exist');
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await AppendToFileTool.executeMock(
                { path: '../../../etc/passwd', content: 'malicious' },
                context,
            );

            // Validation errors don't include dry_run field
            expect(result.error).toBe(true);
            expect(result.message).toContain('outside work directory');
        });

        it('should validate input in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await AppendToFileTool.executeMock(
                { path: '', content: 'test' },
                context,
            );

            // Validation errors don't include dry_run field
            expect(result.error).toBe(true);
            expect(result.message).toContain('path parameter is required');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should append log entries', async () => {
            const context = createMockContext(tempDir);
            const logPath = path.join(tempDir, 'app.log');

            await fs.writeFile(logPath, '[2024-01-01 10:00:00] Application started');

            await AppendToFileTool.execute(
                { path: 'app.log', content: '[2024-01-01 10:01:00] User logged in' },
                context,
            );
            await AppendToFileTool.execute(
                { path: 'app.log', content: '[2024-01-01 10:02:00] Data processed' },
                context,
            );

            const content = await fs.readFile(logPath, 'utf-8');
            const lines = content.split('\n');
            expect(lines).toHaveLength(3);
            expect(lines[0]).toContain('Application started');
            expect(lines[1]).toContain('User logged in');
            expect(lines[2]).toContain('Data processed');
        });

        it('should append to CSV file', async () => {
            const context = createMockContext(tempDir);
            const csvPath = path.join(tempDir, 'data.csv');

            await fs.writeFile(csvPath, 'name,age,city\nAlice,30,NYC');

            await AppendToFileTool.execute({ path: 'data.csv', content: 'Bob,25,LA' }, context);
            await AppendToFileTool.execute({ path: 'data.csv', content: 'Charlie,35,SF' }, context);

            const content = await fs.readFile(csvPath, 'utf-8');
            const lines = content.split('\n');
            expect(lines).toHaveLength(4);
            expect(lines[0]).toBe('name,age,city');
            expect(lines[1]).toBe('Alice,30,NYC');
            expect(lines[2]).toBe('Bob,25,LA');
            expect(lines[3]).toBe('Charlie,35,SF');
        });

        it('should build markdown list', async () => {
            const context = createMockContext(tempDir);
            const mdPath = path.join(tempDir, 'todo.md');

            await fs.writeFile(mdPath, '# TODO\n\n- [ ] Task 1');

            await AppendToFileTool.execute({ path: 'todo.md', content: '- [ ] Task 2' }, context);
            await AppendToFileTool.execute({ path: 'todo.md', content: '- [x] Task 3 (done)' }, context);

            const content = await fs.readFile(mdPath, 'utf-8');
            expect(content).toContain('- [ ] Task 1');
            expect(content).toContain('- [ ] Task 2');
            expect(content).toContain('- [x] Task 3 (done)');
        });

        it('should concatenate code snippets', async () => {
            const context = createMockContext(tempDir);
            const codePath = path.join(tempDir, 'combined.js');

            await fs.writeFile(codePath, '// Module A\nfunction moduleA() { return "A"; }');

            await AppendToFileTool.execute(
                {
                    path: 'combined.js',
                    content: '\n// Module B\nfunction moduleB() { return "B"; }',
                },
                context,
            );

            const content = await fs.readFile(codePath, 'utf-8');
            expect(content).toContain('Module A');
            expect(content).toContain('Module B');
            expect(content).toContain('function moduleA()');
            expect(content).toContain('function moduleB()');
        });
    });
});
