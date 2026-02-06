# Repository Analysis & Modification Tools - Implementation Plan

## Purpose

This document serves as the comprehensive specification and implementation roadmap for extending the
Apicurio Axiom AI Agent toolkit with advanced repository analysis and modification capabilities.

Currently, the toolkit provides 3 basic repository tools (`repository-read_file`, `repository-list_files`,
`repository-search_code`) and 4 git operation tools. This proposal adds **35 new repository tools** that
enable AI agents to perform sophisticated code analysis, intelligent modifications, and automated
refactoring operations on locally cloned git repositories.

These tools are designed to integrate seamlessly with the existing tool architecture, following established
patterns for:
- Class-based implementation of the `Tool` interface
- Dependency injection via constructors
- Input validation using JSON Schema
- Structured error handling
- Dry-run support for write operations
- Consistent naming conventions (`repository-{operation}`)

## Implementation Approach

The tools are organized into 5 categories and 9 implementation phases, prioritized by value and complexity.
Each tool specification includes detailed implementation guidance, recommended libraries, input/output
schemas, and estimated effort.

As tools are implemented, the status column in the summary table below should be updated to track progress.

## Key Technologies

The implementation leverages these primary libraries:
- **fs-extra** - Enhanced file system operations with promise support
- **fast-glob** - High-performance file pattern matching
- **prettier** - Multi-language code formatting
- **tree-sitter** - Universal AST parser for multiple languages
- **@babel/parser** + **@babel/traverse** - JavaScript/TypeScript AST parsing and manipulation
- **escomplex** - Code complexity metrics
- **jscodeshift** - Large-scale code transformations
- **ts-morph** - TypeScript-specific refactoring operations

---

## Summary Table

| ID | Tool Name | Description | Status |
|---|---|---|---|
| **File System Analysis** | | | |
| FSA-001 | `repository-get_file_metadata` | Get detailed metadata about a file or directory | Implemented |
| FSA-002 | `repository-check_path_exists` | Quick existence check for files or directories | Implemented |
| FSA-003 | `repository-get_directory_tree` | Get hierarchical tree structure of a directory | Implemented |
| FSA-004 | `repository-find_files` | Find files matching glob patterns | Not Implemented |
| FSA-005 | `repository-analyze_file_type` | Detect file type, language, and characteristics | Not Implemented |
| FSA-006 | `repository-get_file_dependencies` | Analyze import/require statements in a file | Not Implemented |
| FSA-007 | `repository-get_project_structure` | Analyze overall project structure and detect technologies | Not Implemented |
| **Code Analysis** | | | |
| CA-001 | `repository-parse_file_symbols` | Extract symbols (classes, functions, methods) using AST parsing | Not Implemented |
| CA-002 | `repository-find_symbol_definition` | Find where a symbol is defined across the repository | Not Implemented |
| CA-003 | `repository-find_symbol_references` | Find all references/usages of a symbol | Not Implemented |
| CA-004 | `repository-analyze_code_complexity` | Calculate cyclomatic complexity and maintainability metrics | Not Implemented |
| CA-005 | `repository-analyze_dependencies` | Analyze project dependencies and their versions | Not Implemented |
| CA-006 | `repository-analyze_test_coverage` | Analyze test files and identify coverage gaps | Not Implemented |
| CA-007 | `repository-detect_code_smells` | Identify common code smells and anti-patterns | Not Implemented |
| CA-008 | `repository-get_documentation_coverage` | Analyze documentation completeness (Javadoc, JSDoc, etc.) | Not Implemented |
| **File Modification** | | | |
| FM-001 | `repository-write_file` | Write content to a file (create or overwrite) | Not Implemented |
| FM-002 | `repository-append_to_file` | Append content to end of file | Not Implemented |
| FM-003 | `repository-insert_at_line` | Insert content at a specific line number | Not Implemented |
| FM-004 | `repository-replace_in_file` | Search and replace text in a file (regex or literal) | Not Implemented |
| FM-005 | `repository-replace_lines` | Replace specific line range with new content | Not Implemented |
| FM-006 | `repository-delete_file` | Delete a file or directory | Not Implemented |
| FM-007 | `repository-move_file` | Move or rename a file/directory | Not Implemented |
| FM-008 | `repository-copy_file` | Copy a file/directory to another location | Not Implemented |
| FM-009 | `repository-create_directory` | Create a directory (with parents if needed) | Not Implemented |
| FM-010 | `repository-apply_patch` | Apply a unified diff patch to files | Not Implemented |
| **Code Transformation** | | | |
| CT-001 | `repository-format_code` | Format code according to project style | Not Implemented |
| CT-002 | `repository-add_import` | Add an import statement to a file (language-aware) | Not Implemented |
| CT-003 | `repository-remove_import` | Remove an import statement from a file | Not Implemented |
| CT-004 | `repository-rename_symbol` | Rename a symbol across the repository | Not Implemented |
| CT-005 | `repository-extract_method` | Extract code into a new method/function | Not Implemented |
| CT-006 | `repository-add_documentation` | Generate and add documentation comments | Not Implemented |
| **Content Generation** | | | |
| CG-001 | `repository-generate_test` | Generate test file for a source file | Not Implemented |
| CG-002 | `repository-generate_class` | Generate a new class from template | Not Implemented |
| CG-003 | `repository-generate_interface` | Generate interface from existing class | Not Implemented |
| CG-004 | `repository-scaffold_component` | Generate boilerplate for common component types | Not Implemented |

---

# Tool Specifications

## File System Analysis Tools

### FSA-001: repository-get_file_metadata

**Purpose**: Get detailed metadata about a file or directory including size, timestamps, permissions,
and file characteristics.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path from repository root to the file or directory'
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    path: string,              // Normalized path
    exists: boolean,           // Whether the path exists
    type: 'file' | 'directory' | 'symlink' | null,
    size: number,              // Size in bytes
    permissions: string,       // e.g., '755', '644'
    created: string,           // ISO 8601 timestamp
    modified: string,          // ISO 8601 timestamp
    accessed: string,          // ISO 8601 timestamp
    lines?: number,            // For text files only
    extension?: string,        // File extension without dot
    encoding?: string,         // Detected encoding (e.g., 'utf-8')
    is_binary?: boolean,       // For files only
    is_text?: boolean          // For files only
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Validate and normalize the input path
  2. Check path exists using `fs.pathExists()`
  3. Use `fs.stat()` to get file statistics
  4. For files, detect if binary by reading first 8000 bytes and checking for null bytes
  5. For text files, count lines by reading file and counting newline characters
  6. Detect encoding using buffer analysis or a library like `jschardet`
