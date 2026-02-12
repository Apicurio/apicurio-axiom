/**
 * Tests for ApplyPatchTool (FM-010)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplyPatchTool } from '../../../../../src/agent/tools/repo_write/apply_patch.js';
import { assertToolError, assertToolSuccess } from '../../../../helpers/assertions.js';
import { createMockContext } from '../../../../helpers/mock-context.js';

describe.sequential('ApplyPatchTool', () => {
    let tempDir: string;
    const baseTempDir = path.join(process.cwd(), 'test', 'temp');

    // Create a fresh temp directory for each test
    beforeEach(async () => {
        tempDir = path.join(baseTempDir, `apply-patch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            expect(ApplyPatchTool.name).toBe('repo_write-apply_patch');
            expect(ApplyPatchTool.description).toContain('Apply a unified diff patch');
            expect(ApplyPatchTool.input_schema.required).toContain('patch');
        });

        it('should apply a simple patch to modify a file', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'line 1\nline 2\nline 3\n');

            const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 modified
 line 3
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);
            expect(result.files_modified).toEqual(['test.txt']);
            expect(result.hunks_applied).toBe(1);
            expect(result.hunks_failed).toBe(0);
            expect(result.errors).toEqual([]);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('line 1\nline 2 modified\nline 3\n');
        });

        it('should apply patch with multiple hunks', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'line 1\nline 2\nline 3\nline 4\nline 5\n');

            const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,2 @@
-line 1
+line 1 changed
 line 2
@@ -4,2 +4,2 @@
 line 4
-line 5
+line 5 changed
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);
            expect(result.hunks_applied).toBe(2);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('line 1 changed\nline 2\nline 3\nline 4\nline 5 changed\n');
        });

        it('should apply patch to multiple files', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content 1\n');
            await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content 2\n');

            const patch = `--- a/file1.txt
+++ b/file1.txt
@@ -1 +1 @@
-content 1
+content 1 modified
--- a/file2.txt
+++ b/file2.txt
@@ -1 +1 @@
-content 2
+content 2 modified
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);
            expect(result.files_modified).toEqual(['file1.txt', 'file2.txt']);
            expect(result.hunks_applied).toBe(2);

            const content1 = await fs.readFile(path.join(tempDir, 'file1.txt'), 'utf-8');
            const content2 = await fs.readFile(path.join(tempDir, 'file2.txt'), 'utf-8');
            expect(content1).toBe('content 1 modified\n');
            expect(content2).toBe('content 2 modified\n');
        });
    });

    describe('File Creation', () => {
        it('should create a new file from patch', async () => {
            const context = createMockContext(tempDir);

            const patch = `--- /dev/null
+++ b/newfile.txt
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);
            expect(result.files_modified).toEqual(['newfile.txt']);
            expect(result.hunks_applied).toBe(1);

            const filePath = path.join(tempDir, 'newfile.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('line 1\nline 2\nline 3');
        });

        it('should create file in subdirectory', async () => {
            const context = createMockContext(tempDir);

            const patch = `--- /dev/null
+++ b/subdir/newfile.txt
@@ -0,0 +1,2 @@
+new content
+second line
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);

            const filePath = path.join(tempDir, 'subdir', 'newfile.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('new content\nsecond line');
        });

        it('should return error when creating file that already exists', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'existing.txt');

            await fs.writeFile(filePath, 'already exists\n');

            const patch = `--- /dev/null
+++ b/existing.txt
@@ -0,0 +1 @@
+new content
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            expect(result.success).toBe(false);
            expect(result.errors).toContain('File already exists: existing.txt');
            expect(result.hunks_failed).toBe(1);
        });
    });

    describe('File Deletion', () => {
        it('should delete a file via patch', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'todelete.txt');

            await fs.writeFile(filePath, 'will be deleted\n');

            const patch = `--- a/todelete.txt
+++ /dev/null
@@ -1 +0,0 @@
-will be deleted
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);
            expect(result.files_modified).toEqual(['todelete.txt']);
            expect(result.hunks_applied).toBe(1);

            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);
        });

        it('should return error when deleting non-existent file', async () => {
            const context = createMockContext(tempDir);

            const patch = `--- a/nonexistent.txt
+++ /dev/null
@@ -1 +0,0 @@
-content
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            expect(result.success).toBe(false);
            expect(result.errors).toContain('File does not exist for deletion: nonexistent.txt');
            expect(result.hunks_failed).toBe(1);
        });
    });

    describe('Reverse Mode', () => {
        it('should reverse a modification patch', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'line 1\nline 2 modified\nline 3\n');

            const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 modified
 line 3
`;

            const result = await ApplyPatchTool.execute({ patch, reverse: true }, context);

            assertToolSuccess(result);
            expect(result.files_modified).toEqual(['test.txt']);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('line 1\nline 2\nline 3\n');
        });

        it('should reverse a file creation (recreate from old content)', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'created.txt');

            await fs.writeFile(filePath, 'line 1\nline 2');

            const patch = `--- /dev/null
+++ b/created.txt
@@ -0,0 +1,2 @@
+line 1
+line 2
`;

            const result = await ApplyPatchTool.execute({ patch, reverse: true }, context);

            assertToolSuccess(result);
            expect(result.files_modified).toEqual(['created.txt']);

            // In reverse mode, this is treated as a deletion being reversed (creation from old content)
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);
        });

        it('should handle reverse mode for additional scenarios', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            // File currently has the "after" state
            await fs.writeFile(filePath, 'modified line\n');

            const patch = `--- a/test.txt
+++ b/test.txt
@@ -1 +1 @@
-original line
+modified line
`;

            // Apply in reverse to go back to original
            const result = await ApplyPatchTool.execute({ patch, reverse: true }, context);

            assertToolSuccess(result);

            // Should have reverted to original line
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('original line\n');
        });
    });

    describe('Dry Run Mode', () => {
        it('should test patch without applying in dry_run mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'line 1\nline 2\nline 3\n');

            const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 modified
 line 3
`;

            const result = await ApplyPatchTool.execute({ patch, dry_run: true }, context);

            assertToolSuccess(result);
            expect(result.files_modified).toEqual(['test.txt']);
            expect(result.hunks_applied).toBe(1);

            // Verify file unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('line 1\nline 2\nline 3\n');
        });

        it('should not create file in dry_run mode', async () => {
            const context = createMockContext(tempDir);

            const patch = `--- /dev/null
+++ b/newfile.txt
@@ -0,0 +1,2 @@
+line 1
+line 2
`;

            const result = await ApplyPatchTool.execute({ patch, dry_run: true }, context);

            assertToolSuccess(result);
            expect(result.files_modified).toEqual(['newfile.txt']);

            // Verify file not created
            const filePath = path.join(tempDir, 'newfile.txt');
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(false);
        });

        it('should not delete file in dry_run mode', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'todelete.txt');

            await fs.writeFile(filePath, 'content\n');

            const patch = `--- a/todelete.txt
+++ /dev/null
@@ -1 +0,0 @@
-content
`;

            const result = await ApplyPatchTool.execute({ patch, dry_run: true }, context);

            assertToolSuccess(result);

            // Verify file still exists
            const exists = await fse.pathExists(filePath);
            expect(exists).toBe(true);
        });

        it('should detect errors in dry_run mode', async () => {
            const context = createMockContext(tempDir);

            const patch = `--- a/nonexistent.txt
+++ b/nonexistent.txt
@@ -1 +1 @@
-old
+new
`;

            const result = await ApplyPatchTool.execute({ patch, dry_run: true }, context);

            expect(result.success).toBe(false);
            expect(result.errors).toContain('File does not exist: nonexistent.txt');
        });
    });

    describe('Error Handling', () => {
        it('should require workDir in context', async () => {
            const context = createMockContext('');
            context.workDir = undefined as any;

            const result = await ApplyPatchTool.execute({ patch: 'dummy' }, context);

            assertToolError(result, 'workDir is required');
        });

        it('should require patch parameter', async () => {
            const context = createMockContext(tempDir);
            const result = await ApplyPatchTool.execute({ patch: '' }, context);

            assertToolError(result, 'patch parameter is required');
        });

        it('should validate patch is a string', async () => {
            const context = createMockContext(tempDir);
            const result = await ApplyPatchTool.execute({ patch: 123 as any }, context);

            assertToolError(result, 'must be a string');
        });

        it('should handle empty or invalid patch gracefully', async () => {
            const context = createMockContext(tempDir);

            const result = await ApplyPatchTool.execute(
                { patch: 'not a valid unified diff format\nrandom text' },
                context,
            );

            // Invalid patches return success: false with errors array
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should return error when file does not exist', async () => {
            const context = createMockContext(tempDir);

            const patch = `--- a/missing.txt
+++ b/missing.txt
@@ -1 +1 @@
-old
+new
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            expect(result.success).toBe(false);
            expect(result.errors).toContain('File does not exist: missing.txt');
            expect(result.hunks_failed).toBe(1);
        });

        it('should return error when patch does not match file content', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'different content\n');

            const patch = `--- a/test.txt
+++ b/test.txt
@@ -1 +1 @@
-expected content
+new content
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.hunks_failed).toBe(1);
        });

        it('should handle partial success when some hunks fail', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content 1\n');
            // file2.txt doesn't exist

            const patch = `--- a/file1.txt
+++ b/file1.txt
@@ -1 +1 @@
-content 1
+content 1 modified
--- a/file2.txt
+++ b/file2.txt
@@ -1 +1 @@
-old
+new
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            expect(result.success).toBe(false);
            expect(result.files_modified).toEqual(['file1.txt']);
            expect(result.hunks_applied).toBe(1);
            expect(result.hunks_failed).toBe(1);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Security', () => {
        it('should reject patches to files outside work directory', async () => {
            const context = createMockContext(tempDir);

            const patch = `--- a/../../../etc/passwd
+++ b/../../../etc/passwd
@@ -1 +1 @@
-old
+new
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            expect(result.success).toBe(false);
            expect(result.errors.some((e) => e.includes('outside work directory'))).toBe(true);
        });

        it('should reject file creation outside work directory', async () => {
            const context = createMockContext(tempDir);

            const patch = `--- /dev/null
+++ b/../../../tmp/malicious.txt
@@ -0,0 +1 @@
+malicious
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            expect(result.success).toBe(false);
            expect(result.errors.some((e) => e.includes('outside work directory'))).toBe(true);
        });
    });

    describe('Mock Execution', () => {
        it('should call execute with dry_run=true in executeMock', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'test.txt');

            await fs.writeFile(filePath, 'original\n');

            const patch = `--- a/test.txt
+++ b/test.txt
@@ -1 +1 @@
-original
+modified
`;

            const result = await ApplyPatchTool.executeMock({ patch }, context);

            expect(result.success).toBe(true);
            expect(result.files_modified).toEqual(['test.txt']);

            // Verify file unchanged
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('original\n');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should apply code refactoring patch', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'utils.ts');

            await fs.writeFile(
                filePath,
                `export function oldName(x: number) {
    return x * 2;
}
`,
            );

            const patch = `--- a/utils.ts
+++ b/utils.ts
@@ -1,3 +1,3 @@
-export function oldName(x: number) {
+export function newName(x: number) {
     return x * 2;
 }
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('newName');
            expect(content).not.toContain('oldName');
        });

        it('should apply bug fix patch', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'validator.ts');

            await fs.writeFile(
                filePath,
                `function validate(input: string) {
    if (input.length = 0) {
        return false;
    }
    return true;
}
`,
            );

            const patch = `--- a/validator.ts
+++ b/validator.ts
@@ -1,5 +1,5 @@
 function validate(input: string) {
-    if (input.length = 0) {
+    if (input.length === 0) {
         return false;
     }
     return true;
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('input.length === 0');
        });

        it('should apply feature addition patch', async () => {
            const context = createMockContext(tempDir);
            const filePath = path.join(tempDir, 'config.json');

            await fs.writeFile(
                filePath,
                `{
  "name": "myapp",
  "version": "1.0.0"
}
`,
            );

            const patch = `--- a/config.json
+++ b/config.json
@@ -1,4 +1,5 @@
 {
   "name": "myapp",
-  "version": "1.0.0"
+  "version": "1.0.0",
+  "debug": true
 }
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);

            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('"debug": true');
        });

        it('should apply multi-file refactoring patch', async () => {
            const context = createMockContext(tempDir);

            await fs.writeFile(path.join(tempDir, 'module1.ts'), 'import { OldClass } from "./types";\n');
            await fs.writeFile(path.join(tempDir, 'module2.ts'), 'import { OldClass } from "./types";\n');

            const patch = `--- a/module1.ts
+++ b/module1.ts
@@ -1 +1 @@
-import { OldClass } from "./types";
+import { NewClass } from "./types";
--- a/module2.ts
+++ b/module2.ts
@@ -1 +1 @@
-import { OldClass } from "./types";
+import { NewClass } from "./types";
`;

            const result = await ApplyPatchTool.execute({ patch }, context);

            assertToolSuccess(result);
            expect(result.files_modified).toEqual(['module1.ts', 'module2.ts']);
            expect(result.hunks_applied).toBe(2);
        });
    });
});
