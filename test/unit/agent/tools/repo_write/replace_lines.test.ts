/**
 * Tests for ReplaceLinesTool (FM-005)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { ReplaceLinesTool } from '../../../../../src/agent/tools/repo_write/replace_lines.js';
import { createMockContext } from '../../../../helpers/mock-context.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';

describe.sequential('ReplaceLinesTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `replace-lines-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            expect(ReplaceLinesTool.name).toBe('repo_write-replace_lines');
            expect(ReplaceLinesTool.description).toContain('Replace a range of lines');
            expect(ReplaceLinesTool.input_schema.required).toContain('path');
            expect(ReplaceLinesTool.input_schema.required).toContain('start_line');
            expect(ReplaceLinesTool.input_schema.required).toContain('end_line');
            expect(ReplaceLinesTool.input_schema.required).toContain('new_content');
        });

        it('should replace a single line', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 2, end_line: 2, new_content: 'New Line 2' },
                context,
            );

            assertToolSuccess(result);
            expect(result.path).toBe('test.txt');
            expect(result.lines_replaced).toBe(1);
            expect(result.old_content).toBe('Line 2');

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nNew Line 2\nLine 3');
        });

        it('should replace multiple lines', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 2, end_line: 4, new_content: 'New Lines\n2-4' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(3);
            expect(result.old_content).toBe('Line 2\nLine 3\nLine 4');

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nNew Lines\n2-4\nLine 5');
        });

        it('should replace entire file content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: 3, new_content: 'Completely New Content' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(3);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Completely New Content');
        });

        it('should preserve old content in result', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'First\nSecond\nThird');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: 2, new_content: 'Replaced' },
                context,
            );

            assertToolSuccess(result);
            expect(result.old_content).toBe('First\nSecond');
        });
    });

    describe('Line Range Handling', () => {
        it('should replace first line', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: 1, new_content: 'New First' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(1);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('New First\nLine 2\nLine 3');
        });

        it('should replace last line', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 3, end_line: 3, new_content: 'New Last' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(1);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nLine 2\nNew Last');
        });

        it('should replace middle lines', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 2, end_line: 4, new_content: 'Middle Replaced' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(3);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nMiddle Replaced\nLine 5');
        });

        it('should handle single-line file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Only Line');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: 1, new_content: 'Replaced' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(1);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Replaced');
        });
    });

    describe('New Content Variations', () => {
        it('should handle empty string replacement', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 2, end_line: 2, new_content: '' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(1);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\n\nLine 3');
        });

        it('should replace with fewer lines than removed', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 2, end_line: 4, new_content: 'Single' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(3);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nSingle\nLine 5');
        });

        it('should replace with more lines than removed', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 2, end_line: 2, new_content: 'New 1\nNew 2\nNew 3' },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(1);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nNew 1\nNew 2\nNew 3\nLine 3');
        });

        it('should handle multi-line new content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.execute(
                {
                    path: 'test.txt',
                    start_line: 1,
                    end_line: 3,
                    new_content: 'First\nSecond\nThird\nFourth',
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.lines_replaced).toBe(3);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('First\nSecond\nThird\nFourth');
        });
    });

    describe('File Existence', () => {
        it('should return error when file does not exist', async () => {
            const context = createMockContext(tempDir);

            const result = await ReplaceLinesTool.execute(
                { path: 'nonexistent.txt', start_line: 1, end_line: 1, new_content: 'text' },
                context,
            );

            assertToolError(result, 'File does not exist');
        });

        it('should work with file in subdirectory', async () => {
            const context = createMockContext(tempDir);
            const subdir = path.join(tempDir, 'sub');
            await fse.ensureDir(subdir);

            const filePath = path.join(subdir, 'file.txt');
            await fs.writeFile(filePath, 'Line 1\nLine 2');

            const result = await ReplaceLinesTool.execute(
                { path: 'sub/file.txt', start_line: 1, end_line: 1, new_content: 'Replaced' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Replaced\nLine 2');
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: 1, new_content: 'text' },
                context,
            );

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: '', start_line: 1, end_line: 1, new_content: 'text' },
                context,
            );

            assertToolError(result, 'path parameter is required');
        });

        it('should validate path is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: 123 as any, start_line: 1, end_line: 1, new_content: 'text' },
                context,
            );

            assertToolError(result, 'must be a string');
        });

        it('should require start_line parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: undefined as any, end_line: 1, new_content: 'text' },
                context,
            );

            assertToolError(result, 'start_line parameter is required');
        });

        it('should validate start_line is a number', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: '1' as any, end_line: 1, new_content: 'text' },
                context,
            );

            assertToolError(result, 'start_line parameter is required');
        });

        it('should validate start_line is >= 1', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 0, end_line: 1, new_content: 'text' },
                context,
            );

            assertToolError(result, 'must be a number >= 1');
        });

        it('should require end_line parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: undefined as any, new_content: 'text' },
                context,
            );

            assertToolError(result, 'end_line parameter is required');
        });

        it('should validate end_line is a number', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: '1' as any, new_content: 'text' },
                context,
            );

            assertToolError(result, 'end_line parameter is required');
        });

        it('should validate end_line is >= 1', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: 0, new_content: 'text' },
                context,
            );

            assertToolError(result, 'must be a number >= 1');
        });

        it('should require new_content parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: 1, new_content: undefined as any },
                context,
            );

            assertToolError(result, 'new_content parameter is required');
        });

        it('should validate start_line <= end_line', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 5, end_line: 3, new_content: 'text' },
                context,
            );

            assertToolError(result, 'start_line (5) must be <= end_line (3)');
        });

        it('should validate start_line is within file bounds', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 10, end_line: 10, new_content: 'text' },
                context,
            );

            assertToolError(result, 'start_line (10) is beyond end of file');
        });

        it('should validate end_line is within file bounds', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.execute(
                { path: 'test.txt', start_line: 1, end_line: 10, new_content: 'text' },
                context,
            );

            assertToolError(result, 'end_line (10) is beyond end of file');
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: '../../../etc/passwd', start_line: 1, end_line: 1, new_content: 'text' },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.execute(
                { path: '/tmp/malicious.txt', start_line: 1, end_line: 1, new_content: 'text' },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should allow absolute paths within workDir', async () => {
            const context = createMockContext(tempDir);
            const absolutePath = path.join(tempDir, 'allowed.txt');

            await fs.writeFile(absolutePath, 'Line 1\nLine 2');

            const result = await ReplaceLinesTool.execute(
                { path: absolutePath, start_line: 1, end_line: 1, new_content: 'Replaced' },
                context,
            );

            assertToolSuccess(result);

            const content = await fs.readFile(absolutePath, 'utf-8');
            expect(content).toBe('Replaced\nLine 2');
        });
    });

    describe('Mock Execution', () => {
        it('should not modify file in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.executeMock(
                { path: 'test.txt', start_line: 2, end_line: 2, new_content: 'Replaced' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.path).toBe('test.txt');
            expect(result.lines_replaced).toBe(1);
            expect(result.old_content).toBe('Line 2');

            // Verify original content unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Line 1\nLine 2\nLine 3');
        });

        it('should calculate correct lines_replaced in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3\nLine 4');

            const result = await ReplaceLinesTool.executeMock(
                { path: 'test.txt', start_line: 2, end_line: 4, new_content: 'New' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.lines_replaced).toBe(3);
            expect(result.old_content).toBe('Line 2\nLine 3\nLine 4');
        });

        it('should validate file existence in mock mode', async () => {
            const context = createMockContext(tempDir);

            const result = await ReplaceLinesTool.executeMock(
                { path: 'nonexistent.txt', start_line: 1, end_line: 1, new_content: 'text' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('File does not exist');
        });

        it('should validate line bounds in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2');

            const result = await ReplaceLinesTool.executeMock(
                { path: 'test.txt', start_line: 1, end_line: 10, new_content: 'text' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('beyond end of file');
        });

        it('should validate start_line <= end_line in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

            const result = await ReplaceLinesTool.executeMock(
                { path: 'test.txt', start_line: 3, end_line: 1, new_content: 'text' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('must be <= end_line');
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await ReplaceLinesTool.executeMock(
                { path: '../../../etc/passwd', start_line: 1, end_line: 1, new_content: 'text' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('outside work directory');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should replace a function body', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'code.ts');

            const code = `function example() {
    const x = 1;
    return x;
}`;
            await fs.writeFile(filePath, code);

            await ReplaceLinesTool.execute(
                {
                    path: 'code.ts',
                    start_line: 2,
                    end_line: 3,
                    new_content: '    const x = 2;\n    const y = 3;\n    return x + y;',
                },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe(`function example() {
    const x = 2;
    const y = 3;
    return x + y;
}`);
        });

        it('should replace import statements', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'module.ts');

            const code = `import { oldUtil } from './old';
import { helper } from './helper';

export function main() {}`;
            await fs.writeFile(filePath, code);

            await ReplaceLinesTool.execute(
                {
                    path: 'module.ts',
                    start_line: 1,
                    end_line: 1,
                    new_content: "import { newUtil } from './new';",
                },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain("import { newUtil } from './new';");
            expect(content).not.toContain('oldUtil');
        });

        it('should replace configuration section', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'config.json');

            const config = `{
  "version": "1.0.0",
  "port": 3000,
  "host": "localhost"
}`;
            await fs.writeFile(filePath, config);

            await ReplaceLinesTool.execute(
                {
                    path: 'config.json',
                    start_line: 3,
                    end_line: 4,
                    new_content: '  "port": 8080,\n  "host": "0.0.0.0"',
                },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('"port": 8080');
            expect(content).toContain('"host": "0.0.0.0"');
        });

        it('should replace documentation block', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'README.md');

            const readme = `# Title

## Old Section
This is old content.

## Another Section`;
            await fs.writeFile(filePath, readme);

            await ReplaceLinesTool.execute(
                {
                    path: 'README.md',
                    start_line: 3,
                    end_line: 4,
                    new_content: '## New Section\nThis is updated content.',
                },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('## New Section');
            expect(content).toContain('This is updated content.');
            expect(content).not.toContain('Old Section');
        });

        it('should update class methods', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'class.ts');

            const code = `class Example {
    oldMethod() {
        return 'old';
    }

    anotherMethod() {
        return 'keep';
    }
}`;
            await fs.writeFile(filePath, code);

            await ReplaceLinesTool.execute(
                {
                    path: 'class.ts',
                    start_line: 2,
                    end_line: 4,
                    new_content: '    newMethod() {\n        return \'new\';\n    }',
                },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('newMethod');
            expect(content).toContain("return 'new'");
            expect(content).not.toContain('oldMethod');
        });

        it('should replace test assertions', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.ts');

            const test = `describe('test', () => {
    it('should work', () => {
        expect(result).toBe(1);
        expect(result).toBeGreaterThan(0);
    });
});`;
            await fs.writeFile(filePath, test);

            await ReplaceLinesTool.execute(
                {
                    path: 'test.ts',
                    start_line: 3,
                    end_line: 4,
                    new_content: '        expect(result).toBe(2);\n        expect(result).toBeLessThan(10);',
                },
                context,
            );

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('expect(result).toBe(2)');
            expect(content).toContain('toBeLessThan(10)');
        });
    });
});
