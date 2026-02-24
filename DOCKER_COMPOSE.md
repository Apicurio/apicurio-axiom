# Docker Compose Quick Start Guide

This guide explains how to run the complete Apicurio Axiom system using Docker Compose with all 4 components:
- NATS JetStream (message broker)
- GitHub Poller
- Jira Poller
- Event Handler

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- GitHub Personal Access Token
- Jira API credentials
- Anthropic API key (for AI agent actions)

## Quick Start

### 1. Set Up Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```bash
# GitHub token (required for GitHub poller and event handler)
GITHUB_TOKEN=ghp_your_token_here

# Jira credentials (required for Jira poller)
JIRA_USERNAME=your.email@example.com
JIRA_API_TOKEN=your_jira_token_here

# Anthropic API key (required for AI agent actions)
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

**Security Note**: Never commit `.env` to version control!

### 2. Configure Components

Each component requires a `config.yaml` file. Copy the examples:

```bash
# GitHub Poller
cp packages/github-poller/config.example.yaml packages/github-poller/config.yaml

# Jira Poller
cp packages/jira-poller/config.example.yaml packages/jira-poller/config.yaml

# Event Handler
cp packages/event-handler/config.example.yaml packages/event-handler/config.yaml
```

Edit each `config.yaml` to configure:

**GitHub Poller** (`packages/github-poller/config.yaml`):
```yaml
github:
  token: ${GITHUB_TOKEN}
  pollInterval: 60  # Seconds

nats:
  url: nats://nats:4222

repositories:
  - apicurio/apicurio-registry  # Add your repositories
  - apicurio/apicurio-studio

logging:
  level: info
  prettyPrint: false  # Set to false for production
```

**Jira Poller** (`packages/jira-poller/config.yaml`):
```yaml
jira:
  url: https://issues.redhat.com  # Your Jira instance
  username: ${JIRA_USERNAME}
  apiToken: ${JIRA_API_TOKEN}
  pollInterval: 120  # Seconds

nats:
  url: nats://nats:4222

projects:
  - APICURIO  # Add your Jira projects (uppercase)
  - APICURIO_REGISTRY

logging:
  level: info
  prettyPrint: false
```

**Event Handler** (`packages/event-handler/config.yaml`):
```yaml
nats:
  url: nats://nats:4222
  consumerDurable: axiom-event-handler
  filterSubject: events.>

github:
  token: ${GITHUB_TOKEN}

eventMappings:
  - event: issue.opened
    filters:
      - type: repository
        repositories: [apicurio/apicurio-registry]
    actions: [label-issue]

actions:
  label-issue:
    type: ai-agent
    prompt: label-issue
    tools: [github-*]

logging:
  level: info
  prettyPrint: false
```

### 3. Build and Start All Services

Build all Docker images and start the system:

```bash
docker-compose up --build -d
```

This will:
1. Start NATS JetStream
2. Initialize the AXIOM_EVENTS stream and consumer
3. Start GitHub Poller
4. Start Jira Poller
5. Start Event Handler

### 4. Verify Everything is Running

Check service status:

```bash
docker-compose ps
```

You should see 5 services running:
- `axiom-nats` (healthy)
- `axiom-nats-setup` (exited with code 0)
- `axiom-github-poller` (up)
- `axiom-jira-poller` (up)
- `axiom-event-handler` (up)

### 5. Monitor Logs

View logs from all services:

```bash
docker-compose logs -f
```

View logs from a specific service:

```bash
# GitHub poller logs
docker-compose logs -f github-poller

# Jira poller logs
docker-compose logs -f jira-poller

# Event handler logs
docker-compose logs -f event-handler

# NATS logs
docker-compose logs -f nats
```

### 6. Verify NATS Stream

Use the NATS CLI to check the stream:

```bash
# Check stream info
docker run --rm --network axiom-network natsio/nats-box:latest \
  nats --server=nats:4222 stream info AXIOM_EVENTS

# Monitor messages in real-time
docker run --rm --network axiom-network natsio/nats-box:latest \
  nats --server=nats:4222 sub "events.>"
```

