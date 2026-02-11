/**
 * Tests for GetProjectStructureTool (FSA-007)
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { GetProjectStructureTool } from '../../../../../src/agent/tools/repo_read/get_project_structure.js';
import { createMockContext } from '../../../../helpers/mock-context.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';

describe('GetProjectStructureTool', () => {
    const fixturesPath = path.resolve(process.cwd(), 'test/fixtures/test-repo');

    describe('Basic Functionality', () => {
        it('should have correct tool metadata', () => {
            expect(GetProjectStructureTool.name).toBe('repo_read-get_project_structure');
            expect(GetProjectStructureTool.description).toContain('project structure');
            expect(GetProjectStructureTool.input_schema.properties.path).toBeDefined();
        });

        it('should analyze project structure', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.project_type).toBeDefined();
            expect(result.languages).toBeDefined();
        });

        it('should detect project type', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.project_type).toBeDefined();
        });

        it('should identify languages and frameworks', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.languages).toBeDefined();
            expect(result.frameworks).toBeDefined();
        });
    });

    describe('Project Type Detection', () => {
        it('should detect languages from files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.languages).toBeDefined();
            expect(Array.isArray(result.languages)).toBe(true);
            expect(result.languages.length).toBeGreaterThan(0);
        });

        it('should detect TypeScript files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            // Should detect TypeScript from .ts files (languages is an array)
            expect(Array.isArray(result.languages)).toBe(true);
            expect(result.languages).toContain('TypeScript');
        });

        it('should detect Java files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            // Should detect Java from .java files (languages is an array)
            expect(Array.isArray(result.languages)).toBe(true);
            expect(result.languages).toContain('Java');
        });
    });

    describe('Directory Structure', () => {
        it('should identify source directories', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.source_directories).toBeDefined();
            expect(Array.isArray(result.source_directories)).toBe(true);
        });

        it('should identify configuration files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.config_files).toBeDefined();
            expect(Array.isArray(result.config_files)).toBe(true);
        });

        it('should count files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.estimated_size).toBeDefined();
            expect(result.estimated_size.files).toBeGreaterThan(0);
        });
    });

    describe('Build System Detection', () => {
        it('should detect npm from package.json', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            // Should indicate npm-based project
            expect(result.package_managers).toBeDefined();
            expect(Array.isArray(result.package_managers)).toBe(true);
        });
    });

    describe('Statistics', () => {
        it('should provide file count statistics', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.estimated_size).toBeDefined();
            expect(result.estimated_size.files).toBeGreaterThan(0);
        });

        it('should estimate line count', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.estimated_size.lines).toBeGreaterThan(0);
        });

        it('should provide language breakdown', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.languages).toBeDefined();
            expect(Array.isArray(result.languages)).toBe(true);
            expect(result.languages.length).toBeGreaterThan(0);
        });
    });

    describe('Configuration Files', () => {
        it('should identify build files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.build_files).toBeDefined();
            expect(Array.isArray(result.build_files)).toBe(true);
        });

        it('should identify configuration files', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.config_files).toBeDefined();
            expect(Array.isArray(result.config_files)).toBe(true);
        });
    });

    describe('Path Scoping', () => {
        it('should analyze from repository root', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.project_type).toBeDefined();
            expect(result.languages).toBeDefined();
        });

        it('should analyze subdirectory', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: 'src' }, context);

            assertToolSuccess(result);
            expect(result.languages).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await GetProjectStructureTool.execute({ path: '.' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should use default path when not provided', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '' }, context);

            // Empty path defaults to '.'
            assertToolSuccess(result);
        });

        it('should return error for non-existent path', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute(
                { path: 'nonexistent-dir-12345' },
                context,
            );

            assertToolError(result);
        });

        it('should return error when path is a file', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: 'README.md' }, context);

            assertToolError(result);
        });
    });

    describe('Security', () => {
        it('should reject path traversal attempts', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '../../../etc' }, context);

            assertToolError(result, 'outside the repository');
        });

        it('should reject absolute paths outside workDir', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.execute({ path: '/etc' }, context);

            assertToolError(result, 'outside the repository');
        });
    });

    describe('Mock Execution', () => {
        it('should execute normally in mock mode (read-only tool)', async () => {
            const context = createMockContext(fixturesPath);
            const result = await GetProjectStructureTool.executeMock({ path: '.' }, context);

            assertToolSuccess(result);
            expect(result.project_type).toBeDefined();
            expect(result.languages).toBeDefined();
        });
    });
});
