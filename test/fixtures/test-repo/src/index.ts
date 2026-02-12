/**
 * Main entry point for the test application
 */

import { calculateSum, helper } from './utils/helper.js';

/**
 * Main function that demonstrates the application
 */
function main(): void {
    console.log('Starting test application...');
    const result = helper('test');
    console.log(`Result: ${result}`);

    const sum = calculateSum(1, 2, 3, 4, 5);
    console.log(`Sum: ${sum}`);
}

/**
 * Process data with validation
 *
 * @param data Data to process
 * @returns Processed data
 */
export function processData(data: string): string {
    if (!data) {
        throw new Error('Data is required');
    }
    return data.toUpperCase();
}

main();
