/**
 * Event type definitions
 */

import type { GitHubEvent, GitHubEventPayload } from './github.js';

export interface IssueEvent {
    number: number;
    title: string;
    state: string;
    labels: string[];
    author: string;
    url: string;
}

export interface PullRequestEvent {
    number: number;
    title: string;
    state: string;
    labels: string[];
    author: string;
    url: string;
    draft: boolean;
}

export interface CommentEvent {
    author: string;
    url: string;
    body: string;
}

export interface DiscussionEvent {
    number: number;
    title: string;
    category: string;
    author: string;
    url: string;
}

export interface Event {
    id: string;
    type: string;
    repository: string;
    repositoryOwner: string;
    repositoryName: string;
    actor: string;
    createdAt: string;
    issue?: IssueEvent;
    pullRequest?: PullRequestEvent;
    discussion?: DiscussionEvent;
    comment?: CommentEvent;
    label?: string;
    payload?: GitHubEventPayload;
    rawEvent?: GitHubEvent;
}
