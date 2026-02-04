/**
 * JavaScript Action Executor
 *
 * Executes JavaScript actions by dynamically importing and running modules.
 */

import { resolve } from 'node:path';
import type { Logger } from '../../logging/logger.js';
import type { ActionConfig, JavaScriptAction } from '../../types/actions.js';
import type { Event } from '../../types/events.js';
import type { ActionExecutorInterface } from './action-executor-interface.js';

export class JavaScriptActionExecutor implements ActionExecutorInterface {
    /**
     * Executes a JavaScript action
     *
     * @param action Action configuration
     * @param event Event object
     * @param actionLogger Action logger instance
     */
    async execute(action: ActionConfig, event: Event, actionLogger: Logger): Promise<void> {
        if (action.type !== 'javascript') {
            throw new Error('Invalid action type for JavaScriptActionExecutor');
        }

        const codePath = action.code;

        if (!codePath) {
            throw new Error('JavaScript action missing "code" field');
        }

        const absolutePath = resolve(process.cwd(), codePath);

        actionLogger.info(`Running JavaScript code: ${codePath}`);

        try {
            // Dynamically import the JavaScript module
            const module = (await import(absolutePath)) as {
                default: (event: Event, actionLogger: Logger) => Promise<void> | undefined;
                run: (event: Event, actionLogger: Logger) => Promise<void> | undefined;
            };

            // Look for a default export or a 'run' function
            const handler = module.default || module.run;

            if (typeof handler !== 'function') {
                throw new Error(`JavaScript module must export a default function or a "run" function`);
            }

            // Execute the handler with the event and logger
            await handler(event, actionLogger);

            actionLogger.info('JavaScript action completed successfully');
        } catch (error) {
            actionLogger.error(`JavaScript action failed: ${(error as Error).message}`);
            throw error;
        }
    }

    async executeDryRun(action: ActionConfig, event: Event, actionLogger: Logger): Promise<void> {
        actionLogger.info('--- DRY RUN: Action would be executed as follows ---');
        actionLogger.info('Dry run configuration', { actionType: action.type });

        actionLogger.info('JavaScript action details', {
            codeModule: (action as JavaScriptAction).code,
            eventData: event,
        });

        actionLogger.info('--- End of dry run information ---');
    }
}
