# @axiom/event-handler

Event handler for Apicurio Axiom - consumes events from NATS JetStream and executes configured actions.

## Overview

This component subscribes to events from NATS JetStream, matches them against configured event mappings, and
executes actions such as shell commands, JavaScript code, or AI-powered agents. It handles:

- **Event Consumption**: Subscribes to NATS with durable consumer
- **Event Matching**: Matches events against configured rules with flexible filters
- **Action Execution**: Executes shell, JavaScript, or AI agent actions
- **Job Queue**: Persistent queue with concurrency control
- **Work Directory Management**: Manages repository clones and cleanup
- **Agent Runtime**: Full AI agent system with tools and prompts

## Prerequisites

- Node.js >= 20.0.0
- Running NATS JetStream server with AXIOM_EVENTS stream configured
- GitHub personal access token (for actions that interact with GitHub)
- Google Cloud Vertex AI project (for AI agent actions)

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

Edit `config.yaml` with your settings. Key sections:

### NATS Configuration

```yaml
nats:
  url: nats://localhost:4222           # Required
  consumerDurable: axiom-event-handler # Required
  filterSubject: events.>              # Optional (default: events.>)
```

### Event Mappings

Define which events trigger which actions:

```yaml
eventMappings:
  - event: issue.opened
    actions:
      - label-issue

  - event: pull_request.opened
    filters:
      - draft: false
    actions:
      - analyze-pr
```

### Actions

Define what each action does:

```yaml
actions:
  label-issue:
    type: ai-agent
    prompt: label-issue
    tools:
      - github-*

  analyze-pr:
    type: shell
    command: echo "PR #${EVENT_PR_NUMBER} opened"
```

## Running Locally

### Using npm

```bash
# From workspace root
npm run dev --workspace=@axiom/event-handler

# Or from this directory
npm run dev
```

### Using Docker

```bash
# Build image
docker build -t axiom-event-handler -f Dockerfile ../..

# Run container
docker run --rm \
  -e GITHUB_TOKEN=your_token \
  -e VERTEX_PROJECT_ID=your_project \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/prompts:/app/prompts \
  -v $(pwd)/actions:/app/actions \
  -v $(pwd)/data:/data \
  axiom-event-handler
```

## How It Works

### Event Flow

1. **Receive**: NATS consumer receives event message from JetStream
2. **Transform**: Unwraps NATS message to extract Event object
3. **Match**: EventProcessor matches event against configured mappings
4. **Filter**: Applies filters to determine if action should execute
5. **Enqueue**: ActionExecutor enqueues action in job queue
6. **Execute**: JobQueue processes jobs with concurrency control
7. **Acknowledge**: Message acknowledged after successful processing

### Event Matching

Events are matched using:

- **Event type**: Exact match or wildcard (e.g., `issue.*`, `*`)
- **Repository**: Optional repository filter
- **Filters**: Path-based filters with various matchers

Example filters:

```yaml
# Legacy syntax
- label: bug
- state: open
- draft: false

# Path-based syntax
- path: payload.label.name
  matcher: equals
  value: enhancement

- path: issue.labels
  matcher: contains
  value: security
```

### Action Types

1. **Shell Actions**: Execute shell commands

```yaml
shell-example:
  type: shell
  command: |
    echo "Event: ${EVENT_TYPE}"
    echo "Repo: ${EVENT_REPOSITORY}"
```

2. **JavaScript Actions**: Run JavaScript code

```yaml
js-example:
  type: javascript
  script: my-action  # Points to actions/my-action.js
```

3. **AI Agent Actions**: LLM-powered agents with tools

```yaml
ai-example:
  type: ai-agent
  prompt: analyze-issue
  tools:
    - list_files
    - read_file
    - github-*
```

### Job Queue

- **Persistent**: SQLite database survives restarts
- **Concurrent**: Configurable parallelism (default: 3)
- **Recovery**: Failed jobs can be retried
- **Locking**: Work directory locks prevent concurrent access

### Work Directory Management

- **Repository Cloning**: Shallow clones for each job
- **Lock Management**: Prevents concurrent operations on same repo
- **Cleanup**: Monitors disk usage and cleans up old work directories
- **Reuse**: Reuses existing clones when possible

## AI Agent System

The event handler includes a full AI agent runtime powered by Claude via Vertex AI.

### Tools Available

- **Repository**: `list_files`, `read_file`, `search_files`, `write_file`
- **Git**: `read_git_log`, `read_git_diff`, `read_git_show`
- **GitHub**: `github_read_issue`, `github_write_comment`, `github_update_labels`
- **Web**: `web_fetch`, `web_search`

### Prompts

Prompts are Handlebars templates in the `prompts/` directory:

```handlebars
{{!-- prompts/analyze-issue.hbs --}}
Analyze this issue and suggest labels:

Issue: {{event.issue.title}}
Description: {{event.issue.body}}

Repository: {{event.repository}}
```

## Deployment

### Docker Compose

See root `docker-compose.nats.yml` for example with NATS.

### Kubernetes

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: axiom-event-handler
spec:
  replicas: 3  # Scale horizontally
  selector:
    matchLabels:
      app: axiom-event-handler
  template:
    spec:
      containers:
      - name: handler
        image: axiom-event-handler:latest
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
        - name: prompts
          mountPath: /app/prompts
        - name: data
          mountPath: /data
```

## Monitoring

### Logs

Structured JSON logs (or pretty-printed in development):

```json
{
  "level": "info",
  "time": "2026-02-23T15:00:00.000Z",
  "msg": "Received event from NATS",
  "eventId": "12345",
  "eventType": "issue.opened",
  "repository": "owner/repo"
}
```

### Health Checks

Monitor these indicators:

- **NATS Connection**: Check for "Connected to NATS" logs
- **Message Processing**: Monitor "Event processed successfully" logs
- **Queue Depth**: Check job queue for pending jobs
- **Work Directory**: Monitor disk usage alerts

## Troubleshooting

### No Events Being Processed

- Verify NATS connection (check logs for "Connected to NATS")
- Verify consumer exists: `nats consumer info AXIOM_EVENTS axiom-event-handler`
- Check subject filter matches published events
- Verify event mappings are configured

### Actions Not Executing

- Check event mappings match event types
- Verify filters aren't too restrictive
- Check action definitions exist
- Review job queue for failed jobs

### High Memory Usage

- Reduce `queue.maxConcurrent` to limit parallel jobs
- Enable work directory cleanup
- Check for memory leaks in custom JavaScript actions

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

## Migration from Monolith

The event handler is the refactored monolithic Axiom application with:

- **Removed**: GitHub polling logic
- **Added**: NATS consumer
- **Preserved**: All event processing, action execution, agent runtime

Configuration changes:

- Add `nats` section
- Remove `github.pollInterval`
- Keep all `eventMappings`, `actions`, and other settings

## License

Apache-2.0
