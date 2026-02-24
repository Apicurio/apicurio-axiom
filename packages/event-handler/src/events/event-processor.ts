/**
 * Event Processor
 *
 * Matches events against configured rules and triggers actions.
 */

import { getLogger, type Logger } from '@axiom/common';
import type { Event } from '../types/events.js';
import type { EventFilter, EventMapping, LegacyFilter, PathFilter } from '../types/filters.js';

// Forward declaration for ActionExecutor to avoid circular dependency
interface ActionExecutor {
    execute(actionName: string, event: Event): Promise<void>;
}

export class EventProcessor {
    private logger: Logger;
    private eventMappings: EventMapping[];
    private actionExecutor: ActionExecutor;

    /**
     * Creates a new EventProcessor instance
     *
     * @param eventMappings Event mapping configurations
     * @param actionExecutor Action executor instance
     */
    constructor(eventMappings: EventMapping[], actionExecutor: ActionExecutor) {
        this.eventMappings = eventMappings || [];
        this.actionExecutor = actionExecutor;
        this.logger = getLogger();
    }

    /**
     * Processes an event and triggers matching actions
     *
     * @param event Normalized event object
     */
    async process(event: Event): Promise<void> {
        const matchingMappings = this.findMatchingMappings(event);

        if (matchingMappings.length === 0) {
            return;
        }

        this.logger.info(`[${event.id}] Event type ${event.type} matches ${matchingMappings.length} mapping(s)`);

        for (const mapping of matchingMappings) {
            await this.executeMapping(event, mapping);
        }
    }

    /**
     * Finds event mappings that match the given event
     *
     * @param event Normalized event object
     * @returns Array of matching event mappings
     */
    findMatchingMappings(event: Event): EventMapping[] {
        return this.eventMappings.filter((mapping) => this.matchesMapping(event, mapping));
    }

    /**
     * Checks if an event matches a mapping's criteria
     *
     * @param event Normalized event object
     * @param mapping Event mapping configuration
     * @returns True if the event matches
     */
    matchesMapping(event: Event, mapping: EventMapping): boolean {
        // Check event type
        if (!this.matchesEventType(event.type, mapping.event)) {
            return false;
        }

        // Check filters if present
        if (mapping.filters && !this.matchesFilters(event, mapping.filters)) {
            return false;
        }

        // Check repository filter if present
        if (mapping.repository && event.repository !== mapping.repository) {
            return false;
        }

        return true;
    }

    /**
     * Checks if an event type matches a pattern
     *
     * Supports wildcards, e.g., "issue.*" matches "issue.opened", "issue.closed", etc.
     *
     * @param eventType Event type
     * @param pattern Event pattern to match
     * @returns True if matches
     */
    matchesEventType(eventType: string, pattern: string): boolean {
        if (pattern === eventType) {
            return true;
        }

        // Support wildcard matching
        if (pattern.endsWith('.*')) {
            const prefix = pattern.slice(0, -2);
            return eventType.startsWith(`${prefix}.`);
        }

        if (pattern === '*') {
            return true;
        }

        return false;
    }

    /**
     * Checks if an event matches all filters
     *
     * @param event Normalized event object
     * @param filters Array of filter objects
     * @returns True if all filters match
     */
    matchesFilters(event: Event, filters: EventFilter[]): boolean {
        return filters.every((filter) => this.matchesFilter(event, filter));
    }

    /**
     * Checks if an event matches a single filter
     *
     * Supports both legacy filter syntax and new path-based syntax:
     * - Legacy: { label: "bug" } checks if "bug" is in issue/PR labels
     * - New: { path: "payload.label.name", equals: "bug" } checks specific property
     *
     * @param event Event object (raw GitHub event from logs)
     * @param filter Filter object
     * @returns True if the filter matches
     */
    matchesFilter(event: Event, filter: EventFilter): boolean {
        // New generic path-based filter syntax
        if ('path' in filter) {
            return this.matchesPathFilter(event, filter as PathFilter);
        }

        // Legacy filter syntax (backwards compatible)
        return this.matchesLegacyFilter(event, filter as LegacyFilter);
    }