- **Safety**: Ensure path is within repository bounds (prevent directory traversal)
- **Error Handling**: Return `exists: false` for non-existent paths; structured errors for permission issues

**Estimated Effort**: Low (4-6 hours)

**Dependencies**: None

**Implementation Notes**:
- ✅ Implemented on 2026-02-06
- Uses `fs-extra` for path existence checking and native Node.js `fs/promises` for file operations
- Binary detection: Reads first 8000 bytes and checks for null bytes
- Line counting: For text files, reads entire file and counts newline characters
- Encoding detection: Attempts UTF-8 decode; if successful, marks as utf-8, otherwise marks as unknown
- Path safety: Uses `path.resolve()` and validates paths are within work directory
- Error handling: Returns structured error objects with tool name for easier debugging
- All tests pass: text files, directories, non-existent paths, and directory traversal prevention

---

### FSA-002: repository-check_path_exists

**Purpose**: Lightweight check to determine if a path exists and what type it is. Faster alternative
to `get_file_metadata` when full metadata is not needed.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path from repository root'
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    exists: boolean,
    type?: 'file' | 'directory' | 'symlink'  // Only present if exists is true
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Validate and normalize path
  2. Use `fs.pathExists()` for existence check
  3. If exists, use `fs.lstat()` to determine type
- **Safety**: Path validation to prevent directory traversal
- **Error Handling**: Return `exists: false` instead of throwing errors

**Estimated Effort**: Very Low (2-3 hours)

**Dependencies**: None

**Implementation Notes**:
- ✅ Implemented on 2026-02-06
- Uses `fs-extra` for path existence checking with `pathExists()`
- Uses `fs.lstat()` to determine path type (file, directory, or symlink)
- Returns `exists: false` instead of throwing errors for missing paths or permission issues
- Gracefully handles errors by returning `exists: false`
- Path safety: Uses `path.resolve()` and validates paths are within work directory
- Lightweight and fast - perfect for quick existence checks before more expensive operations
- Read-only tool - executes normally even in dry-run mode

---

### FSA-003: repository-get_directory_tree

**Purpose**: Generate a hierarchical tree structure of a directory, useful for visualization and
understanding project layout.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to directory (default: repository root)'
        },
        max_depth: {
            type: 'number',
            description: 'Maximum depth to traverse (default: unlimited)',
            minimum: 1
        },
        include_hidden: {
            type: 'boolean',
            description: 'Include hidden files/directories (default: false)'
        },
        pattern: {
            type: 'string',
            description: 'Optional glob pattern to filter results'
        }
    },
    required: []
}
```

**Output Schema**:
```typescript
{
    tree: TreeNode[],
    total_files: number,
    total_directories: number
}

interface TreeNode {
    name: string,
    type: 'file' | 'directory',
    path: string,
    size?: number,        // For files
    children?: TreeNode[] // For directories
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra` for file operations, `fast-glob` for pattern matching
- **Approach**:
  1. Recursively traverse directory structure
  2. Build tree nodes with name, type, path
  3. Apply max_depth limit during traversal
  4. Filter hidden files if `include_hidden` is false
  5. Apply glob pattern if provided
  6. Count totals during traversal
- **Safety**: Path validation, depth limit to prevent stack overflow
- **Error Handling**: Handle permission errors gracefully

**Estimated Effort**: Medium (1-2 days)

**Dependencies**: None

**Implementation Notes**:
- ✅ Implemented on 2026-02-06
- Uses `fs-extra` for file system operations and native Node.js `fs/promises` for directory reading
- Recursive tree building with depth limiting to prevent stack overflow
- Simple glob pattern matching using regex (supports * and ? wildcards)
- Sorts output: directories first, then files, both alphabetically
- Filters hidden files/directories when `include_hidden` is false
- Path safety: Uses `path.resolve()` and validates paths are within work directory
- Efficient implementation that doesn't load entire files into memory
- Returns total counts of files and directories traversed
- Error handling: Returns structured error objects for invalid paths or permission issues
- All tests pass: depth limiting, pattern filtering, error cases, and security checks

---

### FSA-004: repository-find_files

**Purpose**: Find files matching glob patterns across the repository. More powerful and flexible than
`list_files`.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        pattern: {
            type: 'string',
            description: 'Glob pattern (e.g., "**/*.java", "src/**/Test*.ts")'
        },
        path: {
            type: 'string',
            description: 'Starting directory (default: repository root)'
        },
        exclude: {
            type: 'array',
            items: { type: 'string' },
            description: 'Patterns to exclude'
        },
        max_results: {
            type: 'number',
            description: 'Maximum number of results to return',
            minimum: 1,
            default: 1000
        }
    },
    required: ['pattern']
}
```

**Output Schema**:
```typescript
{
    files: string[],      // Array of matching file paths
    count: number,        // Total matches found
    truncated: boolean    // True if results were limited by max_results
}
```

**Implementation Details**:
- **Primary Library**: `fast-glob`
- **Approach**:
  1. Normalize pattern and path
  2. Configure fast-glob with:
     - `cwd` set to repository root or specified path
     - `ignore` patterns from exclude array plus `.git`
     - `absolute: false` for relative paths
     - `onlyFiles: true`
  3. Execute glob search
  4. Limit results if needed
  5. Return paths relative to repository root
- **Safety**: Validate patterns, prevent access outside repository
- **Error Handling**: Invalid glob patterns should return structured errors

**Estimated Effort**: Very Low (3-4 hours)

**Dependencies**: None

---

### FSA-005: repository-analyze_file_type

**Purpose**: Detect file type, programming language, MIME type, and other characteristics to help
agents understand file contents without parsing.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    path: string,
    language: string,           // e.g., 'java', 'typescript', 'markdown'
    mime_type: string,          // e.g., 'text/x-java', 'application/json'
    is_binary: boolean,
    is_text: boolean,
    is_executable: boolean,
    detected_framework?: string, // e.g., 'Quarkus', 'React', 'Spring'
    confidence: number          // 0-100, confidence in language detection
}
```

**Implementation Details**:
- **Primary Library**: File extension mapping, magic number detection
- **Approach**:
  1. Check file extension for primary language hint
  2. For text files, read first few lines to detect frameworks:
     - Look for `@Quarkus` annotations, `import` statements
     - Check for `package.json` dependencies
  3. Use magic number detection for binary files
  4. Build MIME type from extension/content
  5. Check execute permission bit
- **Safety**: Path validation
- **Error Handling**: Return 'unknown' for unrecognized types

**Estimated Effort**: Medium (1-2 days)

**Dependencies**: None

---

### FSA-006: repository-get_file_dependencies

**Purpose**: Analyze import/require statements in a file to understand module dependencies and
relationships between files.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    path: string,
    language: string,
    imports: Array<{
        module: string,              // Import identifier
        type: 'local' | 'external' | 'builtin',
        line: number,
        resolved_path?: string       // For local imports
    }>,
    exports?: string[]               // Exported symbols (if applicable)
}
```

