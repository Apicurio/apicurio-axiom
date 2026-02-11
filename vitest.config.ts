import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Enable globals (describe, it, expect, etc.)
        globals: true,

        // Test environment
        environment: 'node',

        // Test file patterns
        include: ['test/**/*.test.ts'],

        // Files to exclude
        exclude: ['node_modules', 'dist', 'work', '.git'],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage',
            exclude: [
                'node_modules/**',
                'dist/**',
                'test/**',
                '**/*.test.ts',
                '**/*.config.ts',
                'src/index.ts',
            ],
            // Coverage thresholds
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80,
            },
        },

        // Test timeout (10 seconds)
        testTimeout: 10000,

        // Hook timeout
        hookTimeout: 10000,

        // Enable concurrent tests by default
        sequence: {
            concurrent: true,
        },

        // Reporter configuration
        reporters: ['verbose'],

        // Watch options
        watch: false,

        // Pool configuration (Vitest 4+)
        pool: 'threads',
    },
});
