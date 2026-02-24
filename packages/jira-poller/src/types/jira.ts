/**
 * Jira API type definitions
 *
 * Minimal types for Jira issues and events.
 */

export interface JiraUser {
    accountId: string;
    displayName: string;
    emailAddress?: string;
    [key: string]: any;
}

export interface JiraStatus {
    name: string;
    statusCategory: {
        key: string;
        name: string;
    };
    [key: string]: any;
}

export interface JiraIssueType {
    name: string;
    [key: string]: any;
}

export interface JiraPriority {
    name: string;
    [key: string]: any;
}

export interface JiraIssueFields {
    summary: string;
    description?: string;
    status: JiraStatus;
    issuetype: JiraIssueType;
    priority?: JiraPriority;
    assignee?: JiraUser;
    reporter?: JiraUser;
    labels?: string[];
    created: string;
    updated: string;
    [key: string]: any;
}

export interface JiraIssue {
    id: string;
    key: string;
    self: string;
    fields: JiraIssueFields;
    [key: string]: any;
}

/**
 * Simplified Jira event structure
 *
 * Note: This is a normalized structure based on common Jira webhook/API patterns.
 * Actual Jira webhooks may have different structures depending on event type.
 */
export interface JiraEvent {
    timestamp: string;
    webhookEvent: string;
    issue?: JiraIssue;
    user?: JiraUser;
    changelog?: {
        items: Array<{
            field: string;
            fromString?: string;
            toString?: string;
        }>;
    };
}