**Implementation Details**:
- **Primary Library**: `@babel/parser` + `@babel/traverse` for JS/TS, `tree-sitter` for Java
- **Approach**:
  1. Detect file language
  2. Parse file into AST
  3. For JavaScript/TypeScript:
     - Find `import` and `require()` statements
     - Extract module names and classify as local/external/builtin
     - Find `export` statements
  4. For Java:
     - Extract `import` statements
     - Classify as JDK builtin, external library, or local
  5. Attempt to resolve local imports to file paths
- **Safety**: Handle parse errors gracefully
- **Error Handling**: Return empty arrays if file cannot be parsed

**Estimated Effort**: High (3-4 days)

**Dependencies**: CA-001 (uses similar AST parsing)

---

### FSA-007: repository-get_project_structure

**Purpose**: Analyze the overall project structure to detect build systems, package managers,
frameworks, and provide a high-level understanding of the repository organization.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Path to analyze (default: repository root)'
        }
    },
    required: []
}
```

**Output Schema**:
```typescript
{
    project_type: string,           // 'maven', 'npm', 'gradle', 'multi-module', etc.
    languages: string[],            // Detected programming languages
    frameworks: string[],           // Detected frameworks (Quarkus, React, etc.)
    build_files: string[],          // pom.xml, package.json, build.gradle, etc.
    config_files: string[],         // Configuration files found
    test_directories: string[],     // Directories containing tests
    source_directories: string[],   // Main source directories
    package_managers: string[],     // npm, maven, gradle, etc.
    estimated_size: {
        files: number,
        lines: number
    }
}
```

**Implementation Details**:
- **Primary Library**: `fast-glob` for file discovery
- **Approach**:
  1. Search for build files (pom.xml, package.json, build.gradle, etc.)
  2. Determine project type based on build files
  3. Use file extensions to detect languages
  4. Scan build files to detect frameworks/libraries
  5. Identify standard directory patterns (src/, test/, etc.)
  6. Count files and estimate total lines
- **Safety**: Limit scanning depth and file count
- **Error Handling**: Return best-effort results even if some detection fails

**Estimated Effort**: Medium (2-3 days)

**Dependencies**: FSA-004 (find_files)

---

## Code Analysis Tools

### CA-001: repository-parse_file_symbols

**Purpose**: Extract symbols (classes, functions, methods, interfaces, enums) from a file using AST
parsing. This is fundamental for understanding code structure without reading entire files.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        include_private: {
            type: 'boolean',
            description: 'Include private/internal symbols (default: true)'
        },
        include_body: {
            type: 'boolean',
            description: 'Include symbol source code (default: false)'
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    path: string,
    language: string,
    symbols: Array<{
        name: string,
        type: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'enum',
        line_start: number,
        line_end: number,
        signature: string,              // Method/function signature
        visibility: 'public' | 'private' | 'protected',
        body?: string,                  // If include_body is true
        parameters?: Array<{
            name: string,
            type: string
        }>,
        return_type?: string,
        decorators?: string[],          // For TypeScript
        annotations?: string[],         // For Java
        parent?: string                 // For methods, the containing class
    }>
}
```

**Implementation Details**:
- **Primary Library**: `tree-sitter` (universal) with language-specific grammars
- **Approach**:
  1. Detect file language from extension
  2. Load appropriate tree-sitter parser (Java, TypeScript, etc.)
  3. Parse file into AST
  4. Traverse AST to find symbol definitions:
     - Classes: `class_declaration` nodes
     - Methods: `method_declaration` nodes
     - Functions: `function_declaration` nodes
     - Interfaces: `interface_declaration` nodes
  5. Extract symbol metadata (name, visibility, parameters, etc.)
  6. If `include_body`, extract source code for each symbol
  7. Build parent relationships for nested symbols
- **Safety**: Handle parse errors, large files
- **Error Handling**: Return partial results if some symbols fail to parse

**Estimated Effort**: High (4-5 days)

**Dependencies**: None (but foundational for many other tools)

---

### CA-002: repository-find_symbol_definition

**Purpose**: Find where a symbol (class, function, method, variable) is defined across the repository.
Essential for code navigation and understanding.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        symbol: {
            type: 'string',
            description: 'Symbol name to search for'
        },
        type: {
            type: 'string',
            enum: ['class', 'function', 'method', 'variable', 'interface', 'enum'],
            description: 'Type of symbol (optional, helps narrow search)'
        },
        path: {
            type: 'string',
            description: 'Restrict search to this path (optional)'
        }
    },
    required: ['symbol']
}
```

**Output Schema**:
```typescript
{
    found: boolean,
    definitions: Array<{
        symbol: string,
        file: string,
        line: number,
        type: string,
        signature: string,
        context: string     // Surrounding code (5 lines before/after)
    }>
}
```

**Implementation Details**:
- **Primary Library**: `tree-sitter` or `@babel/parser`
- **Approach**:
  1. Build index of symbols (or parse on-demand)
  2. Search for matching symbol names
  3. Filter by type if specified
  4. Restrict to path if provided
  5. Extract context around definition
  6. Return all matches (there may be multiple definitions)
- **Safety**: Limit number of files scanned, timeout for large repos
- **Error Handling**: Return `found: false` if no matches

**Estimated Effort**: High (4-5 days)

**Dependencies**: CA-001 (parse_file_symbols)

---

### CA-003: repository-find_symbol_references

**Purpose**: Find all places where a symbol is referenced or used. Critical for refactoring and
understanding code impact.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        symbol: {
            type: 'string',
            description: 'Symbol name to find references for'
        },
        path: {
            type: 'string',
            description: 'File containing the definition (optional but recommended)'
        },
        include_definition: {
            type: 'boolean',
            description: 'Include the definition itself (default: false)'
        }
    },
    required: ['symbol']
}
```

