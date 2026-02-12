/**
 * Test helpers for creating mock ToolContext objects
 */

import { vi } from 'vitest';
import type { ToolContext } from '../../src/types/agent.js';

/**
 * Create a mock ToolContext for testing
 *
 * @param workDir Working directory path
 * @param overrides Optional overrides for specific context properties
 * @returns Mock ToolContext
 */
export function createMockContext(workDir: string, overrides?: Partial<ToolContext>): ToolContext {
    return {
        workDir,
        logger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        },
        ...overrides,
    } as ToolContext;
}

/**
 * Create a spy context that tracks logger calls but doesn't mock them
 * Useful for integration tests where you want to see actual log output
 *
 * @param workDir Working directory path
 * @returns ToolContext with spied logger
 */
export function createSpyContext(workDir: string): ToolContext {
    const logger = {
        info: vi.fn((...args: any[]) => console.log('[INFO]', ...args)),
        error: vi.fn((...args: any[]) => console.error('[ERROR]', ...args)),
        warn: vi.fn((...args: any[]) => console.warn('[WARN]', ...args)),
        debug: vi.fn((...args: any[]) => console.debug('[DEBUG]', ...args)),
    };

    return {
        workDir,
        logger,
    } as ToolContext;
}
