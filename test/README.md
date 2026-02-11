# Testing Documentation

This directory contains all tests for the Apicurio Axiom project.

## Directory Structure

```
test/
├── fixtures/              # Test fixtures and sample data
│   ├── test-repo/        # Sample repository for testing repo tools
│   ├── binary-files/     # Binary test files
│   └── edge-cases/       # Edge case test files
├── helpers/               # Shared test utilities
│   ├── mock-context.ts   # Mock ToolContext factory
│   ├── temp-repo.ts      # Temporary directory helpers
│   └── assertions.ts     # Custom assertions
├── unit/                  # Unit tests (mirrors src/ structure)
│   └── agent/
│       └── tools/
│           ├── repo_read/
│           └── repo_write/
├── integration/           # Integration tests (future)
└── README.md             # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { YourTool } from '../path/to/tool.js';
import { createMockContext } from '../../../helpers/mock-context.js';
import { assertToolSuccess, assertToolError } from '../../../helpers/assertions.js';

describe('YourTool', () => {
    const testRepoPath = path.resolve(process.cwd(), 'test/fixtures/test-repo');

    describe('Basic Functionality', () => {
        it('should execute successfully', async () => {
            const context = createMockContext(testRepoPath);
            const result = await YourTool.execute({ /* params */ }, context);

            assertToolSuccess(result);
            expect(result.someField).toBe(expectedValue);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid input', async () => {
            const context = createMockContext(testRepoPath);
            const result = await YourTool.execute({ /* invalid params */ }, context);

            assertToolError(result, 'expected error message');
        });
    });
});
```

### Using Test Helpers

#### Mock Context

```typescript
import { createMockContext } from '../helpers/mock-context.js';

// Create a basic mock context
const context = createMockContext('/path/to/workdir');

// Check if logger was called
expect(context.logger.info).toHaveBeenCalled();
expect(context.logger.error).toHaveBeenCalledWith(expect.stringContaining('error'));
```

#### Temporary Repositories

```typescript
import { createTempRepo, cleanupTempRepo } from '../helpers/temp-repo.js';

// Create a temporary test repository
const tempDir = await createTempRepo({
    'README.md': '# Test',
    'src': {
        'index.ts': 'console.log("test");',
        'utils': {
            'helper.ts': 'export function help() {}'
        }
    }
});

// Use the temp directory
const context = createMockContext(tempDir);
// ... run tests

// Clean up
await cleanupTempRepo(tempDir);

// Or use the setup helper for automatic cleanup
const getTempDir = setupTempRepo({
    'file.txt': 'content'
});

it('should work', async () => {
    const dir = getTempDir();
    // Test automatically cleans up after
});
```

#### Custom Assertions

```typescript
import { assertToolSuccess, assertToolError } from '../helpers/assertions.js';

// Assert successful execution
assertToolSuccess(result);

// Assert error with optional message check
assertToolError(result, 'expected substring');
```

## Test Coverage

The project aims for:
- **80%** line coverage
- **80%** function coverage
- **75%** branch coverage
- **80%** statement coverage

Run `npm run test:coverage` to generate coverage reports in the `coverage/` directory.

## Test Categories

### Unit Tests (test/unit/)

Test individual tools and functions in isolation with mocked dependencies.

**Coverage Priority:**
1. **High Priority**: Security-critical tools (path validation, file operations)
2. **Medium Priority**: Core functionality tools
3. **Low Priority**: Utility tools

### Integration Tests (test/integration/) - Future

Test multiple tools working together or tools interacting with real external systems.

## Best Practices

1. **Test Organization**: Group related tests using `describe()` blocks
2. **Clear Test Names**: Use descriptive test names that explain what is being tested
3. **Arrange-Act-Assert**: Structure tests clearly (setup, execute, verify)
4. **Edge Cases**: Always test boundary conditions and error cases
5. **Security**: Always test path traversal and injection attempts
6. **Isolation**: Each test should be independent and not rely on other tests
7. **Cleanup**: Always clean up resources (temp files, etc.)
8. **Fixtures**: Use shared fixtures for common test data
9. **Helpers**: Extract common test logic into helpers

## Debugging Tests

### Run a single test file

```bash
npm test -- search_code.test.ts
```

### Run tests matching a pattern

```bash
npm test -- -t "should find matches"
```

### Debug in watch mode

```bash
npm run test:watch
# Then press 'f' to run only failed tests
# Press 'p' to filter by filename
# Press 't' to filter by test name
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Release tags

The CI pipeline requires all tests to pass and coverage thresholds to be met.

## Reference Implementation

See `test/unit/agent/tools/repo_read/search_code.test.ts` for a comprehensive example of:
- Complete test coverage
- All test patterns
- Security testing
- Edge case handling
- Mock usage
