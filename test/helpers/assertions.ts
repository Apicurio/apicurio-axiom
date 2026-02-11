/**
 * Custom assertions for tool testing
 */

import { expect } from 'vitest';

/**
 * Assert that a tool result is an error
 *
 * @param result Tool execution result
 * @param expectedMessage Optional expected error message substring
 */
export function assertToolError(result: any, expectedMessage?: string): void {
    expect(result.error).toBe(true);
    expect(result.message).toBeDefined();

    if (expectedMessage) {
        expect(result.message).toContain(expectedMessage);
    }

    expect(result.tool).toBeDefined();
}

/**
 * Assert that a tool result is successful (no error)
 *
 * @param result Tool execution result
 */
export function assertToolSuccess(result: any): void {
    expect(result.error).toBeUndefined();
}

/**
 * Assert that a path is within a parent directory
 *
 * @param childPath Path to check
 * @param parentPath Expected parent directory
 */
export function assertPathWithinDirectory(childPath: string, parentPath: string): void {
    const normalizedChild = childPath.replace(/\\/g, '/');
    const normalizedParent = parentPath.replace(/\\/g, '/');

    expect(normalizedChild.startsWith(normalizedParent)).toBe(true);
}

/**
 * Assert that logger was called with a specific message
 *
 * @param logger Mocked logger
 * @param level Log level (info, error, warn, debug)
 * @param messageSubstring Expected message substring
 */
export function assertLoggerCalled(
    logger: any,
    level: 'info' | 'error' | 'warn' | 'debug',
    messageSubstring: string,
): void {
    expect(logger[level]).toHaveBeenCalled();

    const calls = logger[level].mock.calls;
    const found = calls.some((call: any[]) => {
        return call.some((arg) => typeof arg === 'string' && arg.includes(messageSubstring));
    });

    expect(found).toBe(true);
}
