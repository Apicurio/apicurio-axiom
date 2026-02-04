/**
 * Event filter type definitions
 */

// Path-based filter with various matchers
export interface PathFilter {
    path: string;
    equals?: any;
    contains?: string;
    matches?: string;
    startsWith?: string;
    endsWith?: string;
    exists?: boolean;
    in?: any[];
    any?: any;
    all?: any;
    greaterThan?: number;
    lessThan?: number;
}

// Legacy filter syntax (backwards compatible)
export interface LegacyFilter {
    label?: string;
    state?: string;
    author?: string;
    draft?: boolean;
}

// Union of all filter types
export type EventFilter = PathFilter | LegacyFilter;

// Event mapping configuration
export interface EventMapping {
    event: string;
    repository?: string;
    filters?: EventFilter[];
    actions: string[];
}
