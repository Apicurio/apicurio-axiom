/**
 * Structured Logger
 *
 * Provides structured logging with correlation IDs, log levels, JSON formatting, and file output.
 * Built on Pino for high performance and flexible output.
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import pino from 'pino';

/**
 * Log levels supported by the logger
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Logger configuration options
 */
export interface LoggerConfig {
    level?: LogLevel;
    prettyPrint?: boolean;
    logToFile?: boolean;
    filePath?: string;
}

/**
 * Context object for correlation tracking
 */
export interface LogContext {
    correlationId?: string;
    eventId?: string;
    jobId?: number;
    repository?: string;
    actionName?: string;
    [key: string]: any;
}

/**
 * Async local storage for correlation context
 */
const { AsyncLocalStorage } = await import('node:async_hooks');
const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

/**
 * Creates a pino logger instance with the specified configuration
 */
async function createPinoLogger(config: LoggerConfig): Promise<pino.Logger> {
    const options: pino.LoggerOptions = {
        level: config.level || 'info',
        formatters: {
            level: (label) => {
                return { level: label };
            },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
            pid: process.pid,
            hostname: undefined, // Remove hostname for cleaner logs
        },
    };

    // If logging to file
    if (config.logToFile && config.filePath) {
        // Ensure directory exists
        const logDir = dirname(resolve(config.filePath));
        if (!existsSync(logDir)) {
            await mkdir(logDir, { recursive: true });
        }

        return pino({
            ...options,
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: false, // No colors in file output
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                    destination: resolve(config.filePath),
                    sync: false, // Async writes for better performance
                    mkdir: true,
                },
            },
        });
    }

    // Pretty printing for development (stdout)
    if (config.prettyPrint) {
        return pino({
            ...options,
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
            },
        });
    }

    // JSON output to stdout (production)
    return pino(options);
}

/**
 * Logger class providing structured logging with correlation support
 */
export class Logger {
    private logger: pino.Logger;
    private defaultContext: LogContext;

    /**
     * Creates a new Logger instance
     *
     * @param _config Logger configuration (unused, kept for compatibility)
     * @param pinoLoggerOrContext Either a pino logger instance or default context
     */
    constructor(_config: LoggerConfig = {}, pinoLoggerOrContext?: pino.Logger | LogContext) {
        // If second param is a pino logger, use it; otherwise create new one
        if (pinoLoggerOrContext && 'info' in pinoLoggerOrContext && typeof pinoLoggerOrContext.info === 'function') {
            this.logger = pinoLoggerOrContext as pino.Logger;
            this.defaultContext = {};
        } else {
            // Note: createPinoLogger is async, but constructor must be sync
            // This will be handled by initializeLogger
            throw new Error('Use initializeLogger() to create logger instances');
        }
    }

    /**
     * Internal constructor for creating logger with existing pino instance
     */
    static createWithPinoLogger(pinoLogger: pino.Logger, defaultContext: LogContext = {}): Logger {
        const logger = Object.create(Logger.prototype);
        logger.logger = pinoLogger;
        logger.defaultContext = defaultContext;
        return logger;
    }

    /**
     * Merges context from async local storage with provided context
     */
    private mergeContext(context?: LogContext): LogContext {
        const asyncContext = asyncLocalStorage.getStore() || {};
        return {
            ...this.defaultContext,
            ...asyncContext,
            ...context,
        };
    }

    /**
     * Logs a trace message
     */
    trace(message: string, context?: LogContext): void {
        this.logger.trace(this.mergeContext(context), message);
    }

    /**
     * Logs a debug message
     */
    debug(message: string, context?: LogContext): void {
        this.logger.debug(this.mergeContext(context), message);
    }

    /**
     * Logs an info message
     */
    info(message: string, context?: LogContext): void {
        this.logger.info(this.mergeContext(context), message);
    }

    /**
     * Logs a warning message
     */
    warn(message: string, context?: LogContext): void {
        this.logger.warn(this.mergeContext(context), message);
    }

