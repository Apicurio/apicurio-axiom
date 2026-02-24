/**
 * GetProjectStructureTool - Analyze overall project structure
 *
 * This tool analyzes the project structure to detect build systems, package managers,
 * frameworks, and provides a high-level understanding of the repository organization.
 * It identifies build files, configuration files, source/test directories, detects
 * programming languages, and provides size estimates.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import fg from 'fast-glob';
import fs_extra from 'fs-extra';
import type { Tool, ToolContext } from '../../../types/agent.js';

// Build file patterns and their associated project types
const BUILD_FILE_PATTERNS = {
    'pom.xml': 'maven',
    'build.gradle': 'gradle',
    'build.gradle.kts': 'gradle',
    'package.json': 'npm',
    'Cargo.toml': 'cargo',
    'go.mod': 'go',
    'setup.py': 'python-setuptools',
    'pyproject.toml': 'python-poetry',
    Gemfile: 'bundler',
    'composer.json': 'composer',
    'build.xml': 'ant',
    'CMakeLists.txt': 'cmake',
    Makefile: 'make',
};

// Config file patterns to search for
const CONFIG_FILE_PATTERNS = [
    '.gitignore',
    '.editorconfig',
    '.prettierrc*',
    '.eslintrc*',
    'tsconfig.json',
    'jest.config.*',
    'webpack.config.*',
    'vite.config.*',
    'application.properties',
    'application.yml',
    'application.yaml',
    '.env*',
    'docker-compose.yml',
    'Dockerfile',
];

// Extension to language mapping
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    java: 'Java',
    py: 'Python',
    rb: 'Ruby',
    go: 'Go',
    rs: 'Rust',
    cpp: 'C++',
    cc: 'C++',
    cxx: 'C++',
    c: 'C',
    h: 'C/C++',
    cs: 'C#',
    php: 'PHP',
    swift: 'Swift',
    kt: 'Kotlin',
    scala: 'Scala',
    sh: 'Shell',
    bash: 'Shell',
};

// Framework detection patterns for build files
const FRAMEWORK_PATTERNS = {
    maven: [
        { pattern: /<groupId>io\.quarkus<\/groupId>/i, framework: 'Quarkus' },
        { pattern: /<groupId>org\.springframework\.boot<\/groupId>/i, framework: 'Spring Boot' },
        { pattern: /<groupId>org\.springframework<\/groupId>/i, framework: 'Spring' },
        { pattern: /<groupId>javax\.enterprise<\/groupId>/i, framework: 'Jakarta EE' },
        { pattern: /<groupId>jakarta\.enterprise<\/groupId>/i, framework: 'Jakarta EE' },
    ],
    npm: [
        { pattern: /"react":/i, framework: 'React' },
        { pattern: /"vue":/i, framework: 'Vue' },
        { pattern: /"@angular\/core":/i, framework: 'Angular' },
        { pattern: /"next":/i, framework: 'Next.js' },
        { pattern: /"express":/i, framework: 'Express' },
        { pattern: /"nestjs":/i, framework: 'NestJS' },
        { pattern: /"svelte":/i, framework: 'Svelte' },
    ],
    gradle: [
        { pattern: /io\.quarkus/i, framework: 'Quarkus' },
        { pattern: /org\.springframework\.boot/i, framework: 'Spring Boot' },
        { pattern: /org\.springframework/i, framework: 'Spring' },
    ],
};

export const GetProjectStructureTool: Tool = {
    name: 'repo_read-get_project_structure',
    description:
        'Analyze the overall project structure to detect build systems, package managers, frameworks, and provide a high-level understanding of repository organization',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to analyze (default: repository root)',
            },
        },
        required: [],
    },

    /**
     * Execute the tool
     *
     * @param input Tool parameters
     * @param context Tool execution context
     * @returns Project structure analysis or error
     */
    async execute(input: { path?: string }, context: ToolContext): Promise<any> {
        try {
            // Validate context
            if (!context.workDir) {
                return {
                    error: true,
                    message: 'workDir is required in context for repo_read-get_project_structure',
                    tool: 'repo_read-get_project_structure',
                };
            }

            // Set defaults
            const analyzePath = input.path || '.';

            // Normalize and resolve path
            const normalizedPath = path.normalize(analyzePath);
            const fullPath = path.resolve(context.workDir, normalizedPath);

            // Security: Ensure path is within work directory
            if (!fullPath.startsWith(context.workDir)) {
                return {
                    error: true,
                    message: 'Analysis path is outside the repository directory',
                    tool: this.name,
                };
            }

            // Check if path exists
            const pathExists = await fs_extra.pathExists(fullPath);
            if (!pathExists) {
                return {
                    error: true,
                    message: `Path does not exist: ${analyzePath}`,
                    tool: this.name,
                };
            }

            context.logger.info(`Analyzing project structure at: ${analyzePath}`);

            // Find all build files
            const buildFiles: string[] = [];
            const buildFileTypes = new Set<string>();

            for (const [fileName, projectType] of Object.entries(BUILD_FILE_PATTERNS)) {
                const found = await fg(fileName, {
                    cwd: fullPath,
                    ignore: ['.git/**', 'node_modules/**', 'target/**', 'build/**', 'dist/**'],
                    absolute: false,
                    onlyFiles: true,
                });

                for (const file of found) {
                    const relativePath = normalizedPath === '.' ? file : path.join(normalizedPath, file);
                    buildFiles.push(relativePath);
                    buildFileTypes.add(projectType);
                }
            }

            context.logger.info(`Found ${buildFiles.length} build files`);

            // Find config files
            const configFiles: string[] = [];
            for (const pattern of CONFIG_FILE_PATTERNS) {
                const found = await fg(pattern, {
                    cwd: fullPath,
                    ignore: ['.git/**', 'node_modules/**', 'target/**', 'build/**', 'dist/**'],
                    absolute: false,
                    onlyFiles: true,
                    dot: true,
                });

                for (const file of found) {
                    const relativePath = normalizedPath === '.' ? file : path.join(normalizedPath, file);
                    configFiles.push(relativePath);
                }
            }

            // Detect project type
            let projectType = 'unknown';
            if (buildFileTypes.size === 1) {
                projectType = Array.from(buildFileTypes)[0];
            } else if (buildFileTypes.size > 1) {
                projectType = 'multi-module';
            }

            // Detect languages by scanning for source files
            const languageCounts = new Map<string, number>();

            // Scan for source files (limit to avoid performance issues)
            const sourceFiles = await fg('**/*.{ts,tsx,js,jsx,java,py,rb,go,rs,cpp,c,cs,php,swift,kt,scala,sh}', {
                cwd: fullPath,
                ignore: [
                    '.git/**',
                    'node_modules/**',
                    'target/**',
                    'build/**',
                    'dist/**',
                    '**/*.test.*',
                    '**/*.spec.*',
                ],
                absolute: false,
                onlyFiles: true,
            });

            for (const file of sourceFiles) {
                const ext = path.extname(file).substring(1);
                const language = EXTENSION_TO_LANGUAGE[ext];
                if (language) {
                    languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
                }
            }

            // Get top languages (sorted by frequency)
            const languages = Array.from(languageCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([lang]) => lang);

            context.logger.info(`Detected ${languages.length} languages`);

            // Detect frameworks by reading build files
            const frameworks = new Set<string>();

            for (const buildFile of buildFiles) {
                const fullBuildPath = path.resolve(context.workDir, buildFile);
                try {
                    const content = await fs.readFile(fullBuildPath, 'utf-8');
                    const fileName = path.basename(buildFile);

                    // Determine which patterns to check based on file name
                    let patternsToCheck: Array<{ pattern: RegExp; framework: string }> = [];

                    if (fileName === 'pom.xml') {
                        patternsToCheck = FRAMEWORK_PATTERNS.maven;
                    } else if (fileName === 'package.json') {
                        patternsToCheck = FRAMEWORK_PATTERNS.npm;
                    } else if (fileName.includes('gradle')) {
                        patternsToCheck = FRAMEWORK_PATTERNS.gradle;
                    }

                    // Check patterns
                    for (const { pattern, framework } of patternsToCheck) {
                        if (pattern.test(content)) {
                            frameworks.add(framework);
                        }
                    }
                } catch {
                    // Skip files that can't be read
                }
            }

            const frameworkList = Array.from(frameworks);
            context.logger.info(`Detected ${frameworkList.length} frameworks`);

            // Identify source directories
            const sourceDirectories: string[] = [];
            const potentialSrcDirs = ['src', 'lib', 'app', 'source', 'sources'];

            for (const dir of potentialSrcDirs) {
                const dirPath = path.resolve(fullPath, dir);
                if (await fs_extra.pathExists(dirPath)) {
                    const stats = await fs.stat(dirPath);
                    if (stats.isDirectory()) {
                        sourceDirectories.push(normalizedPath === '.' ? dir : path.join(normalizedPath, dir));
                    }
                }
            }

            // Identify test directories
            const testDirectories: string[] = [];
            const potentialTestDirs = ['test', 'tests', '__tests__', 'spec', 'specs', 'src/test'];

            for (const dir of potentialTestDirs) {
                const dirPath = path.resolve(fullPath, dir);
                if (await fs_extra.pathExists(dirPath)) {
                    const stats = await fs.stat(dirPath);
                    if (stats.isDirectory()) {
                        testDirectories.push(normalizedPath === '.' ? dir : path.join(normalizedPath, dir));
                    }
                }
            }

            // Identify package managers based on build files
            const packageManagers: string[] = [];
            if (buildFileTypes.has('maven')) packageManagers.push('maven');
            if (buildFileTypes.has('gradle')) packageManagers.push('gradle');
            if (buildFileTypes.has('npm')) packageManagers.push('npm');
            if (buildFileTypes.has('cargo')) packageManagers.push('cargo');
            if (buildFileTypes.has('go')) packageManagers.push('go');
            if (buildFileTypes.has('python-setuptools') || buildFileTypes.has('python-poetry'))
                packageManagers.push('pip');
            if (buildFileTypes.has('bundler')) packageManagers.push('bundler');
            if (buildFileTypes.has('composer')) packageManagers.push('composer');

            // Estimate project size
            const allFiles = await fg('**/*', {
                cwd: fullPath,
                ignore: ['.git/**', 'node_modules/**', 'target/**', 'build/**', 'dist/**'],
                absolute: false,
                onlyFiles: true,
                dot: false,
            });

            const totalFiles = allFiles.length;

            // Estimate total lines by sampling
            let totalLines = 0;
            const sampleSize = Math.min(100, allFiles.length); // Sample up to 100 files
            const sampleFiles = allFiles.slice(0, sampleSize);

            for (const file of sampleFiles) {
                try {
                    const filePath = path.resolve(fullPath, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const lines = content.split('\n').length;
                    totalLines += lines;
                } catch {
                    // Skip files that can't be read or are binary
                }
            }

            // Extrapolate to estimate total lines
            const averageLinesPerFile = sampleSize > 0 ? totalLines / sampleSize : 0;
            const estimatedTotalLines = Math.round(averageLinesPerFile * totalFiles);

            context.logger.info(`Analysis complete: ${totalFiles} files, ~${estimatedTotalLines} lines`);

            // Build result
            return {
                project_type: projectType,
                languages: languages,
                frameworks: frameworkList,
                build_files: buildFiles,
                config_files: configFiles,
                test_directories: testDirectories,
                source_directories: sourceDirectories,
                package_managers: packageManagers,
                estimated_size: {
                    files: totalFiles,
                    lines: estimatedTotalLines,
                },
            };
        } catch (error) {
            context.logger.error(`Error in repo_read-get_project_structure: ${(error as Error).message}`);
            return {
                error: true,
                message: `Failed to analyze project structure: ${(error as Error).message}`,
                tool: this.name,
            };
        }
    },

    /**
     * Execute mock (for dry-run mode)
     * Read-only tool - executes normally even in dry-run mode
     */
    async executeMock(input: { path?: string }, context: ToolContext): Promise<any> {
        return this.execute(input, context);
    },
};
