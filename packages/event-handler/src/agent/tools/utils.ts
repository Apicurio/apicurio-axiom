/**
 * Tool Utilities
 *
 * Shared utilities used by various tools.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * Promisified version of child_process.exec for async/await usage
 */
export const execAsync = promisify(exec);
