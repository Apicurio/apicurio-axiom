/**
 * Tests for MoveFileTool (FM-007)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MoveFileTool } from '../../../../../src/agent/tools/repo_write/move_file.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';

describe.sequential('MoveFileTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `move-file-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            expect(MoveFileTool.name).toBe('repo_write-move_file');
            expect(MoveFileTool.description).toContain('Move or rename');
            expect(MoveFileTool.input_schema.required).toContain('source');
            expect(MoveFileTool.input_schema.required).toContain('destination');
        });

        it('should move a file', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');
            const destPath = path.join(tempDir, 'dest.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await MoveFileTool.execute({ source: 'source.txt', destination: 'dest.txt' }, context);

            assertToolSuccess(result);
            expect(result.source).toBe('source.txt');
            expect(result.destination).toBe('dest.txt');
            expect(result.type).toBe('file');
            expect(result.overwritten).toBe(false);

            // Verify source no longer exists
            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(false);

            // Verify destination exists with correct content
            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(true);
            const content = await fs.readFile(destPath, 'utf-8');
            expect(content).toBe('content');
        });

        it('should rename a file', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'old-name.txt');
            const destPath = path.join(tempDir, 'new-name.txt');

            await fs.writeFile(sourcePath, 'data');

            const result = await MoveFileTool.execute({ source: 'old-name.txt', destination: 'new-name.txt' }, context);

            assertToolSuccess(result);

            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(false);

            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(true);
        });

        it('should move a directory', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'sourcedir');
            const destDir = path.join(tempDir, 'destdir');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'content2');

            const result = await MoveFileTool.execute({ source: 'sourcedir', destination: 'destdir' }, context);

            assertToolSuccess(result);
            expect(result.type).toBe('directory');

            // Verify source directory is gone
            const sourceExists = await fse.pathExists(sourceDir);
            expect(sourceExists).toBe(false);

            // Verify destination directory exists with files
            const destExists = await fse.pathExists(destDir);
            expect(destExists).toBe(true);
            const file1Exists = await fse.pathExists(path.join(destDir, 'file1.txt'));
            const file2Exists = await fse.pathExists(path.join(destDir, 'file2.txt'));
            expect(file1Exists).toBe(true);
            expect(file2Exists).toBe(true);
        });

        it('should move file to subdirectory', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'file.txt');
            const destPath = path.join(tempDir, 'subdir', 'file.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await MoveFileTool.execute({ source: 'file.txt', destination: 'subdir/file.txt' }, context);

            assertToolSuccess(result);

            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(false);

            const destExists = await fse.pathExists(destPath);
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

            const result = await MoveFileTool.execute(
                { source: 'source.txt', destination: 'dest.txt', overwrite: false },
                context,
            );

            assertToolError(result, 'Destination already exists');

            // Verify source still exists
            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(true);

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

            const result = await MoveFileTool.execute(
                { source: 'source.txt', destination: 'dest.txt', overwrite: true },
                context,
            );

            assertToolSuccess(result);
            expect(result.overwritten).toBe(true);

            // Verify source no longer exists
            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(false);

            // Verify destination has source content
            const content = await fs.readFile(destPath, 'utf-8');
            expect(content).toBe('source content');
        });

        it('should overwrite directory with overwrite flag', async () => {
            const context = createMockContext(tempDir);
            const sourceDir = path.join(tempDir, 'source');
            const destDir = path.join(tempDir, 'dest');

            await fse.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'new.txt'), 'new');

            await fse.ensureDir(destDir);
            await fs.writeFile(path.join(destDir, 'old.txt'), 'old');

            const result = await MoveFileTool.execute(
                { source: 'source', destination: 'dest', overwrite: true },
                context,
            );

            assertToolSuccess(result);
            expect(result.overwritten).toBe(true);

            // Verify destination has source content
            const newFileExists = await fse.pathExists(path.join(destDir, 'new.txt'));
            expect(newFileExists).toBe(true);
        });

        it('should set overwritten to false when destination does not exist', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await MoveFileTool.execute({ source: 'source.txt', destination: 'dest.txt' }, context);

            assertToolSuccess(result);
            expect(result.overwritten).toBe(false);
        });
    });

    describe('Directory Creation', () => {
        it('should create parent directories by default', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'file.txt');
            const destPath = path.join(tempDir, 'a', 'b', 'c', 'file.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await MoveFileTool.execute({ source: 'file.txt', destination: 'a/b/c/file.txt' }, context);

            assertToolSuccess(result);

            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(true);
        });

        it('should create parent directories when create_directories is true', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'file.txt');
            const destPath = path.join(tempDir, 'new', 'dir', 'file.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await MoveFileTool.execute(
                { source: 'file.txt', destination: 'new/dir/file.txt', create_directories: true },
                context,
            );

            assertToolSuccess(result);

            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await MoveFileTool.execute({ source: 'source.txt', destination: 'dest.txt' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require source parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await MoveFileTool.execute({ source: '', destination: 'dest.txt' }, context);

            assertToolError(result, 'source parameter is required');
        });

        it('should validate source is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await MoveFileTool.execute({ source: 123 as any, destination: 'dest.txt' }, context);

            assertToolError(result, 'must be a string');
        });

        it('should require destination parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await MoveFileTool.execute({ source: 'source.txt', destination: '' }, context);

            assertToolError(result, 'destination parameter is required');
        });

        it('should validate destination is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await MoveFileTool.execute({ source: 'source.txt', destination: 123 as any }, context);

            assertToolError(result, 'must be a string');
        });

        it('should return error when source does not exist', async () => {
            const context = createMockContext(tempDir);

            const result = await MoveFileTool.execute({ source: 'nonexistent.txt', destination: 'dest.txt' }, context);

            assertToolError(result, 'Source does not exist');
        });

        it('should return error when source and destination are the same', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(filePath, 'content');

            const result = await MoveFileTool.execute({ source: 'file.txt', destination: 'file.txt' }, context);

            assertToolError(result, 'Source and destination paths are the same');
        });

        it('should return error for same path with different notation', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(filePath, 'content');

            const result = await MoveFileTool.execute({ source: 'file.txt', destination: './file.txt' }, context);

            assertToolError(result, 'Source and destination paths are the same');
        });
    });

    describe('Security', () => {
        it('should reject source path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const result = await MoveFileTool.execute(
                { source: '../../../etc/passwd', destination: 'passwd' },
                context,
            );

            assertToolError(result, 'source path is outside work directory');
        });

        it('should reject destination path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await MoveFileTool.execute(
                { source: 'file.txt', destination: '../../../tmp/malicious.txt' },
                context,
            );

            assertToolError(result, 'destination path is outside work directory');

            // Verify file not moved
            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(true);
        });

        it('should reject absolute source paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await MoveFileTool.execute({ source: '/etc/passwd', destination: 'passwd' }, context);

            assertToolError(result, 'source path is outside work directory');
        });

        it('should reject absolute destination paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'file.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await MoveFileTool.execute(
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

            const result = await MoveFileTool.execute({ source: sourcePath, destination: destPath }, context);

            assertToolSuccess(result);

            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(false);

            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(true);
        });
    });

    describe('Mock Execution', () => {
        it('should not move file in mock mode', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');

            await fs.writeFile(sourcePath, 'content');

            const result = await MoveFileTool.executeMock({ source: 'source.txt', destination: 'dest.txt' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.source).toBe('source.txt');
            expect(result.destination).toBe('dest.txt');
            expect(result.type).toBe('file');
            expect(result.overwritten).toBe(false);

            // Verify source still exists
            const sourceExists = await fse.pathExists(sourcePath);
            expect(sourceExists).toBe(true);

            // Verify destination not created
            const destPath = path.join(tempDir, 'dest.txt');
            const destExists = await fse.pathExists(destPath);
            expect(destExists).toBe(false);
        });

        it('should indicate overwrite in mock mode', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');
            const destPath = path.join(tempDir, 'dest.txt');

            await fs.writeFile(sourcePath, 'source content');
            await fs.writeFile(destPath, 'dest content');

            const result = await MoveFileTool.executeMock(
                { source: 'source.txt', destination: 'dest.txt', overwrite: true },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.overwritten).toBe(true);

            // Verify files unchanged
            const sourceContent = await fs.readFile(sourcePath, 'utf-8');
            expect(sourceContent).toBe('source content');
            const destContent = await fs.readFile(destPath, 'utf-8');
            expect(destContent).toBe('dest content');
        });

        it('should validate overwrite in mock mode', async () => {
            const context = createMockContext(tempDir);
            const sourcePath = path.join(tempDir, 'source.txt');
            const destPath = path.join(tempDir, 'dest.txt');

            await fs.writeFile(sourcePath, 'source');
            await fs.writeFile(destPath, 'dest');

            const result = await MoveFileTool.executeMock(
                { source: 'source.txt', destination: 'dest.txt', overwrite: false },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Destination already exists');
        });

        it('should validate source existence in mock mode', async () => {
            const context = createMockContext(tempDir);

            const result = await MoveFileTool.executeMock(
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

            const result = await MoveFileTool.executeMock({ source: 'file.txt', destination: 'file.txt' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Source and destination paths are the same');
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await MoveFileTool.executeMock(
                { source: '../../../etc/passwd', destination: 'passwd' },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('outside work directory');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should rename a configuration file', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'config.dev.json'), '{"env": "dev"}');

            await MoveFileTool.execute({ source: 'config.dev.json', destination: 'config.prod.json' }, context);

            const oldExists = await fse.pathExists(path.join(tempDir, 'config.dev.json'));
            expect(oldExists).toBe(false);

            const newExists = await fse.pathExists(path.join(tempDir, 'config.prod.json'));
            expect(newExists).toBe(true);
        });

        it('should reorganize source files into subdirectories', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'Component.tsx'), 'component');

            await MoveFileTool.execute({ source: 'Component.tsx', destination: 'components/Component.tsx' }, context);

            const newPath = path.join(tempDir, 'components', 'Component.tsx');
            const exists = await fse.pathExists(newPath);
            expect(exists).toBe(true);
        });

        it('should move test files to test directory', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'utils.test.ts'), 'tests');

            await MoveFileTool.execute({ source: 'utils.test.ts', destination: 'test/utils.test.ts' }, context);

            const newPath = path.join(tempDir, 'test', 'utils.test.ts');
            const exists = await fse.pathExists(newPath);
            expect(exists).toBe(true);
        });

        it('should rename directory during refactoring', async () => {
            const context = createMockContext(tempDir);
            const oldDir = path.join(tempDir, 'old-module');

            await fse.ensureDir(oldDir);
            await fs.writeFile(path.join(oldDir, 'index.ts'), 'exports');

            await MoveFileTool.execute({ source: 'old-module', destination: 'new-module' }, context);

            const oldExists = await fse.pathExists(oldDir);
            expect(oldExists).toBe(false);

            const newPath = path.join(tempDir, 'new-module', 'index.ts');
            const newExists = await fse.pathExists(newPath);
            expect(newExists).toBe(true);
        });

        it('should move build output to dist directory', async () => {
            const context = createMockContext(tempDir);
            const buildDir = path.join(tempDir, 'build');

            await fse.ensureDir(buildDir);
            await fs.writeFile(path.join(buildDir, 'bundle.js'), 'code');
            await fs.writeFile(path.join(buildDir, 'bundle.js.map'), 'map');

            await MoveFileTool.execute({ source: 'build', destination: 'dist' }, context);

            const distPath = path.join(tempDir, 'dist');
            const jsExists = await fse.pathExists(path.join(distPath, 'bundle.js'));
            const mapExists = await fse.pathExists(path.join(distPath, 'bundle.js.map'));
            expect(jsExists).toBe(true);
            expect(mapExists).toBe(true);
        });

        it('should update file location with overwrite during migration', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'old.txt'), 'new version');
            await fse.ensureDir(path.join(tempDir, 'data'));
            await fs.writeFile(path.join(tempDir, 'data', 'old.txt'), 'old version');

            await MoveFileTool.execute({ source: 'old.txt', destination: 'data/old.txt', overwrite: true }, context);

            const content = await fs.readFile(path.join(tempDir, 'data', 'old.txt'), 'utf-8');
            expect(content).toBe('new version');
        });
    });
});