**Output Schema**:
```typescript
{
    symbol: string,
    references: Array<{
        file: string,
        line: number,
        column: number,
        context: string,        // Code snippet around reference
        reference_type: 'import' | 'call' | 'instantiation' | 'assignment'
    }>,
    count: number
}
```

**Implementation Details**:
- **Primary Library**: `@babel/traverse` for JS/TS, `tree-sitter` for Java
- **Approach**:
  1. Parse all relevant files into AST
  2. Traverse AST to find identifier nodes matching symbol name
  3. Determine reference type (call, assignment, etc.)
  4. Extract context around each reference
  5. Exclude definition if `include_definition` is false
- **Safety**: Limit scope, implement timeouts
- **Error Handling**: Return partial results if some files fail

**Estimated Effort**: Very High (5-7 days)

**Dependencies**: CA-001, CA-002

---

### CA-004: repository-analyze_code_complexity

**Purpose**: Calculate cyclomatic complexity, cognitive complexity, and maintainability index for
code files. Helps identify complex code that needs refactoring.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    path: string,
    overall_complexity: number,
    functions: Array<{
        name: string,
        complexity: number,
        line_start: number,
        line_end: number,
        rating: 'low' | 'medium' | 'high' | 'very_high'
    }>,
    maintainability_index: number,  // 0-100
    suggestions: string[]
}
```

**Implementation Details**:
- **Primary Library**: `escomplex` for JavaScript/TypeScript
- **Approach**:
  1. Read file contents
  2. For JS/TS: Use escomplex to calculate metrics
  3. For Java: Implement basic cyclomatic complexity calculator
     - Count decision points (if, while, for, case, catch, &&, ||)
  4. Rate functions based on complexity thresholds:
     - Low: 1-5
     - Medium: 6-10
     - High: 11-20
     - Very High: 21+
  5. Generate suggestions for high-complexity functions
- **Safety**: Handle parse errors
- **Error Handling**: Return empty results if file cannot be analyzed

**Estimated Effort**: Medium (2-3 days)

**Dependencies**: CA-001 (for Java analysis)

---

### CA-005: repository-analyze_dependencies

**Purpose**: Analyze project dependencies from build files (pom.xml, package.json), check versions,
and optionally identify outdated packages.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Path to analyze (default: repository root)'
        },
        check_outdated: {
            type: 'boolean',
            description: 'Check if dependencies are outdated (default: false)'
        },
        include_dev: {
            type: 'boolean',
            description: 'Include development dependencies (default: true)'
        }
    },
    required: []
}
```

**Output Schema**:
```typescript
{
    dependencies: Array<{
        name: string,
        version: string,
        type: 'production' | 'development' | 'optional',
        source: string,              // pom.xml, package.json, etc.
        is_outdated?: boolean,       // If check_outdated is true
        latest_version?: string,     // If check_outdated is true
        security_issues?: number     // If vulnerability data available
    }>,
    total: number,
    outdated_count?: number
}
```

**Implementation Details**:
- **Primary Library**: `pom-parser` for Maven, `fast-xml-parser` for XML, native JSON for package.json
- **Approach**:
  1. Find dependency files (pom.xml, package.json)
  2. Parse dependency files
  3. Extract dependency information
  4. If `check_outdated`, optionally query package registries (npm, Maven Central)
  5. Categorize dependencies by type
- **Safety**: Handle malformed files
- **Error Handling**: Return partial results if some files fail

**Estimated Effort**: Medium (2-3 days)

**Dependencies**: FSA-007 (uses project structure detection)

---

### CA-006: repository-analyze_test_coverage

**Purpose**: Analyze test files and identify potential coverage gaps by comparing source files to
test files.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        source_path: {
            type: 'string',
            description: 'Path to source directory (default: auto-detect)'
        },
        test_path: {
            type: 'string',
            description: 'Path to test directory (default: auto-detect)'
        }
    },
    required: []
}
```

**Output Schema**:
```typescript
{
    source_files: number,
    test_files: number,
    coverage_estimate: number,      // Percentage (0-100)
    untested_files: string[],       // Files without corresponding tests
    test_patterns: string[],        // Detected test naming patterns
    framework: string,              // JUnit, Jest, etc.
    suggestions: string[]
}
```

**Implementation Details**:
- **Primary Library**: `fast-glob` for file finding
- **Approach**:
  1. Auto-detect or use provided source/test directories
  2. Find all source files
  3. Find all test files
  4. Detect testing framework from imports and annotations
  5. Match test files to source files using naming conventions
  6. Calculate coverage estimate
  7. Identify untested files
- **Safety**: Handle missing directories
- **Error Handling**: Return best-effort estimate

**Estimated Effort**: Medium (2-3 days)

**Dependencies**: FSA-004, FSA-007

---

### CA-007: repository-detect_code_smells

**Purpose**: Identify common code smells and anti-patterns such as long methods, god classes,
duplicate code, etc.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file or directory'
        },
        severity: {
            type: 'string',
            enum: ['all', 'high', 'medium', 'low'],
            description: 'Minimum severity to report (default: all)'
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    path: string,
    smells: Array<{
        type: string,           // e.g., 'long-method', 'god-class', 'duplicate-code'
        severity: 'low' | 'medium' | 'high',
        location: {
            line: number,
            column: number
        },
        description: string,
        suggestion: string
    }>,
    total_smells: number,
    risk_score: number          // 0-100
}
```

**Implementation Details**:
- **Primary Library**: `eslint-plugin-sonarjs` for JS/TS, custom rules for Java
- **Approach**:
  1. Parse file(s) into AST
  2. Apply code smell detection rules:
     - Long methods (>50 lines)
     - God classes (>10 methods, >500 lines)
     - High complexity (complexity >10)
     - Deep nesting (>4 levels)
     - Long parameter lists (>5 parameters)
  3. Calculate severity based on thresholds
  4. Filter by severity if specified
  5. Generate actionable suggestions
- **Safety**: Handle parse errors
- **Error Handling**: Return empty results if analysis fails

**Estimated Effort**: Medium (3-4 days)

**Dependencies**: CA-001, CA-004

---

### CA-008: repository-get_documentation_coverage

