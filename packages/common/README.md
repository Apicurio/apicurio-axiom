# @axiom/common

Shared types, validation, and schemas for Apicurio Axiom components.

## Overview

This package contains common code used across all Axiom components (pollers and event handler):

- **Event Types**: Normalized event structure used throughout the system
- **GitHub Types**: TypeScript definitions for GitHub API objects
- **NATS Types**: Message wrapper for event passing via NATS
- **Event Validation**: JSON Schema validation for events

## Installation

This package is part of the Axiom workspace and is referenced using workspace protocol:

```json
{
  "dependencies": {
    "@axiom/common": "workspace:*"
  }
}
```

## Usage

### Importing Types

```typescript
import type {
    Event,
    IssueEvent,
    PullRequestEvent,
    GitHubEvent,
    NatsEventMessage,
} from '@axiom/common';
```

### Event Validation

```typescript
import { EventValidator } from '@axiom/common';

const validator = new EventValidator();
const result = validator.validateEvent(event);

if (!result.valid) {
    console.error('Validation failed:', validator.formatErrors(result.errors));
}
```

### NATS Message Structure

```typescript
import type { NatsEventMessage } from '@axiom/common';

const message: NatsEventMessage = {
    schema_version: '1.0.0',
    schema_id: 'event.schema.json',
    source: 'github',
    timestamp: new Date().toISOString(),
    event: {
        id: '12345',
        type: 'issue.opened',
        repository: 'owner/repo',
        // ... rest of event
    },
};
```

## Building

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## License

Apache-2.0
