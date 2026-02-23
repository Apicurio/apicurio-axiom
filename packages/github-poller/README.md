# @axiom/github-poller

GitHub event poller for Apicurio Axiom - polls GitHub API for events and publishes them to NATS JetStream.

## Overview

This component polls GitHub repositories for events at regular intervals and publishes normalized events to NATS
JetStream. It handles:

- **Event Polling**: Fetches events from GitHub REST API
- **Event Normalization**: Converts GitHub events to internal Event format
- **Event Enrichment**: Fetches additional data (e.g., full PR details)
- **Event Validation**: Validates events against JSON Schema
- **Deduplication**: Tracks processed events to avoid duplicates
- **NATS Publishing**: Publishes validated events to NATS with proper subject routing

## Prerequisites

- Node.js >= 20.0.0
- GitHub personal access token
- Running NATS JetStream server
- AXIOM_EVENTS stream configured (see `../../scripts/setup-nats-stream.sh`)

## Installation

From the workspace root:

```bash
npm install
```

## Configuration

Copy the example configuration:

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml` with your settings:

```yaml
github:
  token: ${GITHUB_TOKEN}  # Required
  pollInterval: 60        # Seconds

nats:
  url: nats://localhost:4222  # Required

repositories:
  - owner/repo  # At least one required

logging:
  level: info
```

## Running Locally

### Using npm

```bash
# From workspace root
npm run dev --workspace=@axiom/github-poller

# Or from this directory
npm run dev
```

### Using Docker

```bash
# Build image
docker build -t axiom-github-poller -f Dockerfile ../..

# Run container
docker run --rm \
  -e GITHUB_TOKEN=your_token \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/data:/data \
  axiom-github-poller
```

## How It Works

### Polling Loop

1. **Fetch Events**: Calls GitHub REST API `/repos/{owner}/{repo}/events` (up to 100 events)
2. **Filter**: Skips events before app start time (configurable)
3. **Deduplicate**: Checks if event was already processed (SQLite state)
4. **Normalize**: Converts GitHub event to internal Event format
5. **Enrich**: Fetches additional data if needed (e.g., full PR details)
6. **Validate**: Validates against JSON Schema
7. **Publish**: Publishes to NATS with subject `events.github.{owner}.{repo}.{eventType}`
8. **Mark Processed**: Records event ID in SQLite to prevent reprocessing

### Event Types Supported

- **Issues**: `issue.opened`, `issue.closed`, `issue.labeled`, etc.
- **Pull Requests**: `pull_request.opened`, `pull_request.closed`, etc.
- **Comments**: `issue_comment.created`, etc.
- **Reviews**: `pull_request_review.submitted`, etc.
- **Releases**: `release.published`, etc.
- **Discussions**: `discussion.created`, etc.
- **Push**: `push`
- **Fork**: `fork`
- **Create**: `create`

### NATS Subject Pattern

Events are published to subjects following this pattern:

```
events.github.{owner}.{repo}.{eventType}
```

Examples:
- `events.github.apicurio.apicurio-registry.issue-opened`
- `events.github.apicurio.apicurio-registry.pull_request-opened`

Note: Dots in event types are replaced with hyphens to avoid NATS subject hierarchy issues.

### State Management

Event deduplication state is stored in SQLite at `{state.basePath}/events.db`:

- **Table**: `processed_events`
- **Schema**: `event_id (PK), repository, event_type, processed_at`
- **Cleanup**: Events older than 30 days are automatically removed

### Event Logging

Raw GitHub events are logged to disk for audit/debugging:

- **Path**: `{logging.eventsPath}/{owner}/{repo}/`
- **Format**: `{timestamp}_{eventId}_{eventType}.json`

## Deployment

### Docker Compose

See `../../docker-compose.nats.yml` for example deployment with NATS.

### Kubernetes

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: axiom-github-poller
spec:
  replicas: 1  # Only one instance to avoid duplicate polling
  selector:
    matchLabels:
      app: axiom-github-poller
  template:
    metadata:
      labels:
        app: axiom-github-poller
    spec:
      containers:
      - name: poller
        image: axiom-github-poller:latest
        env:
        - name: GITHUB_TOKEN
          valueFrom:
            secretKeyRef:
              name: github-credentials
              key: token
        volumeMounts:
        - name: config
          mountPath: /app/config.yaml
          subPath: config.yaml
        - name: data
          mountPath: /data
      volumes:
      - name: config
        configMap:
          name: github-poller-config
      - name: data
        persistentVolumeClaim:
          claimName: github-poller-data
```

## Monitoring

### Logs

Structured JSON logs are written to stdout. In development, use `prettyPrint: true` for readable output.

### Health Checks

Monitor these indicators:

- **Poll Success Rate**: Check logs for "Error polling repository"
- **Publish Success Rate**: Check logs for "Failed to publish event to NATS"
- **NATS Connection**: Monitor "NATS connection status" logs
- **Event Processing**: Monitor "Event published to NATS" logs

### Metrics (Future)

Prometheus metrics will be added:

- `github_events_polled_total`: Total events polled
- `github_events_published_total`: Total events published
- `github_api_errors_total`: Total GitHub API errors
- `nats_publish_errors_total`: Total NATS publish errors

## Troubleshooting

### No Events Being Processed

- Check `ignoreEventsBeforeStart` setting (events before app start are skipped by default)
- Verify GitHub token has access to repositories
- Check GitHub API rate limits
- Review logs for errors

### Events Not Appearing in NATS

- Verify NATS connection (check logs for "Connected to NATS")
- Verify AXIOM_EVENTS stream exists (`nats stream info AXIOM_EVENTS`)
- Check for publish errors in logs
- Verify subject pattern matches consumer filter

### Duplicate Events

- Check state database for corruption
- Verify only one poller instance is running
- Check for clock skew issues

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test  # (tests to be added)
```

### Linting

```bash
npm run lint  # (from workspace root)
```

## License

Apache-2.0
