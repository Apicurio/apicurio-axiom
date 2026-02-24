/**
 * JavaScript Action Executor
 *
 * Executes JavaScript actions by dynamically importing and running modules.
 */

import { resolve } from 'node:path';
import type { Logger } from '@axiom/common';
import type { ActionConfig, ActionContext, JavaScriptAction } from '../../types/actions.js';
import type { Event } from '../../types/events.js';
import type { ActionExecutorInterface } from './action-executor-interface.js';

export class JavaScriptActionExecutor implements ActionExecutorInterface {
    private dryRun: boolean;
    private githubToken?: string;

    constructor(dryRun: boolean = false, githubToken?: string) {
        this.dryRun = dryRun;
        this.githubToken = githubToken;
    }

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
            // Build the action context
            const context: ActionContext = {
                logger: actionLogger,
                githubToken: this.githubToken || process.env.BOT_GITHUB_TOKEN,
                dryRun: this.dryRun,
                owner: event.repositoryOwner,
                repo: event.repositoryName,
            };

            // Dynamically import the JavaScript module
            const module = (await import(absolutePath)) as {
                default: (event: Event, context: ActionContext) => Promise<void> | undefined;
                run: (event: Event, context: ActionContext) => Promise<void> | undefined;
            };

            // Look for a default export or a 'run' function
            const handler = module.default || module.run;

            if (typeof handler !== 'function') {
                throw new Error(`JavaScript module must export a default function or a "run" function`);
            }

            // Execute the handler with the event and context
            await handler(event, context);

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