    /**
     * Logs an error message
     */
    error(message: string, error?: Error, context?: LogContext): void {
        const errorContext = error
            ? {
                  error: {
                      message: (error as Error).message,
                      stack: (error as Error).stack,
                      name: (error as Error).name,
                  },
              }
            : {};
        this.logger.error({ ...this.mergeContext(context), ...errorContext }, message);
    }

    /**
     * Logs a fatal message
     */
    fatal(message: string, error?: Error, context?: LogContext): void {
        const errorContext = error
            ? {
                  error: {
                      message: (error as Error).message,
                      stack: (error as Error).stack,
                      name: (error as Error).name,
                  },
              }
            : {};
        this.logger.fatal({ ...this.mergeContext(context), ...errorContext }, message);
    }

    /**
     * Creates a child logger with additional default context
     */
    child(context: LogContext): Logger {
        const childDefaultContext = { ...this.defaultContext, ...context };
        return Logger.createWithPinoLogger(this.logger.child(context), childDefaultContext);
    }

    /**
     * Runs a function with a correlation context
     */
    static withContext<T>(context: LogContext, fn: () => T): T {
        return asyncLocalStorage.run(context, fn);
    }

    /**
     * Runs an async function with a correlation context
     */
    static async withContextAsync<T>(context: LogContext, fn: () => Promise<T>): Promise<T> {
        return asyncLocalStorage.run(context, fn);
    }

    /**
     * Generates a new correlation ID
     */
    static generateCorrelationId(): string {
        return randomUUID();
    }

    /**
     * Gets the current correlation context
     */
    static getContext(): LogContext | undefined {
        return asyncLocalStorage.getStore();
    }

    /**
     * Gets the underlying pino logger (for advanced use cases)
     */
    getPinoLogger(): pino.Logger {
        return this.logger;
    }

    /**
     * Flushes any buffered log messages
     *
     * This should be called when finishing an action to ensure all logs are written
     */
    async flush(): Promise<void> {
        return new Promise((resolve) => {
            this.logger.flush(() => resolve());
        });
    }
}

/**
 * Default logger instance for the application
 */
let defaultLogger: Logger | null = null;

/**
 * Initializes the default logger
 *
 * @param config Logger configuration
 */
export async function initializeLogger(config: LoggerConfig = {}): Promise<Logger> {
    const pinoLogger = await createPinoLogger(config);
    defaultLogger = Logger.createWithPinoLogger(pinoLogger);
    return defaultLogger;
}

/**
 * Gets the default logger instance
 *
 * @throws Error if logger has not been initialized
 */
export function getLogger(): Logger {
    if (!defaultLogger) {
        throw new Error('Logger not initialized. Call initializeLogger() first.');
    }
    return defaultLogger;
}

/**
 * Type guard to check if logger is initialized
 */
export function isLoggerInitialized(): boolean {
    return defaultLogger !== null;
}

/**
 * Creates an action-specific logger that writes to a file
 *
 * This creates a pino logger instance that writes to the specified file path.
 * The logger should be used for the duration of an action execution and then
 * flushed/closed when the action completes.
 *
 * @param filePath Path to the log file
 * @returns Logger instance that writes to the file
 */
export async function createActionLogger(filePath: string): Promise<Logger> {
    // Ensure directory exists
    const logDir = dirname(resolve(filePath));
    if (!existsSync(logDir)) {
        await mkdir(logDir, { recursive: true });
    }

    const pinoOptions: pino.LoggerOptions = {
        level: 'trace', // Log everything for action logs
        formatters: {
            level: (label) => {
                return { level: label };
            },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: false, // No colors in file output
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                destination: resolve(filePath),
                sync: true, // Synchronous writes for action logs to ensure all logs are written
                mkdir: true,
            },
        },
    };

    // Create a pino logger with pretty formatting
    const pinoLogger = pino(pinoOptions);

    return Logger.createWithPinoLogger(pinoLogger);
}