**Purpose**: Analyze how well code is documented by checking for Javadoc, JSDoc, and other
documentation comments.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file or directory'
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    path: string,
    symbols_total: number,
    symbols_documented: number,
    coverage_percentage: number,
    undocumented: Array<{
        symbol: string,
        type: string,
        file: string,
        line: number
    }>,
    documentation_quality: 'excellent' | 'good' | 'fair' | 'poor'
}
```

**Implementation Details**:
- **Primary Library**: `@babel/parser` for JS/TS, `tree-sitter` for Java
- **Approach**:
  1. Parse file(s) and extract public symbols
  2. For each symbol, check for preceding documentation comment
  3. Validate documentation quality:
     - Javadoc: Must have description and @param/@return tags
     - JSDoc: Must have description
  4. Count documented vs undocumented symbols
  5. Rate overall quality based on coverage percentage
- **Safety**: Handle parse errors
- **Error Handling**: Return 0% coverage if analysis fails

**Estimated Effort**: Medium (2-3 days)

**Dependencies**: CA-001

---

## File Modification Tools

### FM-001: repository-write_file

**Purpose**: Write content to a file, creating it if it doesn't exist or overwriting if it does.
This is the most basic file modification operation.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        content: {
            type: 'string',
            description: 'Content to write to file'
        },
        encoding: {
            type: 'string',
            description: 'File encoding (default: utf-8)',
            default: 'utf-8'
        },
        create_directories: {
            type: 'boolean',
            description: 'Create parent directories if they don\'t exist (default: true)',
            default: true
        },
        backup: {
            type: 'boolean',
            description: 'Create backup of existing file (default: false)',
            default: false
        }
    },
    required: ['path', 'content']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    bytes_written: number,
    backup_path?: string,   // If backup was created
    created: boolean        // true if new file, false if overwritten
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Validate and normalize path
  2. Check if file exists
  3. If backup requested and file exists, copy to .bak file
  4. If create_directories is true, ensure parent directories exist using `fs.ensureDir()`
  5. Write content using `fs.writeFile()`
  6. Return metadata about operation
- **Safety**: Path validation to prevent writing outside repository
- **Error Handling**: Return structured error for permission issues, disk full, etc.
- **Dry-Run**: Return simulated result without actually writing

**Estimated Effort**: Very Low (2-3 hours)

**Dependencies**: None

---

### FM-002: repository-append_to_file

**Purpose**: Append content to the end of an existing file. Useful for adding entries to logs,
lists, or incremental file building.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        content: {
            type: 'string',
            description: 'Content to append'
        },
        newline: {
            type: 'boolean',
            description: 'Add newline before content (default: true)',
            default: true
        }
    },
    required: ['path', 'content']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    bytes_appended: number,
    new_size: number
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Validate path
  2. Check file exists, error if not
  3. If newline is true, prepend '\n' to content
  4. Use `fs.appendFile()` to append content
  5. Get new file size
- **Safety**: Path validation
- **Error Handling**: Error if file doesn't exist
- **Dry-Run**: Return simulated result

**Estimated Effort**: Very Low (2 hours)

**Dependencies**: None

---

### FM-003: repository-insert_at_line

**Purpose**: Insert content at a specific line number in a file. Useful for adding methods, imports,
or other code at precise locations.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        line: {
            type: 'number',
            description: 'Line number to insert at (1-based)',
            minimum: 1
        },
        content: {
            type: 'string',
            description: 'Content to insert'
        },
        indent: {
            type: 'boolean',
            description: 'Match indentation of surrounding code (default: false)',
            default: false
        }
    },
    required: ['path', 'line', 'content']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    lines_inserted: number
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Read entire file into array of lines
  2. If indent is true, detect indentation of target line and apply to content
  3. Insert content at specified line index
  4. Join lines and write back to file
- **Safety**: Validate line number is within file bounds
- **Error Handling**: Error if line number is invalid
- **Dry-Run**: Return simulated result

**Estimated Effort**: Low (4 hours)

**Dependencies**: None

---

### FM-004: repository-replace_in_file

**Purpose**: Search for text in a file and replace it with new text. Supports both literal and
regex patterns.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        search: {
            type: 'string',
            description: 'Text or pattern to search for'
        },
        replace: {
            type: 'string',
            description: 'Replacement text'
        },
        regex: {
            type: 'boolean',
            description: 'Treat search as regex pattern (default: false)',
            default: false
        },
        all_occurrences: {
            type: 'boolean',
            description: 'Replace all occurrences (default: true)',
            default: true
        },
        preserve_case: {
            type: 'boolean',
            description: 'Preserve case when replacing (default: false)',
            default: false
        }
    },
    required: ['path', 'search', 'replace']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    replacements_made: number,
    lines_affected: number[],
    preview: string         // Show first 200 chars of changes
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra` + native JavaScript regex
- **Approach**:
  1. Read file contents
  2. Build search pattern (literal string or RegExp)
  3. Perform replacement(s)
  4. Track which lines were affected
  5. Write modified content back
- **Safety**: Validate regex patterns
- **Error Handling**: Handle invalid regex, no matches found
- **Dry-Run**: Return what would be changed without writing

**Estimated Effort**: Low (4-5 hours)

**Dependencies**: None

---

### FM-005: repository-replace_lines

**Purpose**: Replace a range of lines in a file with new content. More precise than text search
when line numbers are known.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        start_line: {
            type: 'number',
            description: 'First line to replace (1-based)',
            minimum: 1
        },
        end_line: {
            type: 'number',
            description: 'Last line to replace (1-based, inclusive)',
            minimum: 1
        },
        new_content: {
            type: 'string',
            description: 'Content to replace the line range with'
        }
    },
    required: ['path', 'start_line', 'end_line', 'new_content']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    lines_replaced: number,
    old_content: string     // Content that was replaced
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Read file into line array
  2. Validate line numbers
  3. Extract old content for reference
  4. Replace line range with new content
  5. Write back to file
- **Safety**: Validate line range is within file bounds
- **Error Handling**: Error on invalid line numbers
- **Dry-Run**: Return what would be replaced

**Estimated Effort**: Low (3-4 hours)

**Dependencies**: None

---

### FM-006: repository-delete_file

