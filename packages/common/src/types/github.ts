/**
 * GitHub API type definitions
 *
 * Minimal types for the GitHub events we care about.
 * The full GitHub API has many more fields, but we only type what we use.
 */

export interface GitHubUser {
    login: string;
    [key: string]: any;
}

export interface GitHubLabel {
    name: string;
    [key: string]: any;
}

export interface GitHubIssue {
    number: number;
    title: string;
    state: string;
    labels?: GitHubLabel[];
    user?: GitHubUser;
    html_url: string;
    [key: string]: any;
}

export interface GitHubPullRequest {
    number: number;
    title: string;
    state: string;
    labels?: GitHubLabel[];
    user?: GitHubUser;
    html_url: string;
    draft: boolean;
    [key: string]: any;
}

export interface GitHubComment {
    body: string;
    user?: GitHubUser;
    html_url: string;
    [key: string]: any;
}

export interface GitHubEventPayload {
    action?: string;
    issue?: GitHubIssue;
    pull_request?: GitHubPullRequest;
    comment?: GitHubComment;
    label?: GitHubLabel;
    [key: string]: any;
}

export interface GitHubEvent {
    id: string;
    type: string;
    actor: GitHubUser;
    created_at: string;
    payload: GitHubEventPayload;
    [key: string]: any;
}
