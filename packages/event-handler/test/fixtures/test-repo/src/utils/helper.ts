/**
 * Utility helper functions
 */

/**
 * Helper function for processing strings
 *
 * @param input Input string
 * @returns Processed string
 */
export function helper(input: string): string {
    return `Helper processed: ${input}`;
}

/**
 * Calculate the sum of numbers
 *
 * @param numbers Numbers to sum
 * @returns Sum of all numbers
 */
export function calculateSum(...numbers: number[]): number {
    return numbers.reduce((acc, num) => acc + num, 0);
}

/**
 * Format a date string
 *
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
    return date.toISOString();
}