## Architecture Overview

```
┌──────────┐       ┌──────────┐
│  GitHub  │       │   Jira   │
│   API    │       │   API    │
└────┬─────┘       └────┬─────┘
     │                  │
     ▼                  ▼
┌─────────────┐  ┌─────────────┐
│   GitHub    │  │    Jira     │
│   Poller    │  │   Poller    │
└──────┬──────┘  └──────┬──────┘
       │                │
       └────────┬───────┘
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

## Service Details

### NATS JetStream

- **Ports**: 4222 (client), 8222 (monitoring)
- **Monitoring UI**: http://localhost:8222
- **Data**: Persisted in `nats-data` volume
- **Health Check**: HTTP endpoint on port 8222

### GitHub Poller

- **Function**: Polls GitHub API for events
- **Poll Interval**: Configurable (default: 60 seconds)
- **State**: Stored in `github-state` volume
- **Events Log**: Stored in `github-events` volume
- **NATS Subject**: `events.github.{owner}.{repo}.{eventType}`

### Jira Poller

- **Function**: Polls Jira API for issue updates
- **Poll Interval**: Configurable (default: 120 seconds)
- **State**: Stored in `jira-state` volume
- **Events Log**: Stored in `jira-events` volume
- **NATS Subject**: `events.jira.{project}.{issueKey}.{eventType}`

### Event Handler

- **Function**: Consumes events from NATS and executes actions
- **Logs**: Stored in `handler-logs` volume
- **State**: Stored in `handler-state` volume
- **Work Directory**: Stored in `handler-work` volume
- **Job Queue**: Stored in `handler-queue` volume

## Common Operations

### Start Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d github-poller
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop specific service
docker-compose stop github-poller
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart github-poller
```

### Rebuild After Code Changes

```bash
# Rebuild all services
docker-compose up --build -d

# Rebuild specific service
docker-compose up --build -d github-poller
```

### View Logs

```bash
# All services (follow mode)
docker-compose logs -f

# Specific service
docker-compose logs -f github-poller

# Last 100 lines
docker-compose logs --tail=100

# Since specific time
docker-compose logs --since 10m
```

### Clean Up

```bash
# Stop and remove containers
docker-compose down

# Stop, remove containers, and remove volumes (WARNING: deletes all data!)
docker-compose down -v

# Remove all images as well
docker-compose down --rmi all
```

## Data Persistence

All data is stored in Docker volumes:

| Volume | Purpose | Location |
|--------|---------|----------|
| `nats-data` | NATS JetStream data | `/data` in nats container |
| `github-state` | GitHub poller deduplication | `/data/state` in github-poller |
| `github-events` | GitHub raw event logs | `/data/events` in github-poller |
| `jira-state` | Jira poller deduplication | `/data/state` in jira-poller |
| `jira-events` | Jira raw event logs | `/data/events` in jira-poller |
| `handler-logs` | Event handler logs | `/data/logs` in event-handler |
| `handler-state` | Event handler state | `/data/state` in event-handler |
| `handler-work` | Cloned repositories | `/data/work` in event-handler |
| `handler-queue` | Job queue database | `/data/queue` in event-handler |

### Backing Up Volumes

```bash
# List all volumes
docker volume ls | grep axiom

# Back up a volume
docker run --rm -v axiom_github-state:/data -v $(pwd):/backup alpine \
  tar czf /backup/github-state-backup.tar.gz -C /data .

# Restore a volume
docker run --rm -v axiom_github-state:/data -v $(pwd):/backup alpine \
  tar xzf /backup/github-state-backup.tar.gz -C /data
```

### Inspecting Volume Data

```bash
# Access volume data
docker run --rm -it -v axiom_github-state:/data alpine sh
cd /data
ls -la
```

## Troubleshooting

