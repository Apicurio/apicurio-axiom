# Apicurio Axiom

Event-driven automation system for GitHub and Jira using NATS JetStream. Axiom provides a scalable, distributed
architecture for monitoring events from multiple sources and executing custom actions based on configurable rules.

## Architecture

Axiom uses a **NATS-based event-driven architecture** with four main components:

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
              ▼
       ┌─────────────┐
       │    NATS     │
       │ JetStream   │
       └──────┬──────┘
              │
              ▼
       ┌─────────────┐
       │   Event     │
       │  Handler    │
       └─────────────┘
```

### Components

1. **[GitHub Poller](./packages/github-poller/)** - Polls GitHub API for events and publishes to NATS
2. **[Jira Poller](./packages/jira-poller/)** - Polls Jira API for issue updates and publishes to NATS
3. **NATS JetStream** - Message broker providing reliable event delivery
4. **[Event Handler](./packages/event-handler/)** - Consumes events from NATS and executes configured actions

### Benefits of Event-Driven Architecture

- ✅ **Scalability**: Components scale independently based on load
- ✅ **Reliability**: NATS JetStream provides at-least-once delivery with persistence
- ✅ **Flexibility**: Easy to add new event sources (webhooks, other APIs, etc.)
- ✅ **Separation of Concerns**: Event ingestion decoupled from event processing
- ✅ **Independent Lifecycles**: Deploy and update components separately

## Features

### Event Sources

- **GitHub Events**: Issues, Pull Requests, Comments, Reviews, Releases, Discussions, Push, Fork, Create
- **Jira Events**: Issue created, updated, closed (based on status category)

### Event Processing

- **Flexible Event Mapping**: Configure event-to-action mappings with powerful filtering
- **Event Deduplication**: SQLite-based state management prevents duplicate processing
- **Event Validation**: JSON Schema validation for event integrity

### Action Types

- **Shell Actions**: Execute shell scripts with access to event context
- **JavaScript Actions**: Execute JavaScript code with full Node.js runtime
- **AI Agent Actions**: Claude AI-powered actions via Anthropic API with comprehensive tool system:
  - Repository operations (read, write, search)
  - Git operations (diff, log, status, branch)
  - GitHub operations (issues, PRs, comments, labels)
  - Web operations (search, fetch)

### Infrastructure

- **Persistent Job Queue**: SQLite-based queue with configurable concurrency
- **Work Directory Management**: Automatic repository cloning, size monitoring, and cleanup
- **Structured Logging**: JSON-based logging with correlation IDs for event tracing
- **Automatic Cleanup**: Configurable retention for events, logs, and work directories

## Quick Start

### Docker Compose (Recommended)

The fastest way to get started is using Docker Compose, which runs all components together:

1. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Configure components**:
   ```bash
   cp packages/github-poller/config.example.yaml packages/github-poller/config.yaml
   cp packages/jira-poller/config.example.yaml packages/jira-poller/config.yaml
   cp packages/event-handler/config.example.yaml packages/event-handler/config.yaml
   # Edit each config.yaml
   ```

3. **Start all services**:
   ```bash
   docker-compose up -d
   ```

4. **View logs**:
   ```bash
   docker-compose logs -f
   ```

**Complete Guide**: See [DOCKER_COMPOSE.md](./DOCKER_COMPOSE.md) for comprehensive Docker Compose documentation.

### Development Setup

For local development with Node.js:

1. **Prerequisites**:
   - Node.js >= 20.0.0
   - Running NATS JetStream server
   - GitHub Personal Access Token
   - Jira API credentials (optional)
   - Anthropic API key (for AI actions)

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build all packages**:
   ```bash
   npm run build
   ```

4. **Start NATS locally**:
   ```bash
   # Using Docker
   docker-compose up nats nats-setup -d

   # Or install NATS server: https://docs.nats.io/running-a-nats-service/introduction/installation
   ```

5. **Run individual components**:
   ```bash
   # Terminal 1: GitHub Poller
   npm run dev:github-poller

   # Terminal 2: Jira Poller (optional)
   npm run dev:jira-poller

   # Terminal 3: Event Handler
   npm run dev:event-handler
   ```

## Configuration

### Environment Variables

Create a `.env` file with your credentials:

```bash
# GitHub
GITHUB_TOKEN=ghp_your_github_token_here

# Jira (optional)
JIRA_USERNAME=your.email@example.com
JIRA_API_TOKEN=your_jira_api_token_here

# AI Agent (optional)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
```

### Component Configuration

Each component has its own `config.yaml`:

- **GitHub Poller**: `packages/github-poller/config.yaml` - Configure repositories, polling interval
- **Jira Poller**: `packages/jira-poller/config.yaml` - Configure projects, polling interval
- **Event Handler**: `packages/event-handler/config.yaml` - Configure event mappings and actions

**Examples**: Each package has a `config.example.yaml` showing available options.

## Event Mappings

Configure event-to-action mappings in the Event Handler:

```yaml
eventMappings:
  # Trigger on new issues
  - event: issue.opened
    filters:
      - type: repository
        repositories: [apicurio/apicurio-registry]
      - type: label
        labels: [bug]
    actions: [analyze-bug]

  # Trigger on PR comments
  - event: issue_comment.created
    filters:
      - type: pull_request
        is_pull_request: true
    actions: [review-comment]