**Purpose**: Delete a file or directory from the repository.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file or directory'
        },
        recursive: {
            type: 'boolean',
            description: 'For directories, delete recursively (default: false)',
            default: false
        },
        backup: {
            type: 'boolean',
            description: 'Create backup before deleting (default: false)',
            default: false
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    backup_path?: string,
    type: 'file' | 'directory',
    files_deleted: number
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Validate path exists
  2. If backup requested, copy to backup location first
  3. Use `fs.remove()` for deletion (handles both files and directories)
  4. Count files deleted (for directories)
- **Safety**: Confirm recursive deletion for directories, prevent deletion of critical files
- **Error Handling**: Error on permission issues
- **Dry-Run**: Return what would be deleted

**Estimated Effort**: Very Low (2-3 hours)

**Dependencies**: None

---

### FM-007: repository-move_file

**Purpose**: Move or rename a file or directory within the repository.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        source: {
            type: 'string',
            description: 'Current path'
        },
        destination: {
            type: 'string',
            description: 'New path'
        },
        overwrite: {
            type: 'boolean',
            description: 'Overwrite if destination exists (default: false)',
            default: false
        },
        create_directories: {
            type: 'boolean',
            description: 'Create parent directories if needed (default: true)',
            default: true
        }
    },
    required: ['source', 'destination']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    source: string,
    destination: string,
    type: 'file' | 'directory',
    overwritten: boolean
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Validate source exists
  2. Check if destination exists
  3. If create_directories, ensure parent directories exist
  4. Use `fs.move()` with overwrite option
- **Safety**: Prevent moves outside repository
- **Error Handling**: Error if source doesn't exist or destination exists without overwrite
- **Dry-Run**: Return simulated result

**Estimated Effort**: Very Low (2-3 hours)

**Dependencies**: None

---

### FM-008: repository-copy_file

**Purpose**: Copy a file or directory to another location in the repository.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        source: {
            type: 'string',
            description: 'Path to copy from'
        },
        destination: {
            type: 'string',
            description: 'Path to copy to'
        },
        overwrite: {
            type: 'boolean',
            description: 'Overwrite if destination exists (default: false)',
            default: false
        },
        recursive: {
            type: 'boolean',
            description: 'For directories, copy recursively (default: true)',
            default: true
        }
    },
    required: ['source', 'destination']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    source: string,
    destination: string,
    bytes_copied: number,
    files_copied: number
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Validate source exists
  2. Use `fs.copy()` with overwrite option
  3. Count bytes and files copied
- **Safety**: Prevent copying outside repository
- **Error Handling**: Error if source doesn't exist
- **Dry-Run**: Return simulated result

**Estimated Effort**: Very Low (2-3 hours)

**Dependencies**: None

---

### FM-009: repository-create_directory

**Purpose**: Create a new directory in the repository.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Path to directory to create'
        },
        recursive: {
            type: 'boolean',
            description: 'Create parent directories if needed (default: true)',
            default: true
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    created: boolean,           // false if already existed
    parents_created: string[]   // Parent directories that were created
}
```

**Implementation Details**:
- **Primary Library**: `fs-extra`
- **Approach**:
  1. Validate path
  2. Use `fs.ensureDir()` which creates directory and parents if needed
  3. Track which directories were actually created
- **Safety**: Prevent creation outside repository
- **Error Handling**: Succeed if directory already exists
- **Dry-Run**: Return simulated result

**Estimated Effort**: Very Low (2 hours)

**Dependencies**: None

---

### FM-010: repository-apply_patch

**Purpose**: Apply a unified diff patch to one or more files. Useful for automated code changes
from generated patches.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        patch: {
            type: 'string',
            description: 'Unified diff format patch content'
        },
        dry_run: {
            type: 'boolean',
            description: 'Test patch without applying (default: false)',
            default: false
        },
        reverse: {
            type: 'boolean',
            description: 'Apply patch in reverse (default: false)',
            default: false
        }
    },
    required: ['patch']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    files_modified: string[],
    hunks_applied: number,
    hunks_failed: number,
    errors: string[]
}
```

**Implementation Details**:
- **Primary Library**: `execa` to run `patch` command, or implement diff parser
- **Approach**:
  1. Parse unified diff format
  2. For each file in patch:
     - Read current file
     - Apply hunks sequentially
     - Handle line number offsets
  3. Write modified files
  4. Track success/failure per hunk
- **Safety**: Validate patch format
- **Error Handling**: Return partial success if some hunks fail
- **Dry-Run**: Built into tool via dry_run parameter

**Estimated Effort**: Medium (1-2 days)

**Dependencies**: None

---

## Code Transformation Tools

### CT-001: repository-format_code

**Purpose**: Format code according to Prettier style or project-specific configuration. Ensures
consistent code style across the repository.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file or directory'
        },
        formatter: {
            type: 'string',
            description: 'Formatter to use (default: auto-detect)',
            enum: ['prettier', 'auto']
        },
        config: {
            type: 'object',
            description: 'Formatter configuration (optional)'
        }
    },
    required: ['path']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    formatted: boolean,         // false if already formatted
    changes_made: number,       // Number of formatting changes
    formatter_used: string
}
```

**Implementation Details**:
- **Primary Library**: `prettier` with `prettier-plugin-java`
- **Approach**:
  1. Detect file type
  2. Load Prettier configuration from project (.prettierrc) or use defaults
  3. Read file contents
  4. Run Prettier formatter
  5. Compare formatted output to original
  6. Write if changes detected
- **Safety**: Handle unsupported file types gracefully
- **Error Handling**: Return error for files that can't be formatted
- **Dry-Run**: Return whether formatting would change file

**Estimated Effort**: Very Low (3-4 hours)

**Dependencies**: None

---

### CT-002: repository-add_import

**Purpose**: Add an import/require statement to a file in a language-aware way, handling proper
placement and avoiding duplicates.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        import: {
            type: 'string',
            description: 'What to import (e.g., "React", "java.util.List")'
        },
        from: {
            type: 'string',
            description: 'Where to import from (for ES6 modules)'
        },
        position: {
            type: 'string',
            enum: ['top', 'after-existing', 'alphabetical'],
            description: 'Where to place import (default: alphabetical)',
            default: 'alphabetical'
        }
    },
    required: ['path', 'import']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    import_added: string,
    line_number: number,
    already_existed: boolean
}
```

**Implementation Details**:
- **Primary Library**: `@babel/parser` + `@babel/traverse` for JS/TS, `tree-sitter` for Java
- **Approach**:
  1. Parse file into AST
  2. Find existing import/require statements
  3. Check if import already exists
  4. Determine insertion point based on position parameter
  5. Generate import statement in correct format for language
  6. Insert into AST
  7. Regenerate code using `@babel/generator` or text manipulation
- **Safety**: Avoid duplicate imports
- **Error Handling**: Error if file can't be parsed
- **Dry-Run**: Return where import would be added

