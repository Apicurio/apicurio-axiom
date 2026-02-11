/**
 * Tests for InsertAtLineTool (FM-003)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { InsertAtLineTool } from '../../../../../src/agent/tools/repo_write/insert_at_line.js';
import { createMockContext } from '../../../../helpers/mock-context.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';

describe.sequential('InsertAtLineTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `insert-line-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            expect(InsertAtLineTool.name).toBe('repo_write-insert_at_line');
            expect(InsertAtLineTool.description).toContain('Insert content');
            expect(InsertAtLineTool.input_schema.required).toContain('path');
            expect(InsertAtLineTool.input_schema.required).toContain('line');
            expect(InsertAtLineTool.input_schema.required).toContain('content');
        });

        it('should insert content at specified line', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 2, content: 'Inserted' },
                context,
            );

            assertToolSuccess(result);
            expect(result.path).toBe('test.txt');
            expect(result.lines_inserted).toBe(1);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nInserted\nLine 2\nLine 3');
        });

        it('should insert at beginning of file (line 1)', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Original Line');

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 1, content: 'First' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('First\nOriginal Line');
        });

        it('should insert at end of file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2');

            // File has 2 lines, so line 3 is after the last line
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 3, content: 'Last' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nLine 2\nLast');
        });

        it('should insert multi-line content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 4');

            const multiLine = 'Line 2\nLine 3';
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 2, content: multiLine },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_inserted).toBe(2);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nLine 2\nLine 3\nLine 4');
        });

        it('should insert empty content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2');

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 2, content: '' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_inserted).toBe(1); // Even empty string counts as 1 line

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\n\nLine 2');
        });
    });

    describe('Line Number Behavior', () => {
        it('should use 1-based line numbering', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'A\nB\nC');

            // Line 1 should insert before 'A'
            await InsertAtLineTool.execute({ path: 'test.txt', line: 1, content: 'Start' }, context);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Start\nA\nB\nC');
        });

        it('should allow insertion after last line', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            // File has 3 lines, insert at line 4
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 4, content: 'Line 4' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nLine 2\nLine 3\nLine 4');
        });

        it('should reject line number 0', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Content');

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 0, content: 'test' },
                context,
            );

            assertToolError(result, 'must be a number >= 1');
        });

        it('should reject negative line numbers', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Content');

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: -5, content: 'test' },
                context,
            );

            assertToolError(result, 'must be a number >= 1');
        });

        it('should reject line number beyond file bounds', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2');

            // File has 2 lines, max valid is 3 (after last line)
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 10, content: 'test' },
                context,
            );

            assertToolError(result, 'Invalid line number');
            expect(result.message).toContain('valid range: 1-3');
        });
    });

    describe('Indentation Matching', () => {
        it('should not add indentation by default', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\n    Indented\nLine 3');

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 2, content: 'New' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nNew\n    Indented\nLine 3');
        });

        it('should match indentation when indent is true', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\n    Indented\nLine 3');

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 2, content: 'New', indent: true },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\n    New\n    Indented\nLine 3');
        });

        it('should match multi-level indentation', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'class Foo {\n        method() {\n            code();\n        }\n}');

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 3, content: 'newLine();', indent: true },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('            newLine();');
        });

        it('should match indentation for multi-line content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'function test() {\n    existing();\n}');

            const multiLine = 'const x = 1;\nconst y = 2;';
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 2, content: multiLine, indent: true },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('    const x = 1;');
            expect(content).toContain('    const y = 2;');
        });

        it('should not indent empty lines in multi-line content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'function test() {\n    code();\n}');

            const multiLine = 'line1\n\nline3';
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 2, content: multiLine, indent: true },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            expect(lines[1]).toBe('    line1');
            expect(lines[2]).toBe(''); // Empty line should stay empty
            expect(lines[3]).toBe('    line3');
        });

        it('should handle tabs in indentation', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'class Foo {\n\tmethod() {}\n}');

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 2, content: 'field: string;', indent: true },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('\tfield: string;');
        });

        it('should use previous line indentation when inserting at end', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'function test() {\n    return 42;');

            // Insert at line 3 (after "return 42;", which is the last line)
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 3, content: 'console.log();', indent: true },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            // When inserting after the last line, it uses the previous line's indentation
            expect(content).toContain('    console.log();');
        });
    });

    describe('File Existence', () => {
        it('should return error when file does not exist', async () => {
            const context = createMockContext(tempDir);

            const result = await InsertAtLineTool.execute(
                { path: 'nonexistent.txt', line: 1, content: 'test' },
                context,
            );

            assertToolError(result, 'File does not exist');
        });

        it('should work with file in subdirectory', async () => {
            const context = createMockContext(tempDir);
            const subdir = path.join(tempDir, 'sub');
            await fse.ensureDir(subdir);

            const filePath = path.join(subdir, 'file.txt');
            await fs.writeFile(filePath, 'Original');

            const result = await InsertAtLineTool.execute(
                { path: 'sub/file.txt', line: 1, content: 'New' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('New\nOriginal');
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 1, content: 'test' },
                context,
            );

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.execute(
                { path: '', line: 1, content: 'test' },
                context,
            );

            assertToolError(result, 'path parameter is required');
        });

        it('should validate path is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.execute(
                { path: 123 as any, line: 1, content: 'test' },
                context,
            );

            assertToolError(result, 'must be a string');
        });

        it('should require line parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: undefined as any, content: 'test' },
                context,
            );

            assertToolError(result, 'line parameter is required');
        });

        it('should validate line is a number', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 'two' as any, content: 'test' },
                context,
            );

            assertToolError(result, 'must be a number >= 1');
        });

        it('should require content parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 1, content: undefined as any },
                context,
            );

            assertToolError(result, 'content parameter is required');
        });

        it('should handle null content', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.execute(
                { path: 'test.txt', line: 1, content: null as any },
                context,
            );

            assertToolError(result, 'content parameter is required');
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.execute(
                { path: '../../../etc/passwd', line: 1, content: 'malicious' },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.execute(
                { path: '/tmp/malicious.txt', line: 1, content: 'malicious' },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should allow absolute paths within workDir', async () => {
            const context = createMockContext(tempDir);
            const absolutePath = path.join(tempDir, 'allowed.txt');

            await fs.writeFile(absolutePath, 'Original');

            const result = await InsertAtLineTool.execute(
                { path: absolutePath, line: 1, content: 'Inserted' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(absolutePath, 'utf-8');
            expect(content).toBe('Inserted\nOriginal');
        });
    });

    describe('Mock Execution', () => {
        it('should not modify file in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2');

            const result = await InsertAtLineTool.executeMock(
                { path: 'test.txt', line: 2, content: 'Should not insert' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.path).toBe('test.txt');
            expect(result.lines_inserted).toBe(1);

            // Verify original content unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nLine 2');
        });

        it('should calculate correct line count in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1');

            const multiLine = 'Line A\nLine B\nLine C';
            const result = await InsertAtLineTool.executeMock(
                { path: 'test.txt', line: 1, content: multiLine },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.lines_inserted).toBe(3);
        });

        it('should validate line number in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2');

            const result = await InsertAtLineTool.executeMock(
                { path: 'test.txt', line: 10, content: 'test' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Invalid line number');
        });

        it('should validate file existence in mock mode', async () => {
            const context = createMockContext(tempDir);

            const result = await InsertAtLineTool.executeMock(
                { path: 'nonexistent.txt', line: 1, content: 'test' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('File does not exist');
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.executeMock(
                { path: '../../../etc/passwd', line: 1, content: 'malicious' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('outside work directory');
        });

        it('should validate input in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await InsertAtLineTool.executeMock(
                { path: '', line: 1, content: 'test' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('path parameter is required');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should add import statement at top of file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'module.ts');

            await fs.writeFile(filePath, "export function hello() {\n    return 'world';\n}");

            await InsertAtLineTool.execute(
                { path: 'module.ts', line: 1, content: "import { util } from './util';" },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain("import { util } from './util';");
            expect(content.split('\n')[0]).toContain('import');
        });

        it('should add method to class with proper indentation', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'class.ts');

            const classCode = `class MyClass {
    constructor() {}

    existingMethod() {
        return true;
    }
}`;
            await fs.writeFile(filePath, classCode);

            const newMethod = `newMethod() {\n        return false;\n    }`;
            await InsertAtLineTool.execute(
                { path: 'class.ts', line: 6, content: newMethod, indent: true },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('newMethod()');
            expect(content).toContain('    newMethod()');
        });

        it('should insert comment above function', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'code.js');

            await fs.writeFile(filePath, 'function add(a, b) {\n    return a + b;\n}');

            const comment = '/**\n * Adds two numbers\n */';
            await InsertAtLineTool.execute({ path: 'code.js', line: 1, content: comment }, context);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('/**');
            expect(content).toContain('* Adds two numbers');
        });

        it('should add test case to test suite', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.spec.ts');

            const testCode = `describe('Calculator', () => {
    it('should add', () => {
        expect(add(1, 2)).toBe(3);
    });
});`;
            await fs.writeFile(filePath, testCode);

            const newTest = `    it('should subtract', () => {
        expect(subtract(5, 3)).toBe(2);
    });`;
            await InsertAtLineTool.execute({ path: 'test.spec.ts', line: 4, content: newTest }, context);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('should add');
            expect(content).toContain('should subtract');
        });

        it('should insert JSON property into object', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'config.json');

            await fs.writeFile(filePath, '{\n    "name": "myapp",\n    "version": "1.0.0"\n}');

            await InsertAtLineTool.execute(
                { path: 'config.json', line: 3, content: '    "author": "John Doe",' },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed.name).toBe('myapp');
            expect(parsed.author).toBe('John Doe');
            expect(parsed.version).toBe('1.0.0');
        });

        it('should add error handling to function', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'api.ts');

            const apiCode = `async function fetchData(url: string) {
    const response = await fetch(url);
    return response.json();
}`;
            await fs.writeFile(filePath, apiCode);

            const errorHandling = `    if (!response.ok) {
        throw new Error('Request failed');
    }`;
            await InsertAtLineTool.execute(
                { path: 'api.ts', line: 3, content: errorHandling, indent: true },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('if (!response.ok)');
            expect(content).toContain("throw new Error('Request failed')");
        });
    });
});