```

**Filter Types**:
- `repository`: Filter by repository name
- `label`: Filter by issue/PR labels
- `pull_request`: Filter for PRs only
- `author`: Filter by event author
- `file_pattern`: Filter by changed files (for PRs)

## Actions

Define custom actions in `actions/` directory:

### Shell Action

```yaml
actions:
  analyze-bug:
    type: shell
    command: ./actions/analyze_bug.sh
    environment:
      ISSUE_NUMBER: "{{event.issue.number}}"
      REPOSITORY: "{{event.repositoryName}}"
```

### JavaScript Action

```yaml
actions:
  custom-logic:
    type: javascript
    script: ./actions/custom_logic.js
```

### AI Agent Action

```yaml
actions:
  code-review:
    type: ai-agent
    prompt: code-review
    tools: [repo_read-*, github_write-add_comment]
    model: claude-opus-4
```

**AI Agent Tools**:
- `repo_read-*`: Read repository files, search code, analyze structure
- `repo_write-*`: Modify files, create directories, apply patches
- `git_read-*`: View diffs, logs, status
- `git_write-*`: Create branches
- `github_read-*`: Get issues, PRs, discussions
- `github_write-*`: Comment, label, assign, close issues/PRs
- `web_read-*`: Search the web, fetch URLs

## Project Structure

```
apicurio-axiom/
├── packages/
│   ├── common/              # Shared types and validation
│   ├── github-poller/       # GitHub event poller
│   ├── jira-poller/         # Jira issue poller
│   └── event-handler/       # Event processor and action executor
├── prompts/                 # AI agent prompt templates
├── actions/                 # Custom action scripts
├── docker-compose.yml       # Complete stack deployment
├── DOCKER_COMPOSE.md        # Docker Compose guide
└── .env.example             # Environment variable template
```

## Package Documentation

Each package has comprehensive documentation:

- **[@axiom/common](./packages/common/)** - Shared types, validation, and schemas
- **[@axiom/github-poller](./packages/github-poller/)** - GitHub polling and event publishing
- **[@axiom/jira-poller](./packages/jira-poller/)** - Jira polling and event publishing
- **[@axiom/event-handler](./packages/event-handler/)** - Event processing and action execution

## Development

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@axiom/github-poller
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Linting

```bash
# Check code
npm run lint

# Fix issues
npm run lint:fix
```

### Docker Commands

```bash
# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View logs
npm run docker:logs

# Rebuild and start
npm run docker:build
```

## Monitoring

### NATS Dashboard

Access NATS monitoring at http://localhost:8222 when running locally.

### Logs

Each component logs to stdout with structured JSON. In Docker:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f github-poller
docker-compose logs -f jira-poller
docker-compose logs -f event-handler
```

### NATS CLI

Inspect the NATS stream and messages:

```bash
# Stream info
docker run --rm --network axiom-network natsio/nats-box:latest \
  nats --server=nats:4222 stream info AXIOM_EVENTS

# Monitor messages
docker run --rm --network axiom-network natsio/nats-box:latest \
  nats --server=nats:4222 sub "events.>"
```

## Deployment

### Docker Compose

For single-server deployments, use Docker Compose:

```bash
docker-compose up -d
```

See [DOCKER_COMPOSE.md](./DOCKER_COMPOSE.md) for complete deployment guide.

### Kubernetes

For production deployments, see individual package READMEs for Kubernetes deployment examples:

- [GitHub Poller Kubernetes Deployment](./packages/github-poller/README.md#kubernetes)
- [Jira Poller Kubernetes Deployment](./packages/jira-poller/README.md#kubernetes)
- [Event Handler Kubernetes Deployment](./packages/event-handler/README.md#kubernetes)

## Migration from Monolith

If you're migrating from the previous monolithic version:

1. **Data Migration**: Event state and job queue are compatible
2. **Configuration**: Event mappings and actions use the same format
3. **Actions**: Shell, JavaScript, and AI agent actions are unchanged
4. **Prompts**: AI agent prompts are unchanged

The main differences:
- Polling logic now runs in separate `github-poller` and `jira-poller` services
- Event processing runs in `event-handler` service
- NATS handles event routing instead of direct method calls

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache-2.0 - see [LICENSE](./LICENSE) for details.

## Support

- **Documentation**: See individual package READMEs
- **Issues**: https://github.com/apicurio/apicurio-axiom/issues
- **Discussions**: https://github.com/apicurio/apicurio-axiom/discussions

## Acknowledgments

Built with:
- [NATS](https://nats.io/) - Message broker
- [Anthropic Claude](https://www.anthropic.com/) - AI agent
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API client
- [Axios](https://axios-http.com/) - Jira API client
- [Pino](https://getpino.io/) - Structured logging
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) - State persistence