**Estimated Effort**: High (3-4 days)

**Dependencies**: CA-001

---

### CT-003: repository-remove_import

**Purpose**: Remove an import/require statement from a file.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        import: {
            type: 'string',
            description: 'Import to remove'
        }
    },
    required: ['path', 'import']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    import_removed: string,
    line_number: number
}
```

**Implementation Details**:
- **Primary Library**: `@babel/parser` + `@babel/traverse` for JS/TS, `tree-sitter` for Java
- **Approach**:
  1. Parse file into AST
  2. Find matching import statement
  3. Remove from AST
  4. Regenerate code
- **Safety**: Handle import not found gracefully
- **Error Handling**: Error if import doesn't exist
- **Dry-Run**: Return what would be removed

**Estimated Effort**: High (2-3 days)

**Dependencies**: CT-002 (similar implementation)

---

### CT-004: repository-rename_symbol

**Purpose**: Rename a symbol (class, function, variable) across the entire repository or within a
specific scope. This is a complex refactoring operation.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        old_name: {
            type: 'string',
            description: 'Current symbol name'
        },
        new_name: {
            type: 'string',
            description: 'New symbol name'
        },
        path: {
            type: 'string',
            description: 'File where symbol is defined'
        },
        scope: {
            type: 'string',
            enum: ['file', 'repository'],
            description: 'Scope of rename (default: repository)',
            default: 'repository'
        }
    },
    required: ['old_name', 'new_name', 'path']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    old_name: string,
    new_name: string,
    files_modified: string[],
    occurrences_renamed: number,
    conflicts: string[]         // Potential naming conflicts
}
```

**Implementation Details**:
- **Primary Library**: `jscodeshift` for JS/TS, `ts-morph` for TypeScript-only
- **Approach**:
  1. Find symbol definition
  2. Find all references (uses CA-003)
  3. For each reference:
     - Parse file
     - Replace symbol name
     - Regenerate code
  4. Handle edge cases (shadowing, conflicts)
- **Safety**: Detect naming conflicts, validate scope
- **Error Handling**: Return conflicts that need manual resolution
- **Dry-Run**: Return what would be renamed

**Estimated Effort**: Very High (5-7 days)

**Dependencies**: CA-002, CA-003

---

### CT-005: repository-extract_method

**Purpose**: Extract a block of code into a new method/function. Advanced refactoring operation.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        start_line: {
            type: 'number',
            description: 'First line of code to extract',
            minimum: 1
        },
        end_line: {
            type: 'number',
            description: 'Last line of code to extract',
            minimum: 1
        },
        method_name: {
            type: 'string',
            description: 'Name for the new method/function'
        },
        visibility: {
            type: 'string',
            enum: ['public', 'private', 'protected'],
            description: 'Method visibility (default: private)',
            default: 'private'
        }
    },
    required: ['path', 'start_line', 'end_line', 'method_name']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    method_created: string,
    method_line: number,
    call_inserted_at: number
}
```

**Implementation Details**:
- **Primary Library**: `jscodeshift` or `ts-morph`
- **Approach**:
  1. Parse file into AST
  2. Extract specified lines
  3. Analyze extracted code for:
     - Variables used (parameters needed)
     - Variables assigned (return value)
  4. Generate new method with parameters and return
  5. Replace extracted code with method call
  6. Insert new method in appropriate location
- **Safety**: Validate extraction scope
- **Error Handling**: Error if extraction creates invalid code
- **Dry-Run**: Return generated method signature

**Estimated Effort**: Very High (4-5 days)

**Dependencies**: CA-001

---

### CT-006: repository-add_documentation

**Purpose**: Generate and add documentation comments (Javadoc, JSDoc) to a symbol. Can use AI
to generate descriptions.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Relative path to file'
        },
        symbol: {
            type: 'string',
            description: 'Symbol name to document'
        },
        template: {
            type: 'string',
            description: 'Documentation template (optional)'
        },
        ai_generate: {
            type: 'boolean',
            description: 'Use AI to generate description (default: false)',
            default: false
        }
    },
    required: ['path', 'symbol']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    path: string,
    symbol: string,
    documentation_added: string,
    line_number: number
}
```

**Implementation Details**:
- **Primary Library**: `@babel/parser` for JS/TS, `tree-sitter` for Java
- **Approach**:
  1. Parse file and find symbol
  2. Extract symbol signature (parameters, return type)
  3. Generate documentation template based on language:
     - Java: Javadoc with @param, @return
     - JavaScript/TypeScript: JSDoc
  4. If ai_generate, use AI to generate description
  5. Insert documentation comment before symbol
- **Safety**: Don't overwrite existing documentation
- **Error Handling**: Error if symbol not found
- **Dry-Run**: Return generated documentation

**Estimated Effort**: High (3-4 days)

**Dependencies**: CA-001

---

## Content Generation Tools

### CG-001: repository-generate_test

**Purpose**: Generate a test file for a source file, including test cases and boilerplate setup.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        source_path: {
            type: 'string',
            description: 'Path to source file to generate tests for'
        },
        test_framework: {
            type: 'string',
            description: 'Testing framework (default: auto-detect)',
            enum: ['junit', 'jest', 'mocha', 'auto']
        },
        test_path: {
            type: 'string',
            description: 'Where to create test file (default: mirror source structure)'
        },
        coverage_target: {
            type: 'number',
            description: 'Target coverage percentage (default: 80)',
            minimum: 0,
            maximum: 100,
            default: 80
        }
    },
    required: ['source_path']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    test_file_created: string,
    test_cases_generated: number,
    framework_used: string,
    content: string
}
```

**Implementation Details**:
- **Primary Library**: Templates + `@babel/parser` or `tree-sitter`
- **Approach**:
  1. Parse source file and extract public methods/functions
  2. Detect or use specified test framework
  3. Generate test file structure:
     - Imports
     - Test class/suite
     - Setup/teardown
  4. For each public method:
     - Generate test case stub
     - Add assertions based on return type
  5. Write test file to appropriate location
- **Safety**: Don't overwrite existing tests
- **Error Handling**: Return error if source can't be parsed
- **Dry-Run**: Return generated test content

**Estimated Effort**: High (4-5 days)

**Dependencies**: CA-001, FSA-007

---

### CG-002: repository-generate_class

**Purpose**: Generate a new class file from a template with specified fields and methods.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        name: {
            type: 'string',
            description: 'Class name'
        },
        path: {
            type: 'string',
            description: 'Path where class file should be created'
        },
        template: {
            type: 'string',
            description: 'Template to use (default: basic)'
        },
        extends: {
            type: 'string',
            description: 'Parent class to extend'
        },
        implements: {
            type: 'array',
            items: { type: 'string' },
            description: 'Interfaces to implement'
        },
        fields: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    visibility: { type: 'string' }
                }
            },
            description: 'Class fields to generate'
        },
        methods: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    parameters: { type: 'array' },
                    return_type: { type: 'string' }
                }
            },
            description: 'Methods to generate'
        }
    },
    required: ['name', 'path']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    file_created: string,
    content: string,
    lines: number
}
```

