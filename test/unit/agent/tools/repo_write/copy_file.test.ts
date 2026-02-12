/**
 * Tests for CopyFileTool (FM-008)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CopyFileTool } from '../../../../../src/agent/tools/repo_write/copy_file.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';

describe.sequential('CopyFileTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `copy-file-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            expect(CopyFileTool.name).toBe('repo_write-copy_file');
            expect(CopyFileTool.description).toContain('Copy a file or directory');
            expect(CopyFileTool.input_schema.required).toContain('source');
            expect(CopyFileTool.input_schema.required).toContain('destination');
        });

        it('should copy a file', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');
            const destPath = path.join(tempDir, 'dest.txt');

            await fs.writeFile(sourcePath, 'test content');

            const result = await CopyFileTool.execute({ source: 'source.txt', destination: 'dest.txt' }, context);

            assertToolSuccess(result);
            expect(result.source).toBe('source.txt');
            expect(result.destination).toBe('dest.txt');
            expect(result.files_copied).toBe(1);
            expect(result.bytes_copied).toBe(12); // "test content" = 12 bytes

            // Verify source still exists
            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(true);

            // Verify destination exists with correct content
            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(true);
            const content = await fs.readFile(destPath, 'utf-8');
            expect(content).toBe('test content');
        });

        it('should copy an empty file', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'empty.txt');
            const destPath = path.join(tempDir, 'empty-copy.txt');

            await fs.writeFile(sourcePath, '');

            const result = await CopyFileTool.execute({ source: 'empty.txt', destination: 'empty-copy.txt' }, context);

            assertToolSuccess(result);
            expect(result.files_copied).toBe(1);
            expect(result.bytes_copied).toBe(0);

            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(true);
        });

        it('should copy a directory recursively', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source-dir');
            const destDir = path.join(tempDir, 'dest-dir');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'content2');

            const result = await CopyFileTool.execute({ source: 'source-dir', destination: 'dest-dir' }, context);

            assertToolSuccess(result);
            expect(result.files_copied).toBe(2);
            expect(result.bytes_copied).toBe(16); // "content1" + "content2" = 16 bytes

            // Verify source still exists
            const sourceExists = await fse.pathExists(sourceDir);
            expect(sourceExists).toBe(true);

            // Verify destination directory and files exist
            const destExists = await fse.pathExists(destDir);
            expect(destExists).toBe(true);
            const file1Exists = await fse.pathExists(path.join(destDir, 'file1.txt'));
            const file2Exists = await fse.pathExists(path.join(destDir, 'file2.txt'));
            expect(file1Exists).toBe(true);
            expect(file2Exists).toBe(true);
        });

        it('should copy nested directory structure', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source');
            const destDir = path.join(tempDir, 'dest');

            await fse.ensureDir(path.join(sourceDir, 'sub1', 'sub2'));
            await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'a');
            await fs.writeFile(path.join(sourceDir, 'sub1', 'file2.txt'), 'bb');
            await fs.writeFile(path.join(sourceDir, 'sub1', 'sub2', 'file3.txt'), 'ccc');

            const result = await CopyFileTool.execute({ source: 'source', destination: 'dest' }, context);

            assertToolSuccess(result);
            expect(result.files_copied).toBe(3);
            expect(result.bytes_copied).toBe(6); // 1 + 2 + 3 = 6 bytes

            // Verify nested structure
            const file1Exists = await fse.pathExists(path.join(destDir, 'file1.txt'));
            const file2Exists = await fse.pathExists(path.join(destDir, 'sub1', 'file2.txt'));
            const file3Exists = await fse.pathExists(path.join(destDir, 'sub1', 'sub2', 'file3.txt'));
            expect(file1Exists).toBe(true);
            expect(file2Exists).toBe(true);
            expect(file3Exists).toBe(true);
        });

        it('should copy file to subdirectory', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'file.txt');
            const destPath = path.join(tempDir, 'subdir', 'file.txt');

            await fs.writeFile(sourcePath, 'data');

            const result = await CopyFileTool.execute({ source: 'file.txt', destination: 'subdir/file.txt' }, context);

            assertToolSuccess(result);

            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(true);
        });
    });

    describe('Recursive Flag', () => {
        it('should require recursive flag to be true for directories', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source-dir');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file.txt'), 'content');

            const result = await CopyFileTool.execute(
                { source: 'source-dir', destination: 'dest-dir', recursive: false },
                context,
            );

            assertToolError(result, 'Cannot copy directory without recursive flag');

            // Verify destination not created
            const destExists = await fse.pathExists(path.join(tempDir, 'dest-dir'));
            expect(destExists).toBe(false);
        });

        it('should copy directory with recursive true', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source-dir');
            const destDir = path.join(tempDir, 'dest-dir');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file.txt'), 'content');

            const result = await CopyFileTool.execute(
                { source: 'source-dir', destination: 'dest-dir', recursive: true },
                context,
            );

            assertToolSuccess(result);

            const destExists = await fse.pathExists(destDir);
            expect(destExists).toBe(true);
        });

        it('should copy directory by default (recursive defaults to true)', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source-dir');
            const destDir = path.join(tempDir, 'dest-dir');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file.txt'), 'content');

            const result = await CopyFileTool.execute({ source: 'source-dir', destination: 'dest-dir' }, context);

            assertToolSuccess(result);

            const destExists = await fse.pathExists(destDir);
            expect(destExists).toBe(true);
        });

        it('should not require recursive flag for files', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await CopyFileTool.execute(
                { source: 'source.txt', destination: 'dest.txt', recursive: false },
                context,
            );

            assertToolSuccess(result);

            const destExists = await fse.pathExists(path.join(tempDir, 'dest.txt'));
            expect(destExists).toBe(true);
        });
    });

    describe('Overwrite Behavior', () => {
        it('should return error when destination exists without overwrite flag', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');
            const destPath = path.join(tempDir, 'dest.txt');

            await fs.writeFile(sourcePath, 'source content');
            await fs.writeFile(destPath, 'dest content');

            const result = await CopyFileTool.execute(
                { source: 'source.txt', destination: 'dest.txt', overwrite: false },
                context,
            );

            assertToolError(result, 'Destination already exists');

            // Verify destination unchanged
            const content = await fs.readFile(destPath, 'utf-8');
            expect(content).toBe('dest content');
        });

        it('should overwrite when destination exists with overwrite flag', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');
            const destPath = path.join(tempDir, 'dest.txt');

            await fs.writeFile(sourcePath, 'source content');
            await fs.writeFile(destPath, 'dest content');

            const result = await CopyFileTool.execute(
                { source: 'source.txt', destination: 'dest.txt', overwrite: true },
                context,
            );

            assertToolSuccess(result);

            // Verify destination has source content
            const content = await fs.readFile(destPath, 'utf-8');
            expect(content).toBe('source content');

            // Verify source still exists
            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(true);
        });

        it('should overwrite directory with overwrite flag', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source');
            const destDir = path.join(tempDir, 'dest');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'new.txt'), 'new');

            await fse.ensureDir(destDir);
            await fs.writeFile(path.join(destDir, 'old.txt'), 'old');

            const result = await CopyFileTool.execute(
                { source: 'source', destination: 'dest', overwrite: true },
                context,
            );

            assertToolSuccess(result);

            // Verify destination has source content
            const newFileExists = await fse.pathExists(path.join(destDir, 'new.txt'));
            expect(newFileExists).toBe(true);
        });
    });

    describe('Byte and File Counting', () => {
        it('should count bytes for single file', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(sourcePath, 'hello world'); // 11 bytes

            const result = await CopyFileTool.execute({ source: 'file.txt', destination: 'copy.txt' }, context);

            assertToolSuccess(result);
            expect(result.files_copied).toBe(1);
            expect(result.bytes_copied).toBe(11);
        });

        it('should count files and bytes for directory', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'abc'); // 3 bytes
            await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'defgh'); // 5 bytes
            await fs.writeFile(path.join(sourceDir, 'file3.txt'), 'ijklmno'); // 7 bytes

            const result = await CopyFileTool.execute({ source: 'source', destination: 'dest' }, context);

            assertToolSuccess(result);
            expect(result.files_copied).toBe(3);
            expect(result.bytes_copied).toBe(15); // 3 + 5 + 7 = 15
        });

        it('should count files and bytes for nested directory', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source');

            await fse.ensureDir(path.join(sourceDir, 'sub'));
            await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'x'); // 1 byte
            await fs.writeFile(path.join(sourceDir, 'sub', 'file2.txt'), 'yy'); // 2 bytes

            const result = await CopyFileTool.execute({ source: 'source', destination: 'dest' }, context);

            assertToolSuccess(result);
            expect(result.files_copied).toBe(2);
            expect(result.bytes_copied).toBe(3); // 1 + 2 = 3
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await CopyFileTool.execute({ source: 'source.txt', destination: 'dest.txt' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require source parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await CopyFileTool.execute({ source: '', destination: 'dest.txt' }, context);

            assertToolError(result, 'source parameter is required');
        });

        it('should validate source is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await CopyFileTool.execute({ source: 123 as any, destination: 'dest.txt' }, context);

            assertToolError(result, 'must be a string');
        });

        it('should require destination parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await CopyFileTool.execute({ source: 'source.txt', destination: '' }, context);

            assertToolError(result, 'destination parameter is required');
        });

        it('should validate destination is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await CopyFileTool.execute({ source: 'source.txt', destination: 123 as any }, context);

            assertToolError(result, 'must be a string');
        });

        it('should return error when source does not exist', async () => {
            const context = createMockContext(tempDir);

            const result = await CopyFileTool.execute({ source: 'nonexistent.txt', destination: 'dest.txt' }, context);

            assertToolError(result, 'Source does not exist');
        });

        it('should return error when source and destination are the same', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(filePath, 'content');

            const result = await CopyFileTool.execute({ source: 'file.txt', destination: 'file.txt' }, context);

            assertToolError(result, 'Source and destination paths are the same');
        });

        it('should return error for same path with different notation', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(filePath, 'content');

            const result = await CopyFileTool.execute({ source: 'file.txt', destination: './file.txt' }, context);

            assertToolError(result, 'Source and destination paths are the same');
        });
    });

    describe('Security', () => {
        it('should reject source path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const result = await CopyFileTool.execute(
                { source: '../../../etc/passwd', destination: 'passwd' },
                context,
            );

            assertToolError(result, 'source path is outside work directory');
        });

        it('should reject destination path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await CopyFileTool.execute(
                { source: 'file.txt', destination: '../../../tmp/malicious.txt' },
                context,
            );

            assertToolError(result, 'destination path is outside work directory');
        });

        it('should reject absolute source paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await CopyFileTool.execute({ source: '/etc/passwd', destination: 'passwd' }, context);

            assertToolError(result, 'source path is outside work directory');
        });

        it('should reject absolute destination paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await CopyFileTool.execute(
                { source: 'file.txt', destination: '/tmp/malicious.txt' },
                context,
            );

            assertToolError(result, 'destination path is outside work directory');
        });

        it('should allow absolute paths within workDir', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');
            const destPath = path.join(tempDir, 'dest.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await CopyFileTool.execute({ source: sourcePath, destination: destPath }, context);

            assertToolSuccess(result);

            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(true);
        });
    });

    describe('Mock Execution', () => {
        it('should not copy file in mock mode', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await CopyFileTool.executeMock({ source: 'source.txt', destination: 'dest.txt' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.source).toBe('source.txt');
            expect(result.destination).toBe('dest.txt');
            expect(result.files_copied).toBe(1);
            expect(result.bytes_copied).toBe(7); // "content" = 7 bytes

            // Verify destination not created
            const destPath = path.join(tempDir, 'dest.txt');
            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(false);
        });

        it('should calculate stats from source in mock mode', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'abc');
            await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'def');

            const result = await CopyFileTool.executeMock({ source: 'source', destination: 'dest' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.files_copied).toBe(2);
            expect(result.bytes_copied).toBe(6);

            // Verify destination not created
            const destExists = await fse.pathExists(path.join(tempDir, 'dest'));
            expect(destExists).toBe(false);
        });

        it('should validate recursive flag in mock mode', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file.txt'), 'content');

            const result = await CopyFileTool.executeMock(
                { source: 'source', destination: 'dest', recursive: false },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Cannot copy directory without recursive flag');
        });

        it('should validate overwrite in mock mode', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');
            const destPath = path.join(tempDir, 'dest.txt');

            await fs.writeFile(sourcePath, 'source');
            await fs.writeFile(destPath, 'dest');

            const result = await CopyFileTool.executeMock(
                { source: 'source.txt', destination: 'dest.txt', overwrite: false },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Destination already exists');
        });

        it('should validate source existence in mock mode', async () => {
            const context = createMockContext(tempDir);

            const result = await CopyFileTool.executeMock(
                { source: 'nonexistent.txt', destination: 'dest.txt' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Source does not exist');
        });

        it('should validate same path in mock mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(filePath, 'content');

            const result = await CopyFileTool.executeMock({ source: 'file.txt', destination: 'file.txt' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Source and destination paths are the same');
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await CopyFileTool.executeMock(
                { source: '../../../etc/passwd', destination: 'passwd' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('outside work directory');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should create backup of configuration file', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'config.json'), '{"env": "prod"}');

            await CopyFileTool.execute({ source: 'config.json', destination: 'config.json.backup' }, context);

            const originalExists = await fse.pathExists(path.join(tempDir, 'config.json'));
            const backupExists = await fse.pathExists(path.join(tempDir, 'config.json.backup'));
            expect(originalExists).toBe(true);
            expect(backupExists).toBe(true);
        });

        it('should duplicate component template', async () => {
            const context = createMockContext(tempDir);
            const templateDir = path.join(tempDir, 'templates', 'component');

            await fse.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, 'index.tsx'), 'template code');
            await fs.writeFile(path.join(templateDir, 'styles.css'), 'template styles');

            await CopyFileTool.execute(
                { source: 'templates/component', destination: 'src/components/NewComponent' },
                context,
            );

            const newComponentPath = path.join(tempDir, 'src', 'components', 'NewComponent');
            const indexExists = await fse.pathExists(path.join(newComponentPath, 'index.tsx'));
            const stylesExists = await fse.pathExists(path.join(newComponentPath, 'styles.css'));
            expect(indexExists).toBe(true);
            expect(stylesExists).toBe(true);
        });

        it('should copy test fixtures', async () => {
            const context = createMockContext(tempDir);
            const fixturesDir = path.join(tempDir, 'fixtures');

            await fse.ensureDir(fixturesDir);
            await fs.writeFile(path.join(fixturesDir, 'data1.json'), '{"id": 1}');
            await fs.writeFile(path.join(fixturesDir, 'data2.json'), '{"id": 2}');

            await CopyFileTool.execute({ source: 'fixtures', destination: 'test/fixtures' }, context);

            const testFixturesPath = path.join(tempDir, 'test', 'fixtures');
            const data1Exists = await fse.pathExists(path.join(testFixturesPath, 'data1.json'));
            const data2Exists = await fse.pathExists(path.join(testFixturesPath, 'data2.json'));
            expect(data1Exists).toBe(true);
            expect(data2Exists).toBe(true);
        });

        it('should copy shared utilities to multiple modules', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'utils.ts'), 'export function helper() {}');

            await CopyFileTool.execute({ source: 'utils.ts', destination: 'module1/utils.ts' }, context);

            const module1Exists = await fse.pathExists(path.join(tempDir, 'module1', 'utils.ts'));
            expect(module1Exists).toBe(true);

            // Original still exists
            const originalExists = await fse.pathExists(path.join(tempDir, 'utils.ts'));
            expect(originalExists).toBe(true);
        });

        it('should create versioned copy before major update', async () => {
            const context = createMockContext(tempDir);
            const apiDir = path.join(tempDir, 'api', 'v1');

            await fse.ensureDir(apiDir);
            await fs.writeFile(path.join(apiDir, 'endpoints.ts'), 'v1 endpoints');
            await fs.writeFile(path.join(apiDir, 'types.ts'), 'v1 types');

            const result = await CopyFileTool.execute({ source: 'api/v1', destination: 'api/v2' }, context);

            assertToolSuccess(result);
            expect(result.files_copied).toBe(2);

            // Both versions exist
            const v1Exists = await fse.pathExists(path.join(tempDir, 'api', 'v1'));
            const v2Exists = await fse.pathExists(path.join(tempDir, 'api', 'v2'));
            expect(v1Exists).toBe(true);
            expect(v2Exists).toBe(true);
        });

        it('should copy documentation to public folder', async () => {
            const context = createMockContext(tempDir);
            const docsDir = path.join(tempDir, 'docs');

            await fse.ensureDir(docsDir);
            await fs.writeFile(path.join(docsDir, 'README.md'), '# Documentation');
            await fs.writeFile(path.join(docsDir, 'guide.md'), '# Guide');

            await CopyFileTool.execute({ source: 'docs', destination: 'public/docs' }, context);

            const publicDocsPath = path.join(tempDir, 'public', 'docs');
            const readmeExists = await fse.pathExists(path.join(publicDocsPath, 'README.md'));
            const guideExists = await fse.pathExists(path.join(publicDocsPath, 'guide.md'));
            expect(readmeExists).toBe(true);
            expect(guideExists).toBe(true);
        });
    });
});
