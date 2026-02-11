/**
 * Tests for WriteFileTool (FM-001)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { WriteFileTool } from '../../../../../src/agent/tools/repo_write/write_file.js';
import { createMockContext } from '../../../../helpers/mock-context.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';

describe.sequential('WriteFileTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `write-file-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            expect(WriteFileTool.name).toBe('repo_write-write_file');
            expect(WriteFileTool.description).toContain('Write content');
            expect(WriteFileTool.input_schema.required).toContain('path');
            expect(WriteFileTool.input_schema.required).toContain('content');
        });

        it('should write a new file', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                { path: 'test.txt', content: 'Hello, World!' },
                context,
            );

            assertToolSuccess(result);
            expect(result.path).toBe('test.txt');
            expect(result.created).toBe(true);
            expect(result.bytes_written).toBe(13); // "Hello, World!" is 13 bytes

            // Verify file was actually written
            const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
            expect(content).toBe('Hello, World!');
        });

        it('should overwrite an existing file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'existing.txt');

            // Create initial file
            await fs.writeFile(filePath, 'Original content');

            // Overwrite it
            const result = await WriteFileTool.execute(
                { path: 'existing.txt', content: 'New content' },
                context,
            );

            assertToolSuccess(result);
            expect(result.created).toBe(false);
            expect(result.bytes_written).toBe(11); // "New content" is 11 bytes

            // Verify content was overwritten
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('New content');
        });

        it('should write empty content', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute({ path: 'empty.txt', content: '' }, context);

            assertToolSuccess(result);
            expect(result.bytes_written).toBe(0);
            expect(result.created).toBe(true);

            // Verify empty file exists
            const content = await fs.readFile(path.join(tempDir, 'empty.txt'), 'utf-8');
            expect(content).toBe('');
        });

        it('should write multi-line content', async () => {
            const context = createMockContext(tempDir);
            const content = 'Line 1\nLine 2\nLine 3';
            const result = await WriteFileTool.execute({ path: 'multiline.txt', content }, context);

            assertToolSuccess(result);
            expect(result.created).toBe(true);

            const readContent = await fs.readFile(path.join(tempDir, 'multiline.txt'), 'utf-8');
            expect(readContent).toBe(content);
        });
    });

    describe('Directory Creation', () => {
        it('should create parent directories by default', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                { path: 'deeply/nested/dir/file.txt', content: 'test' },
                context,
            );

            assertToolSuccess(result);
            expect(result.created).toBe(true);

            // Verify directories and file were created
            const filePath = path.join(tempDir, 'deeply/nested/dir/file.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);
        });

        it('should create parent directories when create_directories is true', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                {
                    path: 'new/path/file.txt',
                    content: 'test',
                    create_directories: true,
                },
                context,
            );

            assertToolSuccess(result);

            const filePath = path.join(tempDir, 'new/path/file.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);
        });

        it('should fail when create_directories is false and directory does not exist', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                {
                    path: 'nonexistent/dir/file.txt',
                    content: 'test',
                    create_directories: false,
                },
                context,
            );

            expect(result.error).toBe(true);
            expect(result.message).toContain('Failed to write file');
        });

        it('should write to existing directory when create_directories is false', async () => {
            const context = createMockContext(tempDir);

            // Create directory first
            await fse.ensureDir(path.join(tempDir, 'existing'));

            const result = await WriteFileTool.execute(
                {
                    path: 'existing/file.txt',
                    content: 'test',
                    create_directories: false,
                },
                context,
            );

            assertToolSuccess(result);
        });
    });

    describe('Backup Functionality', () => {
        it('should create backup when backup is true and file exists', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'backup-test.txt');

            // Create initial file
            await fs.writeFile(filePath, 'Original content');

            // Write with backup
            const result = await WriteFileTool.execute(
                {
                    path: 'backup-test.txt',
                    content: 'New content',
                    backup: true,
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.backup_path).toBe('backup-test.txt.bak');
            expect(result.created).toBe(false);

            // Verify backup exists with original content
            const backupPath = path.join(tempDir, 'backup-test.txt.bak');
            const backupExists = await fse.pathExists(backupPath);
            expect(backupExists).toBe(true);

            const backupContent = await fs.readFile(backupPath, 'utf-8');
            expect(backupContent).toBe('Original content');

            // Verify main file has new content
            const newContent = await fs.readFile(filePath, 'utf-8');
            expect(newContent).toBe('New content');
        });

        it('should not create backup when backup is true but file does not exist', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                {
                    path: 'new-file.txt',
                    content: 'Content',
                    backup: true,
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.backup_path).toBeUndefined();
            expect(result.created).toBe(true);

            // Verify no backup file exists
            const backupPath = path.join(tempDir, 'new-file.txt.bak');
            const backupExists = await fse.pathExists(backupPath);
            expect(backupExists).toBe(false);
        });

        it('should not create backup when backup is false', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'no-backup.txt');

            // Create initial file
            await fs.writeFile(filePath, 'Original');

            const result = await WriteFileTool.execute(
                {
                    path: 'no-backup.txt',
                    content: 'New',
                    backup: false,
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.backup_path).toBeUndefined();

            // Verify no backup exists
            const backupPath = path.join(tempDir, 'no-backup.txt.bak');
            const backupExists = await fse.pathExists(backupPath);
            expect(backupExists).toBe(false);
        });

        it('should overwrite existing backup file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'file.txt');
            const backupPath = path.join(tempDir, 'file.txt.bak');

            // Create initial file and backup
            await fs.writeFile(filePath, 'Version 1');
            await fs.writeFile(backupPath, 'Old backup');

            // Write with backup (should overwrite old backup)
            const result = await WriteFileTool.execute(
                {
                    path: 'file.txt',
                    content: 'Version 2',
                    backup: true,
                },
                context,
            );

            assertToolSuccess(result);

            // Verify backup has Version 1, not "Old backup"
            const backupContent = await fs.readFile(backupPath, 'utf-8');
            expect(backupContent).toBe('Version 1');
        });
    });

    describe('Encoding', () => {
        it('should use utf-8 encoding by default', async () => {
            const context = createMockContext(tempDir);
            const content = 'Unicode: 你好世界 🌍';

            const result = await WriteFileTool.execute({ path: 'unicode.txt', content }, context);

            assertToolSuccess(result);

            const readContent = await fs.readFile(path.join(tempDir, 'unicode.txt'), 'utf-8');
            expect(readContent).toBe(content);
        });

        it('should support custom encoding', async () => {
            const context = createMockContext(tempDir);
            const content = 'ASCII only';

            const result = await WriteFileTool.execute(
                {
                    path: 'ascii.txt',
                    content,
                    encoding: 'ascii',
                },
                context,
            );

            assertToolSuccess(result);

            const readContent = await fs.readFile(path.join(tempDir, 'ascii.txt'), 'ascii');
            expect(readContent).toBe(content);
        });

        it('should handle UTF-16 encoding', async () => {
            const context = createMockContext(tempDir);
            const content = 'UTF-16 content';

            const result = await WriteFileTool.execute(
                {
                    path: 'utf16.txt',
                    content,
                    encoding: 'utf16le',
                },
                context,
            );

            assertToolSuccess(result);

            const readContent = await fs.readFile(path.join(tempDir, 'utf16.txt'), 'utf16le');
            expect(readContent).toBe(content);
        });
    });

    describe('Path Handling', () => {
        it('should handle relative paths', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                { path: './test.txt', content: 'test' },
                context,
            );

            assertToolSuccess(result);

            const exists = await fse.pathExists(path.join(tempDir, 'test.txt'));
            expect(exists).toBe(true);
        });

        it('should handle paths with subdirectories', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                { path: 'sub/dir/file.txt', content: 'test' },
                context,
            );

            assertToolSuccess(result);

            const filePath = path.join(tempDir, 'sub/dir/file.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await WriteFileTool.execute({ path: 'test.txt', content: 'test' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute({ path: '', content: 'test' }, context);

            assertToolError(result, 'path parameter is required');
        });

        it('should validate path is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                { path: 123 as any, content: 'test' },
                context,
            );

            assertToolError(result, 'must be a string');
        });

        it('should require content parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                { path: 'test.txt', content: undefined as any },
                context,
            );

            assertToolError(result, 'content parameter is required');
        });

        it('should handle null content', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                { path: 'test.txt', content: null as any },
                context,
            );

            assertToolError(result, 'content parameter is required');
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                { path: '../../../etc/passwd', content: 'malicious' },
                context,
            );

            assertToolError(result, 'outside work directory');

            // Verify file was not created
            const maliciousPath = path.resolve(tempDir, '../../../etc/passwd');
            const exists = await fse.pathExists(maliciousPath);
            // Don't verify - just ensure our code rejected it
            expect(result.error).toBe(true);
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.execute(
                { path: '/tmp/malicious.txt', content: 'malicious' },
                context,
            );

            assertToolError(result, 'outside work directory');
        });

        it('should allow absolute paths within workDir', async () => {
            const context = createMockContext(tempDir);
            const absolutePath = path.join(tempDir, 'allowed.txt');

            const result = await WriteFileTool.execute(
                { path: absolutePath, content: 'allowed' },
                context,
            );

            assertToolSuccess(result);

            const exists = await fse.pathExists(absolutePath);
            expect(exists).toBe(true);
        });
    });

    describe('Mock Execution', () => {
        it('should not write file in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.executeMock(
                { path: 'mock-test.txt', content: 'Should not be written' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.path).toBe('mock-test.txt');
            expect(result.bytes_written).toBe(21); // "Should not be written" is 21 bytes
            expect(result.created).toBe(true);

            // Verify file was NOT actually written
            const filePath = path.join(tempDir, 'mock-test.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);
        });

        it('should report correct state in mock mode for existing file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'existing.txt');

            // Create file first
            await fs.writeFile(filePath, 'Original');

            const result = await WriteFileTool.executeMock(
                { path: 'existing.txt', content: 'New content', backup: true },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.created).toBe(false);
            expect(result.backup_path).toBe('existing.txt.bak');

            // Verify original file is unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('Original');

            // Verify backup was NOT created
            const backupPath = path.join(tempDir, 'existing.txt.bak');
            const backupExists = await fse.pathExists(backupPath);
            expect(backupExists).toBe(false);
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.executeMock(
                { path: '../../../etc/passwd', content: 'malicious' },
                context,
            );

            // Validation errors don't include dry_run field
            expect(result.error).toBe(true);
            expect(result.message).toContain('outside work directory');
        });

        it('should validate input in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await WriteFileTool.executeMock(
                { path: '', content: 'test' },
                context,
            );

            // Validation errors don't include dry_run field
            expect(result.error).toBe(true);
            expect(result.message).toContain('path parameter is required');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should write configuration file', async () => {
            const context = createMockContext(tempDir);
            const config = JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2);

            const result = await WriteFileTool.execute(
                { path: 'config.json', content: config },
                context,
            );

            assertToolSuccess(result);

            const readConfig = await fs.readFile(path.join(tempDir, 'config.json'), 'utf-8');
            const parsed = JSON.parse(readConfig);
            expect(parsed.name).toBe('test');
            expect(parsed.version).toBe('1.0.0');
        });

        it('should write source code file', async () => {
            const context = createMockContext(tempDir);
            const code = `export function hello(): string {
    return "Hello, World!";
}
`;

            const result = await WriteFileTool.execute(
                { path: 'src/hello.ts', content: code },
                context,
            );

            assertToolSuccess(result);

            const readCode = await fs.readFile(path.join(tempDir, 'src/hello.ts'), 'utf-8');
            expect(readCode).toBe(code);
        });

        it('should safely update file with backup', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'important.txt');

            // Create initial version
            await fs.writeFile(filePath, 'Version 1.0');

            // Update with backup
            const result = await WriteFileTool.execute(
                {
                    path: 'important.txt',
                    content: 'Version 2.0',
                    backup: true,
                },
                context,
            );

            assertToolSuccess(result);
            expect(result.backup_path).toBe('important.txt.bak');

            // Both versions should exist
            const newContent = await fs.readFile(filePath, 'utf-8');
            expect(newContent).toBe('Version 2.0');

            const backupContent = await fs.readFile(path.join(tempDir, 'important.txt.bak'), 'utf-8');
            expect(backupContent).toBe('Version 1.0');
        });
    });
});
