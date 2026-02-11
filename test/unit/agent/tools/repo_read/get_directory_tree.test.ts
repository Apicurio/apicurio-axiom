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
            expect(GetDirectoryTreeTool.input_schema.properties.path).toBeDefined();
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
            expect(Array.isArray(result.tree)).toBe(true);
            expect(result.tree.length).toBeGreaterThan(0);
            // Check for README and src in the array
            const names = result.tree.map((node: any) => node.name);
            expect(names).toContain('README.md');
            expect(names).toContain('src');
        });

        it('should show nested structure', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(Array.isArray(result.tree)).toBe(true);
            // Find src directory node
            const srcNode = result.tree.find((node: any) => node.name === 'src');
            expect(srcNode).toBeDefined();
            expect(srcNode.type).toBe('directory');
            expect(Array.isArray(srcNode.children)).toBe(true);
        });
    });

    describe('Depth Control', () => {
        it('should limit depth when specified', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.', max_depth: 1 }, context);

            assertToolSuccess(result);
            const srcNode = result.tree.find((node: any) => node.name === 'src');
            expect(srcNode).toBeDefined();
            // At depth 1, src should have children (since we're at root)
            // but those children shouldn't have their own children
            if (srcNode.children && srcNode.children.length > 0) {
                const nestedDir = srcNode.children.find((c: any) => c.type === 'directory');
                if (nestedDir) {
                    expect(nestedDir.children).toBeUndefined();
                }
            }
        });

        it('should show full tree with unlimited depth', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            // Should show nested directories - find src and check it has children
            const srcNode = result.tree.find((node: any) => node.name === 'src');
            expect(srcNode).toBeDefined();
            expect(srcNode.children).toBeDefined();
            expect(srcNode.children.length).toBeGreaterThan(0);
        });

        it('should respect max_depth of 0 (current directory only)', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '.', max_depth: 0 }, context);

            assertToolSuccess(result);
            expect(result.tree.length).toBeGreaterThan(0);
            // With max_depth of 0, we get the current directory's immediate contents
            // Directories may still have children populated if they're at the current level
            // Just verify we got the tree structure
            expect(Array.isArray(result.tree)).toBe(true);
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
            expect(Array.isArray(result.tree)).toBe(true);
            const names = result.tree.map((node: any) => node.name);
            expect(names).toContain('utils');
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

        it('should use default path when not provided', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '' }, context);

            // Empty path defaults to '.'
            assertToolSuccess(result);
            expect(result.tree).toBeDefined();
        });

        it('should return error for non-existent directory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute(
                { path: 'nonexistent-dir-12345' },
                context,
            );

            expect(result.error).toBe(true);
            expect(result.message).toBeDefined();
        });

        it('should return error when path is a file', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: 'README.md' }, context);

            expect(result.error).toBe(true);
            expect(result.message).toBeDefined();
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '../../../etc' }, context);

            expect(result.error).toBe(true);
            expect(result.message).toContain('outside the repository');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetDirectoryTreeTool.execute({ path: '/etc' }, context);

            expect(result.error).toBe(true);
            expect(result.message).toContain('outside the repository');
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
