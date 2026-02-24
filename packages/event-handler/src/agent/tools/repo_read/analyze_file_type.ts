/**
 * AnalyzeFileTypeTool - Detect file type, language, and characteristics
 *
 * This tool analyzes a file to determine its programming language, MIME type,
 * whether it's binary or text, and optionally detect frameworks or technologies
 * used in the file. This helps agents understand file contents without parsing.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import fs_extra from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

// Extension to language mapping
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mjs: 'javascript',
    cjs: 'javascript',

    // Java
    java: 'java',
    class: 'java-bytecode',
    jar: 'java-archive',

    // Python
    py: 'python',
    pyw: 'python',
    pyx: 'cython',

    // Web
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',

    // Markup
    xml: 'xml',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    markdown: 'markdown',
    rst: 'restructuredtext',

    // Shell
    sh: 'shell',
    bash: 'bash',
    zsh: 'zsh',
    fish: 'fish',

    // C/C++
    c: 'c',
    h: 'c-header',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp-header',
    hxx: 'cpp-header',

    // Other languages
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    kts: 'kotlin',
    scala: 'scala',
    cs: 'csharp',
    fs: 'fsharp',
    r: 'r',
    sql: 'sql',
    pl: 'perl',
    lua: 'lua',
    vim: 'vimscript',
    el: 'elisp',

    // Config
    toml: 'toml',
    ini: 'ini',
    cfg: 'ini',
    conf: 'config',
    properties: 'properties',

    // Build/Package
    gradle: 'gradle',
    maven: 'maven',
    pom: 'maven',
    dockerfile: 'dockerfile',
    makefile: 'makefile',

    // Data
    csv: 'csv',
    tsv: 'tsv',
    parquet: 'parquet',

    // Documents
    txt: 'text',
    log: 'log',
    pdf: 'pdf',
    doc: 'word',
    docx: 'word',
    xls: 'excel',
    xlsx: 'excel',
    ppt: 'powerpoint',
    pptx: 'powerpoint',

    // Images
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    svg: 'svg',
    webp: 'image',
    ico: 'icon',

    // Archives
    zip: 'zip',
    tar: 'tar',
    gz: 'gzip',
    bz2: 'bzip2',
    xz: 'xz',
    '7z': '7zip',
    rar: 'rar',

    // Compiled/Binary
    exe: 'executable',
    dll: 'library',
    so: 'library',
    dylib: 'library',
    o: 'object',
    a: 'archive',
};

// Extension to MIME type mapping
const EXTENSION_TO_MIME: Record<string, string> = {
    // Text/Code
    js: 'text/javascript',
    jsx: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    java: 'text/x-java',
    py: 'text/x-python',
    html: 'text/html',
    css: 'text/css',
    xml: 'application/xml',
    json: 'application/json',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    md: 'text/markdown',
    txt: 'text/plain',

    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',

    // Archives
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    jar: 'application/java-archive',

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    // Default text types
    sh: 'text/x-shellscript',
    sql: 'text/x-sql',
};

// Binary file magic numbers (first few bytes)
const BINARY_SIGNATURES: Array<{ signature: number[]; type: string }> = [
    { signature: [0x50, 0x4b, 0x03, 0x04], type: 'zip' }, // ZIP/JAR
    { signature: [0x1f, 0x8b], type: 'gzip' }, // GZIP
    { signature: [0x89, 0x50, 0x4e, 0x47], type: 'png' }, // PNG
    { signature: [0xff, 0xd8, 0xff], type: 'jpeg' }, // JPEG
    { signature: [0x47, 0x49, 0x46], type: 'gif' }, // GIF
    { signature: [0x25, 0x50, 0x44, 0x46], type: 'pdf' }, // PDF
    { signature: [0x7f, 0x45, 0x4c, 0x46], type: 'elf' }, // ELF executable
    { signature: [0x4d, 0x5a], type: 'exe' }, // Windows EXE
    { signature: [0xca, 0xfe, 0xba, 0xbe], type: 'java-class' }, // Java class
];

// Framework detection patterns
interface FrameworkPattern {
    pattern: RegExp;
    framework: string;
    fileTypes?: string[]; // Optional: only check for specific file types
}

const FRAMEWORK_PATTERNS: FrameworkPattern[] = [
    // Java frameworks
    { pattern: /@Quarkus|io\.quarkus/i, framework: 'Quarkus', fileTypes: ['java'] },
    { pattern: /@SpringBoot|org\.springframework/i, framework: 'Spring', fileTypes: ['java'] },
    { pattern: /javax\.ws\.rs|jakarta\.ws\.rs/i, framework: 'JAX-RS', fileTypes: ['java'] },
    { pattern: /javax\.persistence|jakarta\.persistence/i, framework: 'JPA', fileTypes: ['java'] },

    // JavaScript/TypeScript frameworks
    { pattern: /from ['"]react['"]|import React/i, framework: 'React', fileTypes: ['js', 'jsx', 'ts', 'tsx'] },
    { pattern: /from ['"]vue['"]|import Vue/i, framework: 'Vue', fileTypes: ['js', 'ts'] },
    { pattern: /from ['"]@angular\/core['"]|import.*@angular/i, framework: 'Angular', fileTypes: ['ts'] },
    { pattern: /from ['"]express['"]|import.*express/i, framework: 'Express', fileTypes: ['js', 'ts'] },
    { pattern: /from ['"]next['"]|import.*next/i, framework: 'Next.js', fileTypes: ['js', 'jsx', 'ts', 'tsx'] },

    // Python frameworks
    { pattern: /from flask import|import flask/i, framework: 'Flask', fileTypes: ['py'] },
    { pattern: /from django\.|import django/i, framework: 'Django', fileTypes: ['py'] },
    { pattern: /from fastapi import|import fastapi/i, framework: 'FastAPI', fileTypes: ['py'] },
];

export const AnalyzeFileTypeTool: Tool = {
    name: 'repo_read-analyze_file_type',
    description:
        'Detect file type, programming language, MIME type, and other characteristics to help understand file contents without parsing',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to file',
            },
        },
        required: ['path'],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns File type analysis or error
     */
    async execute(input: { path: string }, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_read-analyze_file_type',
                    tool: 'repo_read-analyze_file_type',
                };
            }

            // Validate input
            if (!input.path || typeof input.path !== 'string') {
                return {
                    error: true,
                    message: 'path parameter is required and must be a string',
                    tool: this.name,
                };
            }

            context.logger.info(`Analyzing file type: ${input.path}`);

            // Construct full path and validate it's within work directory
            const fullPath = path.resolve(context.workDir, input.path);
            const normalizedWorkDir = path.resolve(context.workDir);

            if (!fullPath.startsWith(normalizedWorkDir)) {
                return {
                    error: true,
                    message: 'Access denied: path is outside work directory',
                    tool: this.name,
                };
            }

            // Check if file exists
            const exists = await fs_extra.pathExists(fullPath);
            if (!exists) {
                return {
                    error: true,
                    message: `File not found: ${input.path}`,
                    tool: this.name,
                };
            }

            // Get file stats
            const stats = await fs.stat(fullPath);

            // Check if it's a directory
            if (stats.isDirectory()) {
                return {
                    error: true,
                    message: `Path is a directory, not a file: ${input.path}`,
                    tool: this.name,
                };
            }

            // Get file extension
            const basename = path.basename(fullPath).toLowerCase();
            let extension = path.extname(basename).substring(1); // Remove leading dot

            // Handle special cases like .gitignore, Dockerfile, Makefile
            if (!extension) {
                if (basename.startsWith('.')) {
                    extension = basename.substring(1);
                } else if (basename === 'dockerfile') {
                    extension = 'dockerfile';
                } else if (basename === 'makefile') {
                    extension = 'makefile';
                } else if (basename.endsWith('.pom') || basename === 'pom.xml') {
                    extension = 'pom';
                }
            }

            // Detect language from extension
            let language = EXTENSION_TO_LANGUAGE[extension] || 'unknown';
            let confidence = extension && EXTENSION_TO_LANGUAGE[extension] ? 90 : 20;

            // Detect MIME type
            const mimeType = EXTENSION_TO_MIME[extension] || 'application/octet-stream';

            // Read first 8000 bytes to determine if binary
            const buffer = Buffer.alloc(Math.min(8000, stats.size));
            const fd = await fs.open(fullPath, 'r');
            try {
                await fd.read(buffer, 0, buffer.length, 0);
            } finally {
                await fd.close();
            }

            // Check binary signatures
            let detectedByMagic = false;
            for (const { signature, type } of BINARY_SIGNATURES) {
                if (signature.every((byte, i) => buffer[i] === byte)) {
                    if (language === 'unknown') {
                        language = type;
                        confidence = 95;
                    }
                    detectedByMagic = true;
                    break;
                }
            }

            // Check for null bytes (binary file indicator)
            const isBinary = buffer.includes(0);
            const isText = !isBinary;

            // Check if executable
            const isExecutable = (stats.mode & 0o111) !== 0;

            // Framework detection (only for text files)
            let detectedFramework: string | undefined;
            if (isText && stats.size < 1024 * 1024) {
                // Only check files < 1MB
                try {
                    // Read first 5000 characters for framework detection
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const preview = content.substring(0, 5000);

                    // Check framework patterns
                    for (const { pattern, framework, fileTypes } of FRAMEWORK_PATTERNS) {
                        // If fileTypes specified, only check matching extensions
                        if (fileTypes && !fileTypes.includes(extension)) {
                            continue;
                        }

                        if (pattern.test(preview)) {
                            detectedFramework = framework;
                            confidence = Math.max(confidence, 80); // Increase confidence if framework detected
                            break;
                        }
                    }
                } catch {
                    // If can't read as UTF-8, skip framework detection
                }
            }

            // If detected as binary by magic numbers but extension suggests text, adjust confidence
            if (detectedByMagic && !isBinary) {
                confidence = 95;
            }

            // Build result
            const result = {
                path: input.path,
                language: language,
                mime_type: mimeType,
                is_binary: isBinary,
                is_text: isText,
                is_executable: isExecutable,
                confidence: confidence,
            };

            // Add framework if detected
            if (detectedFramework) {
                (result as any).detected_framework = detectedFramework;
            }

            context.logger.info(`File type analysis complete: language=${language}, confidence=${confidence}%`);

            return result;
        } catch (error) {
            context.logger.error(`Error in repo_read-analyze_file_type: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to analyze file type: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { path: string }, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
