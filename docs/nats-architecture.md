# NATS Architecture

This document describes the NATS-based event architecture for Apicurio Axiom.

## Overview

Axiom uses NATS JetStream as a message broker to decouple event ingestion (pollers) from event processing
(event handler). This architecture enables:

- **Independent scaling** of pollers and handlers
- **Multiple event sources** (GitHub, Jira, etc.)
- **Reliable delivery** with at-least-once semantics
- **Event replay** for debugging and recovery
- **Separate lifecycles** for each component

## Architecture Diagram

```
┌──────────────┐       ┌──────────────┐
│   GitHub     │       │     Jira     │
│     API      │       │     API      │
└──────┬───────┘       └──────┬───────┘
       │                      │
       ▼                      ▼
┌──────────────┐       ┌──────────────┐
│   GitHub     │       │     Jira     │
│   Poller     │       │    Poller    │
└──────┬───────┘       └──────┬───────┘
       │                      │
       └──────┬───────────────┘
              │ publish
              ▼
       ┌─────────────┐
       │    NATS     │
       │ JetStream   │
       └──────┬──────┘
              │ subscribe
              ▼
       ┌─────────────┐
       │   Event     │
       │  Handler    │
       └─────────────┘
```

## NATS JetStream Configuration

### Stream: AXIOM_EVENTS

- **Subjects**: `events.>`
- **Retention**: WorkQueue (messages deleted after acknowledgment)
- **Max Age**: 7 days (safety net for unacknowledged messages)
- **Max Messages Per Subject**: 1000
- **Storage**: File (persistent)
- **Replicas**: 1 (can be increased for HA)

### Consumer: axiom-event-handler

- **Type**: Pull consumer
- **Ack Policy**: Explicit (must manually acknowledge)
- **Max Deliver**: 3 (retry up to 3 times)
- **Ack Wait**: 5 minutes (time to process before redelivery)
- **Filter**: None (consumes all events)

## Subject Naming Convention

Subject names follow a hierarchical pattern that enables filtering and routing:

### Pattern

```
events.{source}.{owner}.{repo}.{eventType}
```

### Components

- **source**: Event source system (`github`, `jira`)
- **owner**: Repository/project owner
- **repo**: Repository/project name
- **eventType**: Normalized event type (e.g., `issue.opened`, `pull_request.closed`)

### Examples

#### GitHub Events

```
events.github.apicurio.apicurio-registry.issue.opened
events.github.apicurio.apicurio-registry.issue.labeled
events.github.apicurio.apicurio-registry.pull_request.opened
events.github.apicurio.apicurio-studio.release.published
```

#### Jira Events

```
events.jira.APICURIO.PROJECT-123.issue.created
events.jira.APICURIO.PROJECT-456.issue.updated
```

### Wildcard Subscriptions

The hierarchical naming enables powerful filtering:

```bash
# Subscribe to all events
events.>

# Subscribe to all GitHub events
events.github.>

# Subscribe to all events for a specific repo
events.github.apicurio.apicurio-registry.>

# Subscribe to all issue events across all sources
events.*.*.*.issue.*
```

## Message Format

### NATS Message Wrapper

All events published to NATS are wrapped in a standardized envelope:

```json
{
  "schema_version": "1.0.0",
  "schema_id": "event.schema.json",
  "source": "github",
  "timestamp": "2026-02-23T15:00:00Z",
  "event": {
    "id": "12345",
    "type": "issue.opened",
    "repository": "apicurio/apicurio-registry",
    "repositoryOwner": "apicurio",
    "repositoryName": "apicurio-registry",
    "actor": "johndoe",
    "createdAt": "2026-02-23T15:00:00Z",
    "issue": {
      "number": 123,
      "title": "Bug in API",
      "state": "open",
      "labels": ["bug", "api"],
      "author": "johndoe",
      "url": "https://github.com/apicurio/apicurio-registry/issues/123"
    }
  }
}
```

### Fields

- **schema_version**: Message format version (for compatibility)
- **schema_id**: JSON Schema identifier for validation
- **source**: Event source system
- **timestamp**: Message publish timestamp
- **event**: The normalized event object (see Event schema)

## Delivery Semantics

### At-Least-Once Delivery

NATS JetStream provides **at-least-once** delivery guarantees:

- Messages are persisted to disk before acknowledgment
- Unacknowledged messages are redelivered after `ack_wait` timeout
- Messages are retried up to `max_deliver` times
- Consumers must explicitly acknowledge successful processing

### Idempotency

Event handlers must be **idempotent** to handle duplicate deliveries:

- GitHub poller deduplicates before publishing
- Event handler can process same event multiple times safely
- Actions should be designed to be idempotent

## Running NATS Locally

### Start NATS Server

```bash
docker-compose -f docker-compose.nats.yml up -d
```

### Initialize Stream

```bash
./scripts/setup-nats-stream.sh
```

### Monitor NATS

Access the monitoring interface at: http://localhost:8222

### CLI Commands

```bash
# View stream info
nats stream info AXIOM_EVENTS

# View consumer info
nats consumer info AXIOM_EVENTS axiom-event-handler

# Subscribe to events (for debugging)
nats sub "events.>"

# Publish a test event (for debugging)
nats pub events.github.test.test.test.opened '{"test": true}'

# View stream messages
nats stream view AXIOM_EVENTS
```

## Production Considerations

### High Availability

For production deployments:

- Run NATS cluster with 3+ replicas
- Set `replicas: 3` in stream configuration
- Use clustered NATS URLs: `nats://nats1:4222,nats://nats2:4222,nats://nats3:4222`

### Monitoring

Monitor these metrics:

- **Message rate**: Events/second published and consumed
- **Consumer lag**: Messages waiting in stream
- **Ack rate**: Acknowledgment success rate
- **Redelivery rate**: Messages being retried

### Scaling

- **Pollers**: Run one instance per source (avoid duplicate polling)
- **Event Handlers**: Scale horizontally with multiple instances
- **NATS**: Scale cluster with odd number of replicas (3, 5, 7)

## Troubleshooting

### Consumer Not Receiving Messages

```bash
# Check stream has messages
nats stream info AXIOM_EVENTS

# Check consumer configuration
nats consumer info AXIOM_EVENTS axiom-event-handler

# Check for pending messages
nats consumer next AXIOM_EVENTS axiom-event-handler
```

### Messages Not Being Acknowledged

- Check `ack_wait` timeout (default: 5 minutes)
- Check handler logs for processing errors
- Verify handler is calling `msg.ack()` after processing

### Stream Full

- Increase `max-msgs-per-subject`
- Reduce `max-age` to expire old messages faster
- Ensure consumers are acknowledging messages

## References

- [NATS JetStream Documentation](https://docs.nats.io/nats-concepts/jetstream)
- [NATS CLI Documentation](https://docs.nats.io/using-nats/nats-tools/nats_cli)
- [Apicurio Axiom Event Schema](../packages/common/src/schemas/event.schema.json)