**Implementation Details**:
- **Primary Library**: Template strings or `ts-morph` for TypeScript
- **Approach**:
  1. Build class structure from template
  2. Add package/imports
  3. Add class declaration with extends/implements
  4. Generate fields with getters/setters if needed
  5. Generate method stubs
  6. Format with Prettier
  7. Write to file
- **Safety**: Don't overwrite existing files
- **Error Handling**: Error if file exists
- **Dry-Run**: Return generated content

**Estimated Effort**: Medium (2-3 days)

**Dependencies**: CT-001 (for formatting)

---

### CG-003: repository-generate_interface

**Purpose**: Generate an interface from an existing class, extracting public methods.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        source_path: {
            type: 'string',
            description: 'Path to source class'
        },
        interface_name: {
            type: 'string',
            description: 'Name for generated interface'
        },
        destination_path: {
            type: 'string',
            description: 'Where to create interface file'
        },
        include_methods: {
            type: 'string',
            enum: ['all', 'public', 'protected'],
            description: 'Which methods to include (default: public)',
            default: 'public'
        }
    },
    required: ['source_path', 'interface_name', 'destination_path']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    interface_created: string,
    methods_included: number,
    content: string
}
```

**Implementation Details**:
- **Primary Library**: `@babel/parser` for JS/TS, `tree-sitter` for Java
- **Approach**:
  1. Parse source class
  2. Extract methods based on visibility filter
  3. Generate interface with method signatures
  4. Write to destination
- **Safety**: Don't overwrite existing interfaces
- **Error Handling**: Error if class can't be parsed
- **Dry-Run**: Return generated interface

**Estimated Effort**: High (3-4 days)

**Dependencies**: CA-001

---

### CG-004: repository-scaffold_component

**Purpose**: Generate boilerplate code for common component types (REST controller, service,
repository, entity, DTO, etc.) following framework conventions.

**Input Schema**:
```typescript
{
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['rest-controller', 'service', 'repository', 'entity', 'dto', 'custom'],
            description: 'Type of component to scaffold'
        },
        name: {
            type: 'string',
            description: 'Component name'
        },
        path: {
            type: 'string',
            description: 'Base path for generated files'
        },
        framework: {
            type: 'string',
            description: 'Framework to use (default: auto-detect)',
            enum: ['quarkus', 'spring', 'express', 'auto']
        },
        options: {
            type: 'object',
            description: 'Component-specific options'
        }
    },
    required: ['type', 'name', 'path']
}
```

**Output Schema**:
```typescript
{
    success: boolean,
    files_created: string[],
    total_lines: number,
    next_steps: string[]
}
```

**Implementation Details**:
- **Primary Library**: Template system
- **Approach**:
  1. Detect or use specified framework
  2. Load appropriate templates for component type
  3. Generate files:
     - REST Controller: controller class with endpoints
     - Service: service interface and implementation
     - Repository: JPA repository or data access layer
     - Entity: JPA entity with annotations
     - DTO: data transfer object
  4. Apply naming conventions
  5. Add framework-specific annotations
  6. Write all files
- **Safety**: Don't overwrite existing files
- **Error Handling**: Error if templates not found
- **Dry-Run**: Return list of files that would be created

**Estimated Effort**: Medium (3-4 days)

**Dependencies**: FSA-007 (for framework detection)

---

## Required NPM Dependencies

Based on the tools above, here are the recommended dependencies to add:

```json
{
  "dependencies": {
    "fs-extra": "^11.2.0",
    "fast-glob": "^3.3.2",
    "prettier": "^3.4.2",
    "prettier-plugin-java": "^2.8.0",
    "ignore": "^6.0.2",
    "tree-sitter": "^0.21.1",
    "tree-sitter-java": "^0.23.4",
    "tree-sitter-typescript": "^0.23.2",
    "@babel/parser": "^7.26.5",
    "@babel/traverse": "^7.26.5",
    "@babel/generator": "^7.26.5",
    "@babel/types": "^7.26.5",
    "escomplex": "^2.1.0",
    "eslint-plugin-sonarjs": "^2.0.5",
    "dependency-cruiser": "^16.9.0",
    "pom-parser": "^1.2.0",
    "fast-xml-parser": "^4.5.2",
    "jscodeshift": "^17.1.1",
    "ts-morph": "^24.0.0",
    "recast": "^0.23.9",
    "execa": "^9.5.2"
  }
}
```

---

## Notes for Implementation

1. **Follow Existing Patterns**: All tools must implement the `Tool` interface with `execute()` and
   `executeMock()` methods.

2. **Path Safety**: Every tool must validate paths to prevent directory traversal attacks and ensure
   operations stay within the repository bounds.

3. **Dry-Run Support**: All write operations (FM-*, CT-*, CG-*) must support dry-run mode via the
   tool registry's dry-run setting.

4. **Error Handling**: Return structured error objects instead of throwing exceptions:
   ```typescript
   { error: true, message: 'Description', tool: 'tool-name' }
   ```

5. **Input Validation**: Validate all inputs against the schema at the start of `execute()`.

6. **Incremental Implementation**: Tools can be implemented in phases. Phase 1 tools have no
   dependencies and provide immediate value.

7. **Testing**: Each tool should have unit tests and integration tests covering success cases,
   error cases, and dry-run mode.

8. **Documentation**: Update tool registry, builder, and documentation as each tool is added.

---

## Document Maintenance

This document should be updated as tools are implemented:
- Change status in the summary table from "Not Implemented" to "Implemented"
- Add implementation notes or lessons learned to tool specifications
- Update effort estimates based on actual implementation time
- Add cross-references between related tools

---

**Document Version**: 1.0
**Last Updated**: 2026-02-06
**Total Tools Proposed**: 35
**Tools Implemented**: 3