### Services Won't Start

1. **Check logs**:
   ```bash
   docker-compose logs
   ```

2. **Verify environment variables**:
   ```bash
   docker-compose config
   ```

3. **Check NATS health**:
   ```bash
   docker-compose ps nats
   curl http://localhost:8222/healthz
   ```

### No Events Being Processed

1. **Check poller logs**:
   ```bash
   docker-compose logs github-poller | grep -i error
   docker-compose logs jira-poller | grep -i error
   ```

2. **Verify NATS stream**:
   ```bash
   docker run --rm --network axiom-network natsio/nats-box:latest \
     nats --server=nats:4222 stream info AXIOM_EVENTS
   ```

3. **Monitor NATS messages**:
   ```bash
   docker run --rm --network axiom-network natsio/nats-box:latest \
     nats --server=nats:4222 sub "events.>"
   ```

### Event Handler Not Executing Actions

1. **Check event handler logs**:
   ```bash
   docker-compose logs event-handler | grep -i error
   ```

2. **Verify consumer is receiving messages**:
   ```bash
   docker run --rm --network axiom-network natsio/nats-box:latest \
     nats --server=nats:4222 consumer info AXIOM_EVENTS axiom-event-handler
   ```

3. **Check configuration**:
   - Verify eventMappings are correct
   - Verify filters match your events
   - Check GitHub token permissions

### High Disk Usage

1. **Check volume sizes**:
   ```bash
   docker system df -v
   ```

2. **Clean old event logs** (manual cleanup needed):
   ```bash
   docker run --rm -v axiom_github-events:/data alpine \
     find /data -type f -mtime +7 -delete
   ```

3. **Limit work directory size** in event-handler config:
   ```yaml
   workDirectory:
     maxSizeGB: 50  # Adjust as needed
   ```

### Permission Issues

If you encounter permission issues with volumes:

```bash
# Fix ownership (run as root)
docker run --rm -v axiom_github-state:/data alpine chown -R 1001:1001 /data
```

## Monitoring and Observability

### NATS Monitoring

Access NATS monitoring dashboard:
```bash
open http://localhost:8222
```

Key endpoints:
- `/varz` - General server information
- `/connz` - Connection information
- `/jsz` - JetStream information
- `/healthz` - Health check

### Application Metrics (Future)

Prometheus metrics will be added to expose:
- Event processing rates
- Error rates
- API call latencies
- Queue depths

## Development Workflow

### Making Changes to Code

1. **Edit code** in your local repository

2. **Rebuild affected service**:
   ```bash
   docker-compose up --build -d github-poller
   ```

3. **View logs** to verify changes:
   ```bash
   docker-compose logs -f github-poller
   ```

### Testing Locally

You can run individual services locally (outside Docker) for development:

```bash
# Terminal 1: Start NATS
docker-compose up nats nats-setup

# Terminal 2: Run GitHub poller locally
cd packages/github-poller
npm run dev

# Terminal 3: Run event handler locally
cd packages/event-handler
npm run dev
```

## Production Considerations

1. **Resource Limits**: Add resource limits to prevent runaway containers:
   ```yaml
   services:
     github-poller:
       deploy:
         resources:
           limits:
             cpus: '0.5'
             memory: 512M
   ```

2. **Logging**: Use a centralized logging solution (ELK, Loki, etc.)

3. **Monitoring**: Add Prometheus + Grafana for metrics

4. **Secrets Management**: Use Docker secrets or external secret management

5. **High Availability**: Run multiple event-handler instances for scaling

6. **Backups**: Regularly back up volumes, especially state databases

## Additional Resources

- [NATS Documentation](https://docs.nats.io/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Project Architecture Documentation](./docs/architecture/nats-architecture.md)
- Individual component READMEs:
  - [GitHub Poller](./packages/github-poller/README.md)
  - [Jira Poller](./packages/jira-poller/README.md)
  - [Event Handler](./packages/event-handler/README.md)