    /**
     * Matches a filter using the new path-based syntax
     *
     * @param event Event object
     * @param filter Filter object with path and matcher
     * @returns True if the filter matches
     */
    matchesPathFilter(event: Event, filter: PathFilter): boolean {
        const value = this.getValueByPath(event, filter.path);

        // equals matcher
        if (filter.equals !== undefined) {
            return value === filter.equals;
        }

        // contains matcher (for strings)
        if (filter.contains !== undefined) {
            return typeof value === 'string' && value.includes(filter.contains);
        }

        // matches matcher (regex)
        if (filter.matches !== undefined) {
            const regex = new RegExp(filter.matches);
            return typeof value === 'string' && regex.test(value);
        }

        // startsWith matcher
        if (filter.startsWith !== undefined) {
            return typeof value === 'string' && value.startsWith(filter.startsWith);
        }

        // endsWith matcher
        if (filter.endsWith !== undefined) {
            return typeof value === 'string' && value.endsWith(filter.endsWith);
        }

        // exists matcher (check if property exists and is not null/undefined)
        if (filter.exists !== undefined) {
            return filter.exists ? value !== null && value !== undefined : value === null || value === undefined;
        }

        // in matcher (check if value is in an array)
        if (filter.in !== undefined && Array.isArray(filter.in)) {
            return filter.in.includes(value);
        }

        // any matcher (for arrays - check if any element matches)
        if (filter.any !== undefined) {
            if (!Array.isArray(value)) {
                return false;
            }
            return value.some((item) => this.matchesObjectOrValue(item, filter.any));
        }

        // all matcher (for arrays - check if all elements match)
        if (filter.all !== undefined) {
            if (!Array.isArray(value)) {
                return false;
            }
            return value.every((item) => this.matchesObjectOrValue(item, filter.all));
        }

        // greaterThan matcher
        if (filter.greaterThan !== undefined) {
            return typeof value === 'number' && value > filter.greaterThan;
        }

        // lessThan matcher
        if (filter.lessThan !== undefined) {
            return typeof value === 'number' && value < filter.lessThan;
        }

        this.logger.warn('No matcher specified for path filter:', filter);
        return false;
    }

    /**
     * Matches legacy filter syntax (backwards compatible)
     *
     * @param event Normalized event object
     * @param filter Filter object
     * @returns True if the filter matches
     */
    matchesLegacyFilter(event: Event, filter: LegacyFilter): boolean {
        // Label filter
        if (filter.label !== undefined) {
            const labels = event.issue?.labels || event.pullRequest?.labels || [];
            return labels.includes(filter.label);
        }

        // State filter
        if (filter.state !== undefined) {
            const state = event.issue?.state || event.pullRequest?.state;
            return state === filter.state;
        }

        // Author filter
        if (filter.author !== undefined) {
            return event.actor === filter.author;
        }

        // Draft filter (for PRs)
        if (filter.draft !== undefined) {
            return event.pullRequest?.draft === filter.draft;
        }

        this.logger.warn('Unknown filter type:', filter);
        return false;
    }

    /**
     * Gets a value from an object using a dot-notation path
     *
     * @param obj Object to traverse
     * @param path Dot-notation path (e.g., "payload.label.name")
     * @returns Value at path, or undefined if not found
     */
    getValueByPath(obj: any, path: string): any {
        const parts = path.split('.');
        let current: any = obj;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * Matches an object or value against a matcher object
     *
     * Used for array element matching (any/all matchers)
     *
     * @param item Item to match (can be object or primitive)
     * @param matcher Matcher object or primitive value
     * @returns True if matches
     */
    matchesObjectOrValue(item: any, matcher: any): boolean {
        // If matcher is a primitive value, do direct comparison
        if (typeof matcher !== 'object' || matcher === null) {
            return item === matcher;
        }

        // If matcher is an object, check if all properties match
        for (const [key, value] of Object.entries(matcher)) {
            if (typeof item !== 'object' || item === null) {
                return false;
            }

            if (item[key] !== value) {
                return false;
            }
        }

        return true;
    }

    /**
     * Executes all actions for a matching mapping
     *
     * @param event Normalized event object
     * @param mapping Event mapping configuration
     */
    async executeMapping(event: Event, mapping: EventMapping): Promise<void> {
        if (!mapping.actions || mapping.actions.length === 0) {
            return;
        }

        this.logger.info(`[${event.id}] Executing ${mapping.actions.length} action(s) for ${event.type} event`);

        for (const actionName of mapping.actions) {
            try {
                await this.actionExecutor.execute(actionName, event);
            } catch (error) {
                this.logger.error(`Failed to execute action "${actionName}":`, error as Error);
            }
        }
    }
}
