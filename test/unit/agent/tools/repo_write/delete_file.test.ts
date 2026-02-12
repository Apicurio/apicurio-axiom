/**
 * Tests for DeleteFileTool (FM-006)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeleteFileTool } from '../../../../../src/agent/tools/repo_write/delete_file.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';

describe.sequential('DeleteFileTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `delete-file-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            expect(DeleteFileTool.name).toBe('repo_write-delete_file');
            expect(DeleteFileTool.description).toContain('Delete a file or directory');
            expect(DeleteFileTool.input_schema.required).toContain('path');
        });

        it('should delete a single file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'content');

            const result = await DeleteFileTool.execute({ path: 'test.txt' }, context);

            assertToolSuccess(result);
            expect(result.path).toBe('test.txt');
            expect(result.type).toBe('file');
            expect(result.files_deleted).toBe(1);

            // Verify file is deleted
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);
        });

        it('should delete an empty directory with recursive flag', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'emptydir');

            await fse.ensureDir(dirPath);

            const result = await DeleteFileTool.execute({ path: 'emptydir', recursive: true }, context);

            assertToolSuccess(result);
            expect(result.type).toBe('directory');
            expect(result.files_deleted).toBe(0);

            // Verify directory is deleted
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(false);
        });

        it('should delete a directory with files recursively', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'testdir');

            await fse.ensureDir(dirPath);
            await fs.writeFile(path.join(dirPath, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(dirPath, 'file2.txt'), 'content2');
            await fs.writeFile(path.join(dirPath, 'file3.txt'), 'content3');

            const result = await DeleteFileTool.execute({ path: 'testdir', recursive: true }, context);

            assertToolSuccess(result);
            expect(result.type).toBe('directory');
            expect(result.files_deleted).toBe(3);

            // Verify directory is deleted
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(false);
        });

        it('should count files in nested directories', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'nested');

            await fse.ensureDir(path.join(dirPath, 'sub1', 'sub2'));
            await fs.writeFile(path.join(dirPath, 'file1.txt'), 'content');
            await fs.writeFile(path.join(dirPath, 'sub1', 'file2.txt'), 'content');
            await fs.writeFile(path.join(dirPath, 'sub1', 'sub2', 'file3.txt'), 'content');

            const result = await DeleteFileTool.execute({ path: 'nested', recursive: true }, context);

            assertToolSuccess(result);
            expect(result.files_deleted).toBe(3);

            // Verify directory is deleted
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(false);
        });
    });

    describe('Recursive Flag Requirement', () => {
        it('should require recursive flag for non-empty directory', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'testdir');

            await fse.ensureDir(dirPath);
            await fs.writeFile(path.join(dirPath, 'file.txt'), 'content');

            const result = await DeleteFileTool.execute({ path: 'testdir', recursive: false }, context);

            assertToolError(result, 'Cannot delete directory without recursive flag');

            // Verify directory still exists
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(true);
        });

        it('should require recursive flag for empty directory', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'emptydir');

            await fse.ensureDir(dirPath);

            const result = await DeleteFileTool.execute({ path: 'emptydir' }, context);

            assertToolError(result, 'Cannot delete directory without recursive flag');

            // Verify directory still exists
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(true);
        });

        it('should not require recursive flag for files', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'content');

            const result = await DeleteFileTool.execute({ path: 'test.txt', recursive: false }, context);

            assertToolSuccess(result);

            // Verify file is deleted
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);
        });
    });

    describe('Backup Functionality', () => {
        it('should create backup of file before deletion', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'important content');

            const result = await DeleteFileTool.execute({ path: 'test.txt', backup: true }, context);

            assertToolSuccess(result);
            expect(result.backup_path).toBeDefined();
            expect(result.backup_path).toContain('test.txt.backup-');

            // Verify original file is deleted
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);

            // Verify backup exists
            const backupPath = path.join(tempDir, result.backup_path);
            const backupExists = await fse.pathExists(backupPath);
            expect(backupExists).toBe(true);

            // Verify backup content
            const backupContent = await fs.readFile(backupPath, 'utf-8');
            expect(backupContent).toBe('important content');
        });

        it('should create backup of directory before deletion', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'testdir');

            await fse.ensureDir(dirPath);
            await fs.writeFile(path.join(dirPath, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(dirPath, 'file2.txt'), 'content2');

            const result = await DeleteFileTool.execute({ path: 'testdir', recursive: true, backup: true }, context);

            assertToolSuccess(result);
            expect(result.backup_path).toBeDefined();
            expect(result.backup_path).toContain('testdir.backup-');

            // Verify original directory is deleted
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(false);

            // Verify backup directory exists
            const backupPath = path.join(tempDir, result.backup_path);
            const backupExists = await fse.pathExists(backupPath);
            expect(backupExists).toBe(true);

            // Verify backup contains files
            const file1Exists = await fse.pathExists(path.join(backupPath, 'file1.txt'));
            const file2Exists = await fse.pathExists(path.join(backupPath, 'file2.txt'));
            expect(file1Exists).toBe(true);
            expect(file2Exists).toBe(true);
        });

        it('should not create backup when backup is false', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'content');

            const result = await DeleteFileTool.execute({ path: 'test.txt', backup: false }, context);

            assertToolSuccess(result);
            expect(result.backup_path).toBeUndefined();
        });

        it('should not create backup by default', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'content');

            const result = await DeleteFileTool.execute({ path: 'test.txt' }, context);

            assertToolSuccess(result);
            expect(result.backup_path).toBeUndefined();
        });
    });

    describe('File Path Handling', () => {
        it('should delete file in subdirectory', async () => {
            const context = createMockContext(tempDir);
            const subdir = path.join(tempDir, 'sub');
            await fse.ensureDir(subdir);

            const filePath = path.join(subdir, 'file.txt');
            await fs.writeFile(filePath, 'content');

            const result = await DeleteFileTool.execute({ path: 'sub/file.txt' }, context);

            assertToolSuccess(result);

            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);
        });

        it('should delete nested directory', async () => {
            const context = createMockContext(tempDir);
            const nestedPath = path.join(tempDir, 'level1', 'level2');
            await fse.ensureDir(nestedPath);
            await fs.writeFile(path.join(nestedPath, 'file.txt'), 'content');

            const result = await DeleteFileTool.execute({ path: 'level1/level2', recursive: true }, context);

            assertToolSuccess(result);

            const exists = await fse.pathExists(nestedPath);
            expect(exists).toBe(false);

            // Parent directory should still exist
            const parentExists = await fse.pathExists(path.join(tempDir, 'level1'));
            expect(parentExists).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await DeleteFileTool.execute({ path: 'test.txt' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await DeleteFileTool.execute({ path: '' }, context);

            assertToolError(result, 'path parameter is required');
        });

        it('should validate path is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await DeleteFileTool.execute({ path: 123 as any }, context);

            assertToolError(result, 'must be a string');
        });

        it('should return error when path does not exist', async () => {
            const context = createMockContext(tempDir);

            const result = await DeleteFileTool.execute({ path: 'nonexistent.txt' }, context);

            assertToolError(result, 'Path does not exist');
        });

        it('should prevent deletion of work directory itself', async () => {
            const context = createMockContext(tempDir);

            const result = await DeleteFileTool.execute({ path: '.' }, context);

            assertToolError(result, 'Cannot delete the work directory itself');
        });

        it('should prevent deletion of work directory with absolute path', async () => {
            const context = createMockContext(tempDir);

            const result = await DeleteFileTool.execute({ path: tempDir }, context);

            assertToolError(result, 'Cannot delete the work directory itself');
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const result = await DeleteFileTool.execute({ path: '../../../etc/passwd' }, context);

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await DeleteFileTool.execute({ path: '/tmp/malicious.txt' }, context);

            assertToolError(result, 'outside work directory');
        });

        it('should allow absolute paths within workDir', async () => {
            const context = createMockContext(tempDir);
            const absolutePath = path.join(tempDir, 'allowed.txt');

            await fs.writeFile(absolutePath, 'content');

            const result = await DeleteFileTool.execute({ path: absolutePath }, context);

            assertToolSuccess(result);

            const exists = await fse.pathExists(absolutePath);
            expect(exists).toBe(false);
        });
    });

    describe('Mock Execution', () => {
        it('should not delete file in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'content');

            const result = await DeleteFileTool.executeMock({ path: 'test.txt' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.path).toBe('test.txt');
            expect(result.type).toBe('file');
            expect(result.files_deleted).toBe(1);

            // Verify file still exists
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);
        });

        it('should not delete directory in mock mode', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'testdir');

            await fse.ensureDir(dirPath);
            await fs.writeFile(path.join(dirPath, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(dirPath, 'file2.txt'), 'content2');

            const result = await DeleteFileTool.executeMock({ path: 'testdir', recursive: true }, context);

            expect(result.dry_run).toBe(true);
            expect(result.type).toBe('directory');
            expect(result.files_deleted).toBe(2);

            // Verify directory still exists
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(true);
        });

        it('should validate recursive flag in mock mode', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'testdir');

            await fse.ensureDir(dirPath);
            await fs.writeFile(path.join(dirPath, 'file.txt'), 'content');

            const result = await DeleteFileTool.executeMock({ path: 'testdir', recursive: false }, context);

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Cannot delete directory without recursive flag');
        });

        it('should indicate backup would be created in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'content');

            const result = await DeleteFileTool.executeMock({ path: 'test.txt', backup: true }, context);

            expect(result.dry_run).toBe(true);
            expect(result.backup_path).toBeDefined();
            expect(result.backup_path).toContain('backup');
        });

        it('should validate path existence in mock mode', async () => {
            const context = createMockContext(tempDir);

            const result = await DeleteFileTool.executeMock({ path: 'nonexistent.txt' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Path does not exist');
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await DeleteFileTool.executeMock({ path: '../../../etc/passwd' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('outside work directory');
        });

        it('should prevent work directory deletion in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await DeleteFileTool.executeMock({ path: '.' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Cannot delete the work directory itself');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should delete temporary build artifacts', async () => {
            const context = createMockContext(tempDir);
            const buildDir = path.join(tempDir, 'build');

            await fse.ensureDir(path.join(buildDir, 'classes'));
            await fs.writeFile(path.join(buildDir, 'output.js'), 'code');
            await fs.writeFile(path.join(buildDir, 'output.js.map'), 'map');
            await fs.writeFile(path.join(buildDir, 'classes', 'Main.class'), 'bytecode');

            await DeleteFileTool.execute({ path: 'build', recursive: true }, context);

            const exists = await fse.pathExists(buildDir);
            expect(exists).toBe(false);
        });

        it('should delete old log files', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'app.log'), 'old logs');

            const result = await DeleteFileTool.execute({ path: 'app.log' }, context);

            assertToolSuccess(result);
            expect(result.files_deleted).toBe(1);
        });

        it('should delete test output directory', async () => {
            const context = createMockContext(tempDir);
            const testOutputDir = path.join(tempDir, 'test-results');

            await fse.ensureDir(path.join(testOutputDir, 'coverage'));
            await fs.writeFile(path.join(testOutputDir, 'results.xml'), 'results');
            await fs.writeFile(path.join(testOutputDir, 'coverage', 'index.html'), 'coverage');

            const result = await DeleteFileTool.execute({ path: 'test-results', recursive: true }, context);

            assertToolSuccess(result);
            expect(result.type).toBe('directory');
            expect(result.files_deleted).toBe(2);

            const exists = await fse.pathExists(testOutputDir);
            expect(exists).toBe(false);
        });

        it('should delete with backup for important files', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'config.json'), '{"version": "1.0"}');

            const result = await DeleteFileTool.execute({ path: 'config.json', backup: true }, context);

            assertToolSuccess(result);

            // Original deleted
            const exists = await fse.pathExists(path.join(tempDir, 'config.json'));
            expect(exists).toBe(false);

            // Backup created
            const backupPath = path.join(tempDir, result.backup_path);
            const backupExists = await fse.pathExists(backupPath);
            expect(backupExists).toBe(true);
        });

        it('should delete cache directory', async () => {
            const context = createMockContext(tempDir);
            const cacheDir = path.join(tempDir, '.cache');

            await fse.ensureDir(path.join(cacheDir, 'module1'));
            await fse.ensureDir(path.join(cacheDir, 'module2'));
            await fs.writeFile(path.join(cacheDir, 'module1', 'cache.dat'), 'data');
            await fs.writeFile(path.join(cacheDir, 'module2', 'cache.dat'), 'data');
            await fs.writeFile(path.join(cacheDir, 'index.json'), '{}');

            const result = await DeleteFileTool.execute({ path: '.cache', recursive: true }, context);

            assertToolSuccess(result);
            expect(result.files_deleted).toBe(3);

            const exists = await fse.pathExists(cacheDir);
            expect(exists).toBe(false);
        });

        it('should delete generated code files', async () => {
            const context = createMockContext(tempDir);
            const genDir = path.join(tempDir, 'src', 'generated');

            await fse.ensureDir(genDir);
            await fs.writeFile(path.join(genDir, 'types.ts'), 'generated types');
            await fs.writeFile(path.join(genDir, 'models.ts'), 'generated models');

            const result = await DeleteFileTool.execute({ path: 'src/generated', recursive: true }, context);

            assertToolSuccess(result);
            expect(result.files_deleted).toBe(2);

            const exists = await fse.pathExists(genDir);
            expect(exists).toBe(false);

            // Parent directory should still exist
            const srcExists = await fse.pathExists(path.join(tempDir, 'src'));
            expect(srcExists).toBe(true);
        });
    });
});
