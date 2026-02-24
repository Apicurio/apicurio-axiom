/**
 * Action Executor Interface
 *
 * Common interface for all action executor types.
 */

import type { Logger } from '@axiom/common';
import type { ActionConfig } from '../../types/actions.js';
import type { Event } from '../../types/events.js';

/**
 * Interface for action executors
 */
export interface ActionExecutorInterface {
    /**
     * Executes the action
     *
     * @param action Action configuration
     * @param event Event object
     * @param actionLogger Logger instance for this action execution
     */
    execute(action: ActionConfig, event: Event, actionLogger: Logger): Promise<void>;

    /**
     * Executes a dry-run of the action
     * @param action
     * @param event
     * @param actionLogger
     */
    executeDryRun(action: ActionConfig, event: Event, actionLogger: Logger): Promise<void>;
}
