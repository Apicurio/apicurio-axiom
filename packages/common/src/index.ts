/**
 * @axiom/common - Shared types, validation, schemas, and logging
 *
 * This package contains shared code used across all Axiom components:
 * - Event types and GitHub types
 * - NATS message wrapper types
 * - Event validation with JSON Schema
 * - Structured logging with correlation support
 * - Log management with automatic cleanup
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
export { EventValidator, type ValidationResult } from './validation/event-validator.js';

// Export logging classes and types
export {
    Logger,
    initializeLogger,
    getLogger,
    isLoggerInitialized,
    createActionLogger,
    type LogLevel,
    type LoggerConfig,
    type LogContext,
} from './logging/logger.js';

export { LogManager, type LogManagerConfig } from './logging/log-manager.js';
