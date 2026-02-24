# @axiom/jira-poller

Jira issue poller for Apicurio Axiom - polls Jira API for issue updates and publishes them to NATS JetStream.

## Overview

This component polls Jira projects for recently updated issues at regular intervals and publishes normalized events
to NATS JetStream. It handles:

- **Issue Polling**: Fetches recently updated issues from Jira REST API
- **Event Normalization**: Converts Jira issues to internal Event format
- **Event Validation**: Validates events against JSON Schema
- **Deduplication**: Tracks processed issues to avoid duplicates
- **NATS Publishing**: Publishes validated events to NATS with proper subject routing

## Prerequisites

- Node.js >= 20.0.0
- Jira API credentials (username + API token)
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
jira:
  url: https://issues.redhat.com  # Required
  username: ${JIRA_USERNAME}      # Required
  apiToken: ${JIRA_API_TOKEN}     # Required
  pollInterval: 120               # Seconds

nats:
  url: nats://localhost:4222      # Required

projects:
  - APICURIO                      # At least one required

logging:
  level: info
```

### Generating Jira API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the token and set it as `JIRA_API_TOKEN` environment variable

## Running Locally

### Using npm

```bash
# From workspace root
npm run dev --workspace=@axiom/jira-poller

# Or from this directory
npm run dev
```

### Using Docker

```bash
# Build image
docker build -t axiom-jira-poller -f Dockerfile ../..

# Run container
docker run --rm \
  -e JIRA_USERNAME=your_username \
  -e JIRA_API_TOKEN=your_token \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/data:/data \
  axiom-jira-poller
```

## How It Works

### Polling Loop

1. **Fetch Issues**: Calls Jira REST API `/rest/api/3/search` with JQL query
2. **Filter**: Only processes issues updated since last poll
3. **Deduplicate**: Checks if issue was already processed (SQLite state)
4. **Normalize**: Converts Jira issue to internal Event format
5. **Validate**: Validates against JSON Schema
6. **Publish**: Publishes to NATS with subject `events.jira.{project}.{issueKey}.{eventType}`
7. **Log Issue**: Saves raw Jira issue JSON to disk for auditing
8. **Mark Processed**: Records issue update timestamp in SQLite to prevent reprocessing

### Event Types Supported

The poller determines event types based on Jira status categories:

- **issue.created**: Status category is "new"
- **issue.updated**: Status category is "indeterminate" (in progress)
- **issue.closed**: Status category is "done"

### NATS Subject Pattern

Events are published to subjects following this pattern:

```
events.jira.{project}.{issueKey}.{eventType}
```

Examples:
- `events.jira.APICURIO.APICURIO-123.issue-created`
- `events.jira.APICURIO.APICURIO-456.issue-closed`

Note: Dots in event types are replaced with hyphens to avoid NATS subject hierarchy issues.

### Project Key Format

Project keys must be uppercase alphanumeric with underscores (e.g., `APICURIO`, `APICURIO_REGISTRY`). This is
validated at startup.

### State Management

Issue deduplication state is stored in SQLite at `{state.basePath}/events.db`:

- **Table**: `processed_events`
- **Schema**: `event_id (PK), repository, event_type, processed_at`
- **Event ID Format**: `jira:{issueKey}:{updated_timestamp}`
- **Cleanup**: Events older than 30 days are automatically removed

### Issue Logging

Raw Jira issues are logged to disk for audit/debugging:

- **Path**: `{logging.eventsPath}/{project}/`
- **Format**: `{timestamp}_{issueKey}.json`
- **Example**: `2025-01-15T10-30-45-123Z_APICURIO-123.json`

## Deployment

### Docker Compose

See `../../docker-compose.nats.yml` for example deployment with NATS.

### Kubernetes

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: axiom-jira-poller
spec:
  replicas: 1  # Only one instance to avoid duplicate polling
  selector:
    matchLabels:
      app: axiom-jira-poller
  template:
    metadata:
      labels:
        app: axiom-jira-poller
    spec:
      containers:
      - name: poller
        image: axiom-jira-poller:latest
        env:
        - name: JIRA_USERNAME
          valueFrom:
            secretKeyRef:
              name: jira-credentials
              key: username
        - name: JIRA_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: jira-credentials
              key: api-token
        volumeMounts:
        - name: config
          mountPath: /app/config.yaml
          subPath: config.yaml
        - name: data
          mountPath: /data
      volumes:
      - name: config
        configMap:
          name: jira-poller-config
      - name: data
        persistentVolumeClaim:
          claimName: jira-poller-data
```

## Monitoring

### Logs

Structured JSON logs are written to stdout. In development, use `prettyPrint: true` for readable output.

### Health Checks

Monitor these indicators:

- **Poll Success Rate**: Check logs for "Error polling project"
- **Publish Success Rate**: Check logs for "Failed to publish event to NATS"
- **NATS Connection**: Monitor "NATS connection status" logs
- **Issue Processing**: Monitor "Event published to NATS" logs

### Metrics (Future)

Prometheus metrics will be added:

- `jira_issues_polled_total`: Total issues polled
- `jira_events_published_total`: Total events published
- `jira_api_errors_total`: Total Jira API errors
- `nats_publish_errors_total`: Total NATS publish errors

## Troubleshooting

### No Issues Being Processed

- Verify Jira credentials are correct
- Check project keys match actual Jira projects
- Verify projects have recent updates
- Review logs for API errors
- Check Jira API rate limits

### Issues Not Appearing in NATS

- Verify NATS connection (check logs for "Connected to NATS")
- Verify AXIOM_EVENTS stream exists (`nats stream info AXIOM_EVENTS`)
- Check for publish errors in logs
- Verify subject pattern matches consumer filter

### Authentication Errors

- Verify username is correct (email for Atlassian Cloud)
- Regenerate API token if expired
- Check account has access to configured projects

### Duplicate Events

- Check state database for corruption
- Verify only one poller instance is running
- Check for clock skew issues

### Invalid Project Key Errors

- Ensure project keys are uppercase (e.g., `APICURIO`, not `apicurio`)
- Use underscores for multi-word projects (e.g., `APICURIO_REGISTRY`)
- Verify project exists in Jira

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
