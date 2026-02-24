/**
 * Tests for CreateDirectoryTool (FM-009)
 */

import * as path from 'node:path';
import * as fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateDirectoryTool } from '../../../../../src/agent/tools/repo_write/create_directory.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';

describe.sequential('CreateDirectoryTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `create-dir-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            expect(CreateDirectoryTool.name).toBe('repo_write-create_directory');
            expect(CreateDirectoryTool.description).toContain('Create a new directory');
            expect(CreateDirectoryTool.input_schema.required).toContain('path');
        });

        it('should create a simple directory', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.execute({ path: 'newdir' }, context);

            assertToolSuccess(result);
            expect(result.path).toBe('newdir');
            expect(result.created).toBe(true);
            expect(result.parents_created).toEqual(['newdir']);

            // Verify directory exists
            const dirPath = path.join(tempDir, 'newdir');
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(true);
        });

        it('should create nested directories by default', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.execute({ path: 'a/b/c' }, context);

            assertToolSuccess(result);
            expect(result.path).toBe('a/b/c');
            expect(result.created).toBe(true);
            expect(result.parents_created).toEqual(['a', path.join('a', 'b'), path.join('a', 'b', 'c')]);

            // Verify all directories exist
            const dirPath = path.join(tempDir, 'a', 'b', 'c');
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(true);
        });

        it('should create nested directories with recursive true', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.execute({ path: 'x/y/z', recursive: true }, context);

            assertToolSuccess(result);
            expect(result.created).toBe(true);
            expect(result.parents_created).toEqual(['x', path.join('x', 'y'), path.join('x', 'y', 'z')]);

            const dirPath = path.join(tempDir, 'x', 'y', 'z');
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(true);
        });

        it('should succeed idempotently when directory already exists', async () => {
            const context = createMockContext(tempDir);
            const dirPath = path.join(tempDir, 'existing');

            // Create directory first
            await fse.ensureDir(dirPath);

            const result = await CreateDirectoryTool.execute({ path: 'existing' }, context);

            assertToolSuccess(result);
            expect(result.path).toBe('existing');
            expect(result.created).toBe(false);
            expect(result.parents_created).toEqual([]);
        });

        it('should track which parents were created', async () => {
            const context = createMockContext(tempDir);

            // Create parent 'a' first
            await fse.ensureDir(path.join(tempDir, 'a'));

            const result = await CreateDirectoryTool.execute({ path: 'a/b/c' }, context);

            assertToolSuccess(result);
            expect(result.created).toBe(true);
            // Only b and c should be in parents_created since a already existed
            expect(result.parents_created).toEqual([path.join('a', 'b'), path.join('a', 'b', 'c')]);
        });
    });

    describe('Recursive Flag', () => {
        it('should create directory without parents when recursive is false and parent exists', async () => {
            const context = createMockContext(tempDir);

            // Create parent first
            await fse.ensureDir(path.join(tempDir, 'parent'));

            const result = await CreateDirectoryTool.execute({ path: 'parent/child', recursive: false }, context);

            assertToolSuccess(result);
            expect(result.created).toBe(true);
            expect(result.parents_created).toEqual(['parent/child']);

            const childPath = path.join(tempDir, 'parent', 'child');
            const exists = await fse.pathExists(childPath);
            expect(exists).toBe(true);
        });

        it('should return error when recursive is false and parent does not exist', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.execute({ path: 'nonexistent/child', recursive: false }, context);

            assertToolError(result, 'Parent directory does not exist');

            // Verify directory not created
            const childPath = path.join(tempDir, 'nonexistent', 'child');
            const exists = await fse.pathExists(childPath);
            expect(exists).toBe(false);
        });

        it('should handle deeply nested paths when recursive is false and all parents exist', async () => {
            const context = createMockContext(tempDir);

            // Create all parents
            await fse.ensureDir(path.join(tempDir, 'a', 'b', 'c'));

            const result = await CreateDirectoryTool.execute({ path: 'a/b/c/d', recursive: false }, context);

            assertToolSuccess(result);
            expect(result.created).toBe(true);

            const dirPath = path.join(tempDir, 'a', 'b', 'c', 'd');
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(true);
        });
    });

    describe('Parent Tracking', () => {
        it('should track all created directories in deeply nested path', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.execute({ path: 'level1/level2/level3/level4' }, context);

            assertToolSuccess(result);
            expect(result.parents_created).toEqual([
                'level1',
                path.join('level1', 'level2'),
                path.join('level1', 'level2', 'level3'),
                path.join('level1', 'level2', 'level3', 'level4'),
            ]);
        });

        it('should track only newly created parents when some exist', async () => {
            const context = createMockContext(tempDir);

            // Create first two levels
            await fse.ensureDir(path.join(tempDir, 'l1', 'l2'));

            const result = await CreateDirectoryTool.execute({ path: 'l1/l2/l3/l4' }, context);

            assertToolSuccess(result);
            // Only l3 and l4 should be tracked
            expect(result.parents_created).toEqual([path.join('l1', 'l2', 'l3'), path.join('l1', 'l2', 'l3', 'l4')]);
        });

        it('should return empty array when directory already exists', async () => {
            const context = createMockContext(tempDir);

            await fse.ensureDir(path.join(tempDir, 'existing'));

            const result = await CreateDirectoryTool.execute({ path: 'existing' }, context);

            assertToolSuccess(result);
            expect(result.parents_created).toEqual([]);
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await CreateDirectoryTool.execute({ path: 'newdir' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await CreateDirectoryTool.execute({ path: '' }, context);

            assertToolError(result, 'path parameter is required');
        });

        it('should validate path is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await CreateDirectoryTool.execute({ path: 123 as any }, context);

            assertToolError(result, 'must be a string');
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(tempDir);
            const result = await CreateDirectoryTool.execute({ path: '../../../tmp/malicious' }, context);

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(tempDir);
            const result = await CreateDirectoryTool.execute({ path: '/tmp/malicious' }, context);

            assertToolError(result, 'outside work directory');
        });

        it('should allow absolute paths within workDir', async () => {
            const context = createMockContext(tempDir);
            const absolutePath = path.join(tempDir, 'allowed');

            const result = await CreateDirectoryTool.execute({ path: absolutePath }, context);

            assertToolSuccess(result);

            const exists = await fse.pathExists(absolutePath);
            expect(exists).toBe(true);
        });
    });

    describe('Mock Execution', () => {
        it('should not create directory in mock mode', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.executeMock({ path: 'newdir' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.success).toBe(true);
            expect(result.path).toBe('newdir');
            expect(result.created).toBe(true);
            expect(result.parents_created).toEqual(['newdir']);

            // Verify directory not created
            const dirPath = path.join(tempDir, 'newdir');
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(false);
        });

        it('should simulate nested directory creation in mock mode', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.executeMock({ path: 'a/b/c' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.created).toBe(true);
            expect(result.parents_created).toEqual(['a', path.join('a', 'b'), path.join('a', 'b', 'c')]);

            // Verify directories not created
            const dirPath = path.join(tempDir, 'a');
            const exists = await fse.pathExists(dirPath);
            expect(exists).toBe(false);
        });

        it('should detect existing directory in mock mode', async () => {
            const context = createMockContext(tempDir);

            await fse.ensureDir(path.join(tempDir, 'existing'));

            const result = await CreateDirectoryTool.executeMock({ path: 'existing' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.created).toBe(false);
            expect(result.parents_created).toEqual([]);
            expect(result.message).toContain('already exists');
        });

        it('should track partial creation in mock mode', async () => {
            const context = createMockContext(tempDir);

            await fse.ensureDir(path.join(tempDir, 'a'));

            const result = await CreateDirectoryTool.executeMock({ path: 'a/b/c' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.parents_created).toEqual([path.join('a', 'b'), path.join('a', 'b', 'c')]);
        });

        it('should validate recursive flag in mock mode', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.executeMock(
                { path: 'nonexistent/child', recursive: false },
                context,
            );

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('Parent directory does not exist');
        });

        it('should validate security in mock mode', async () => {
            const context = createMockContext(tempDir);
            const result = await CreateDirectoryTool.executeMock({ path: '../../../tmp/malicious' }, context);

            expect(result.dry_run).toBe(true);
            expect(result.error).toBe(true);
            expect(result.message).toContain('outside work directory');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should create source directory structure', async () => {
            const context = createMockContext(tempDir);

            await CreateDirectoryTool.execute({ path: 'src/components' }, context);
            await CreateDirectoryTool.execute({ path: 'src/utils' }, context);
            await CreateDirectoryTool.execute({ path: 'src/types' }, context);

            const componentsExists = await fse.pathExists(path.join(tempDir, 'src', 'components'));
            const utilsExists = await fse.pathExists(path.join(tempDir, 'src', 'utils'));
            const typesExists = await fse.pathExists(path.join(tempDir, 'src', 'types'));

            expect(componentsExists).toBe(true);
            expect(utilsExists).toBe(true);
            expect(typesExists).toBe(true);
        });

        it('should create test directory structure', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.execute({ path: 'test/unit/components' }, context);

            assertToolSuccess(result);

            const testPath = path.join(tempDir, 'test', 'unit', 'components');
            const exists = await fse.pathExists(testPath);
            expect(exists).toBe(true);
        });

        it('should create build output directories', async () => {
            const context = createMockContext(tempDir);

            await CreateDirectoryTool.execute({ path: 'dist/assets/images' }, context);
            await CreateDirectoryTool.execute({ path: 'dist/assets/fonts' }, context);

            const imagesExists = await fse.pathExists(path.join(tempDir, 'dist', 'assets', 'images'));
            const fontsExists = await fse.pathExists(path.join(tempDir, 'dist', 'assets', 'fonts'));

            expect(imagesExists).toBe(true);
            expect(fontsExists).toBe(true);
        });

        it('should create log directory with subdirectories', async () => {
            const context = createMockContext(tempDir);

            const result = await CreateDirectoryTool.execute({ path: 'logs/application/errors' }, context);

            assertToolSuccess(result);
            expect(result.parents_created.length).toBe(3);

            const logsPath = path.join(tempDir, 'logs', 'application', 'errors');
            const exists = await fse.pathExists(logsPath);
            expect(exists).toBe(true);
        });

        it('should create module directories for monorepo', async () => {
            const context = createMockContext(tempDir);

            await CreateDirectoryTool.execute({ path: 'packages/core/src' }, context);
            await CreateDirectoryTool.execute({ path: 'packages/ui/src' }, context);
            await CreateDirectoryTool.execute({ path: 'packages/utils/src' }, context);

            const coreExists = await fse.pathExists(path.join(tempDir, 'packages', 'core', 'src'));
            const uiExists = await fse.pathExists(path.join(tempDir, 'packages', 'ui', 'src'));
            const utilsExists = await fse.pathExists(path.join(tempDir, 'packages', 'utils', 'src'));

            expect(coreExists).toBe(true);
            expect(uiExists).toBe(true);
            expect(utilsExists).toBe(true);
        });

        it('should create documentation structure', async () => {
            const context = createMockContext(tempDir);

            await CreateDirectoryTool.execute({ path: 'docs/api' }, context);
            await CreateDirectoryTool.execute({ path: 'docs/guides' }, context);
            await CreateDirectoryTool.execute({ path: 'docs/examples' }, context);

            const apiExists = await fse.pathExists(path.join(tempDir, 'docs', 'api'));
            const guidesExists = await fse.pathExists(path.join(tempDir, 'docs', 'guides'));
            const examplesExists = await fse.pathExists(path.join(tempDir, 'docs', 'examples'));

            expect(apiExists).toBe(true);
            expect(guidesExists).toBe(true);
            expect(examplesExists).toBe(true);
        });

        it('should handle creating same directory multiple times', async () => {
            const context = createMockContext(tempDir);

            const result1 = await CreateDirectoryTool.execute({ path: 'cache' }, context);
            const result2 = await CreateDirectoryTool.execute({ path: 'cache' }, context);
            const result3 = await CreateDirectoryTool.execute({ path: 'cache' }, context);

            assertToolSuccess(result1);
            assertToolSuccess(result2);
            assertToolSuccess(result3);

            expect(result1.created).toBe(true);
            expect(result2.created).toBe(false);
            expect(result3.created).toBe(false);
        });
    });
});
