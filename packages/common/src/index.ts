/**
 * @axiom/common - Shared types, validation, and schemas
 *
 * This package contains shared code used across all Axiom components:
 * - Event types and GitHub types
 * - NATS message wrapper types
 * - Event validation with JSON Schema
 */

// Export all event types
export type {
    Event,
    IssueEvent,
    PullRequestEvent,
    CommentEvent,
    DiscussionEvent,
} from './types/events.js';

// Export all GitHub types
export type {
    GitHubUser,
    GitHubLabel,
    GitHubIssue,
    GitHubPullRequest,
    GitHubComment,
    GitHubEventPayload,
    GitHubEvent,
} from './types/github.js';

// Export NATS message types
export type { NatsEventMessage } from './types/nats.js';

// Export validation classes and types
export { EventValidator, type ValidationResult, type Logger } from './validation/event-validator.js';
