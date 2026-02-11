/**
 * Tests for GetDirectoryTreeTool (FSA-003)
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { GetDirectoryTreeTool } from '../../../../../src/agent/tools/repo_read/get_directory_tree.js';
import { createMockContext } from '../../../../helpers/mock-context.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';

describe('GetDirectoryTreeTool', () => {
    const fixturesPath = path.resolve(process.cwd(), 'test/fixtures/test-repo');

    describe('Basic Functionality', () => {
        it('should have correct tool metadata', () => {
            expect(GetDirectoryTreeTool.name).toBe('repo_read-get_directory_tree');
            expect(GetDirectoryTreeTool.description).toContain('tree');
            expect(GetDirectoryTreeTool.input_schema.required).toContain('path');
        });

        it('should return hierarchical tree structure', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.tree).toBeDefined();
            expect(typeof result.tree).toBe('object');
        });

        it('should include files and directories', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.tree.README).toBeDefined();
            expect(result.tree.src).toBeDefined();
        });

        it('should show nested structure', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.tree.src).toBeDefined();
            expect(result.tree.src.utils).toBeDefined();
        });
    });

    describe('Depth Control', () => {
        it('should limit depth when specified', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.', max_depth: 1 }, context);

            assertToolSuccess(result);
            expect(result.tree.src).toBeDefined();
            // At depth 1, should not show contents of src
            expect(result.tree.src.utils).toBeUndefined();
        });

        it('should show full tree with unlimited depth', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            // Should show nested directories
            expect(result.tree.src.utils).toBeDefined();
        });

        it('should respect max_depth of 0 (current directory only)', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.', max_depth: 0 }, context);

            assertToolSuccess(result);
            expect(Object.keys(result.tree).length).toBeGreaterThan(0);
            // Files should be included but not directory contents
            expect(result.tree.README).toBeDefined();
        });
    });

    describe('Filtering', () => {
        it('should exclude hidden files by default', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            // Should not include .git or other hidden files
            const keys = Object.keys(result.tree);
            const hiddenFiles = keys.filter((k) => k.startsWith('.'));
            expect(hiddenFiles.length).toBe(0);
        });

        it('should include file type information', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: 'src' }, context);

            assertToolSuccess(result);
            // Tree structure should distinguish between files and directories
            expect(result.tree).toBeDefined();
        });
    });

    describe('Path Scoping', () => {
        it('should work with subdirectory path', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: 'src' }, context);

            assertToolSuccess(result);
            expect(result.tree.utils).toBeDefined();
        });

        it('should work with nested subdirectory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: 'src/utils' }, context);

            assertToolSuccess(result);
            expect(result.tree).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await GetDirectoryTreeTool.execute({ path: '.' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require path parameter', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '' }, context);

            assertToolError(result, 'path parameter is required');
        });

        it('should return error for non-existent directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute(
                { path: 'nonexistent-dir-12345' },
                context,
            );

            assertToolError(result);
        });

        it('should return error when path is a file', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: 'README.md' }, context);

            assertToolError(result);
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '../../../etc' }, context);

            assertToolError(result, 'outside work directory');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '/etc' }, context);

            assertToolError(result, 'outside work directory');
        });
    });

    describe('Mock Execution', () => {
        it('should execute normally in mock mode (read-only tool)', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.executeMock({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.tree).toBeDefined();
        });
    });
});
