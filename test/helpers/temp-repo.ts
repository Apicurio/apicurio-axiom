/**
 * Test helpers for creating temporary test repositories
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * File structure definition for creating test repositories
 */
export interface FileStructure {
    [key: string]: string | FileStructure;
}

/**
 * Create a temporary test repository with the given file structure
 *
 * @param structure File structure definition
 * @param prefix Optional prefix for temp directory name
 * @returns Path to the created temporary directory
 *
 * @example
 * const repoPath = await createTempRepo({
 *   'README.md': '# Test Repo',
 *   'src': {
 *     'index.ts': 'console.log("hello");',
 *     'utils': {
 *       'helper.ts': 'export function help() {}'
 *     }
 *   }
 * });
 */
export async function createTempRepo(structure: FileStructure, prefix = 'axiom-test-'): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));

    async function createStructure(basePath: string, struct: FileStructure): Promise<void> {
        for (const [name, content] of Object.entries(struct)) {
            const itemPath = path.join(basePath, name);

            if (typeof content === 'string') {
                // It's a file
                await fs.writeFile(itemPath, content, 'utf-8');
            } else {
                // It's a directory
                await fs.mkdir(itemPath, { recursive: true });
                await createStructure(itemPath, content);
            }
        }
    }

    await createStructure(tmpDir, structure);
    return tmpDir;
}

/**
 * Clean up a temporary test repository
 *
 * @param dir Path to the temporary directory to remove
 */
export async function cleanupTempRepo(dir: string): Promise<void> {
    try {
        await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
        // Ignore errors during cleanup
        console.warn(`Failed to cleanup temp directory ${dir}:`, error);
    }
}

/**
 * Create a temporary repository and automatically clean it up after the test
 * Uses Vitest's beforeEach/afterEach hooks
 *
 * @param structure File structure definition
 * @returns Function that returns the current temp directory path
 *
 * @example
 * const getTempDir = setupTempRepo({
 *   'file.txt': 'content'
 * });
 *
 * it('should read file', async () => {
 *   const dir = getTempDir();
 *   // ... test code using dir
 * });
 */
export function setupTempRepo(structure: FileStructure): () => string {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempRepo(structure);
    });

    afterEach(async () => {
        if (tempDir) {
            await cleanupTempRepo(tempDir);
        }
    });

    return () => tempDir;
}
