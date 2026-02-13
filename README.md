# Apicurio Axiom

A locally-running GitHub automation system that monitors GitHub events and triggers custom actions based on configurable rules. Features AI Agent integration via Google Cloud Vertex AI for intelligent automation.

## Features

- **Event Monitoring**: Monitor multiple GitHub repositories for events (issues, PRs, comments, etc.)
- **Flexible Event Mapping**: Configure event-to-action mappings with flexible filtering
- **Multiple Action Types**: Execute shell scripts, JavaScript code, or AI Agent actions
- **Persistent Job Queue**: SQLite-based queue system with configurable concurrency
- **Work Directory Management**: Automatic repository cloning, size monitoring, and cleanup
- **Structured Logging**: JSON-based logging with correlation IDs for tracing events through the system
- **Comprehensive Logging**: All actions logged to files organized by repository and event
- **AI Agent Actions**: Claude AI-powered actions via Google Cloud Vertex AI with custom tool system
- **Advanced Validation**: Validates configuration including action references, tool patterns, and repository access
- **Automatic Cleanup**: Events older than 30 days and logs older than configured retention period
- **Configurable Directories**: All storage locations (state, logs, events, work) are configurable

## Prerequisites

- Node.js 20 or higher (for native installation) OR Docker (for container deployment)
- GitHub Personal Access Token (PAT)
- SSH key configured for GitHub (Axiom clones repositories using SSH)
- Google Cloud project with Vertex AI enabled (for AI Agent actions)
- **Forked repositories**: All monitored repositories must be forked to your GitHub account (see below)

## Docker Deployment (Recommended)

Apicurio Axiom uses a **two-phase Docker deployment** that separates image building from deployment:

### For End Users (Deployment)

Use the interactive installer to deploy pre-built Docker images:

```bash
cd docker/install
sudo ./install.sh
```

The installer will:
- ✅ Pull the official `apicurio/apicurio-axiom` image from Docker Hub
- ✅ Create directory structure at `/opt/apicurio-axiom/`
- ✅ Generate SSH keys for GitHub
- ✅ Configure environment variables
- ✅ Set up systemd service for automatic startup
- ✅ Start the application

**Service Management:**
```bash
sudo systemctl status apicurio-axiom     # Check status
sudo systemctl restart apicurio-axiom    # Restart service
sudo journalctl -u apicurio-axiom -f     # View logs
```

**Documentation:** See `docker/install/README.md` for complete installation guide.

### For Developers (Building)

Build Docker images:

```bash
cd docker/build
./build.sh 1.0.0      # Build image
```

**Documentation:** See `docker/build/README.md` for build instructions.

### Why Docker?

**Benefits:**
- ✅ No Node.js version conflicts
- ✅ Consistent environment across deployments
- ✅ Easy updates (pull new image version)
- ✅ Production-ready with systemd integration
- ✅ Automatic startup on boot
- ✅ Centralized logging via journald

**Official Images:**
- Docker Hub: `apicurio/apicurio-axiom:latest`
- Versioned: `apicurio/apicurio-axiom:1.0.0`

**Learn more:** See `docker/README.md` for overview of both phases.

---

## Installation (Native)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/apicurio-axiom.git
   cd apicurio-axiom
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure SSH for GitHub**

   Axiom clones repositories using SSH. Ensure you have an SSH key configured:

   ```bash
   # Generate SSH key if you don't have one
   ssh-keygen -t ed25519 -C "your_email@example.com"

   # Add the key to ssh-agent
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519

   # Add the public key to your GitHub account
   cat ~/.ssh/id_ed25519.pub
   # Copy the output and add it to https://github.com/settings/keys

   # Test the connection
   ssh -T git@github.com
   ```

4. **Copy the example configuration**
   ```bash
   cp config.example.yaml config.yaml
   ```

5. **Edit `config.yaml`**
   - Set your GitHub PAT (or use `GITHUB_TOKEN` environment variable)
   - Add repositories to monitor
   - Configure event mappings and actions
   - Adjust queue, logging, and work directory settings

## Repository Fork Requirement

**IMPORTANT**: Apicurio Axiom requires that all monitored repositories are either owned by you or forked to your GitHub account.

### Why Forks Are Required

Axiom needs to work with a fork of each monitored repository because:
- Axiom clones repositories locally to perform operations
- Actions may need to create branches, commits, or pull requests
- Working with forks allows Axiom to push changes without affecting the upstream repository

### Setting Up Forks

For each repository in your `config.yaml` that you don't own:

1. **Navigate to the repository** on GitHub (e.g., `https://github.com/Apicurio/apicurio-registry`)
2. **Click "Fork"** in the top-right corner
3. **Create the fork** in your account

**Example:**
If your config monitors these repositories:
```yaml
repositories:
  - Apicurio/apicurio-registry
  - Quarkus/quarkus
  - YourUsername/your-repo
```

And you're authenticated as `YourUsername`, you need:
- ✓ `YourUsername/your-repo` - Already owned by you (no fork needed)
- ✗ `YourUsername/apicurio-registry` - Fork of Apicurio/apicurio-registry (required)
- ✗ `YourUsername/quarkus` - Fork of Quarkus/quarkus (required)

### Validation on Startup

Axiom automatically validates forks on startup:
- ✅ Repositories you own are automatically validated
- ✅ Forks are verified to ensure they're forks of the correct upstream repository
- ❌ If a required fork is missing, Axiom will exit with a clear error message showing which forks need to be created

**Error Example:**
```
Repository fork validation failed:

  • Missing fork: "Apicurio/apicurio-registry" must be forked to "YourUsername/apicurio-registry"
    Create fork at: https://github.com/Apicurio/apicurio-registry/fork

All monitored repositories must be either:
  1. Owned by YourUsername, OR
  2. Forked to YourUsername's account
```

## Configuration

### Environment Variables

```bash
# Required
export GITHUB_TOKEN=your_github_pat_here

# Required for AI Agent actions
export ANTHROPIC_VERTEX_PROJECT_ID=your_gcp_project_id
```

**Note**: For AI Agent actions, you'll also need Google Cloud credentials configured. The Vertex AI configuration (project ID, region, model) is set in `config.yaml`.

### Configuration File

The `config.yaml` file controls all application behavior. See `config.example.yaml` for a complete example with comments.

**Key sections:**
- `state`: State database directory location
- `github`: API token, polling interval, and event filtering
- `queue`: Job queue concurrency and polling
- `workDirectory`: Work directory location, size limits, and cleanup
- `logging`: Log directory locations and retention
- `vertexAI`: Google Cloud Vertex AI configuration for AI Agent actions
- `repositories`: List of repositories to monitor
- `eventMappings`: Maps events to actions with filters
- `actions`: Defines available actions

### Directory Configuration

All directory locations are configurable in `config.yaml`:

```yaml
state:
  basePath: ./data/state        # State database location (default: .state/)

logging:
  level: info                    # Log level: trace, debug, info, warn, error, fatal
  prettyPrint: true              # Pretty print logs (false for JSON in production)
  basePath: ./data/logs          # Action logs location (default: ./logs/)
  eventsPath: ./data/events      # Event JSON logs location (default: ./logs/events/)
  retentionDays: 30              # Log retention period

workDirectory:
  basePath: ./data/work          # Work directories for actions (default: ./work/)
```

### Event Processing Behavior

By default, Axiom only processes events that occur **after the application first started**. This prevents a flood of actions on historical events when Axiom starts up.

**How it works:**
- On first run, Axiom records the startup time in the database
- Events with timestamps before this time are skipped (logged but not processed)
- Only truly new events trigger actions

**To process historical events:**

Set `ignoreEventsBeforeStart: false` in `config.yaml`:

```yaml
github:
  token: ${GITHUB_TOKEN}
  pollInterval: 60
  ignoreEventsBeforeStart: false  # Process all events, including historical
```

**To reset the start time:**

Delete the state database and restart (adjust path if you've configured a custom `state.basePath`):

```bash
# Default location
rm .state/events.db

# Or if using custom location (e.g., ./data/state)
rm ./data/state/events.db

./start.sh
```

## Usage

### Starting the Bot

Use the startup script:

```bash
./start.sh
```

Or start directly:

```bash
npm start
```

Axiom will validate that all required environment variables are set before starting.

**On startup, Axiom will:**
- Authenticate with GitHub using your personal access token
- Display the authenticated user information (username, type, profile URL)
- Verify all required environment variables are set
- Initialize all components (state manager, job queue, work directory manager, etc.)
- Begin polling for GitHub events

### Dry Run Mode

Test your configuration without actually executing actions:

```bash
npm start -- --dryRun
```

In dry run mode:
- All events are processed normally
- Jobs are queued and logged
- Read-only tools and operations execute normally
- Write actions (GitHub API changes, git commits, etc.) are simulated but **not executed**
- Useful for testing event mappings, prompts, and configuration changes

### Development Mode

For development with auto-restart on file changes:

```bash
npm run dev
```

## Architecture

### Components

1. **GitHub Poller**: Polls GitHub API for repository events
2. **Event Processor**: Matches events against configured rules
3. **Job Queue**: Persistent queue with concurrency control
4. **Action Executor**: Executes actions with logging
5. **Work Directory Manager**: Manages git clones and disk usage
6. **Log Manager**: Automatically cleans up old log files based on retention policy
7. **State Manager**: Tracks processed events in SQLite

### Data Flow

```
GitHub Events → Poller → Event Processor → Job Queue → Action Executor → Logs
                                                              ↓
                                                      Work Directories
```

### Directories

All directory locations are configurable in `config.yaml`. Default locations:

- `{state.basePath}/` (default: `.state/`): SQLite database for events and queue
- `{workDirectory.basePath}/` (default: `./work/`): Git repository clones (per issue/PR/event)
- `{logging.basePath}/` (default: `./logs/`): Action execution logs (organized by repo)
- `{logging.eventsPath}/` (default: `./logs/events/`): Full event JSON logs
- `src/agent/prompts/`: AI Agent task prompts

## Job Queue

All actions are queued for execution with:
- **Persistence**: Survives application restarts
- **Concurrency Control**: Configurable max concurrent jobs
- **FIFO**: Simple first-in-first-out processing
- **Status Tracking**: pending → running → completed/failed

View queue status in the SQLite database (adjust path based on your `state.basePath` configuration):
```bash
# Default location
sqlite3 .state/events.db "SELECT * FROM job_queue WHERE status='pending'"

# Or with custom location
sqlite3 ./data/state/events.db "SELECT * FROM job_queue WHERE status='pending'"
```

## Logging

### Action Logs

Each action execution creates a log file:
```
{logging.basePath}/{owner}/{repo}/{timestamp}_{event-id}_{action}.log
```

Example (with default path): `logs/owner/repo/2026-01-21T14-19-54-040Z_issue-123_add-issue-labels.log`

Logs include:
- Event details
- Action output (stdout/stderr)
- Success/failure status
- Timestamps

The log directory can be configured via `logging.basePath` in `config.yaml`.

### Event JSON Logs

Full event JSON is always logged to:
```
{logging.eventsPath}/{owner}/{repo}/{timestamp}_{event-id}_{event-type}.json
```

Example (with default path): `logs/events/owner/repo/2026-01-21T19-06-50-000Z_5968461870_IssuesEvent.json`

This is useful for:
- Debugging event mappings and filters
- Understanding the structure of GitHub events
- Testing new filter configurations
- Analyzing event payloads for custom actions

The events log directory can be configured via `logging.eventsPath` in `config.yaml`.

### Structured Logging

Axiom uses structured JSON logging with correlation IDs for tracking events through the system:

**Log Levels:**
- `trace`: Verbose debugging information
- `debug`: Detailed debugging information
- `info`: General informational messages (default)
- `warn`: Warning messages
- `error`: Error messages
- `fatal`: Fatal errors that cause the application to exit

**Configuration:**
```yaml
logging:
  level: info          # Set log level
  prettyPrint: true    # Pretty print for development
```

**Features:**
- **Correlation IDs**: Each event processing flow is assigned a unique ID for tracing
- **Context-aware**: Logs include relevant context (eventId, jobId, repository, action)
- **JSON output**: Machine-readable JSON when `prettyPrint: false`
- **Pretty printing**: Human-readable output for development when `prettyPrint: true`

**Example log entry:**
```json
{
  "level": "info",
  "time": "2026-01-30T12:34:56.789Z",
  "pid": 12345,
  "correlationId": "abc123",
  "eventId": "5968461870",
  "repository": "owner/repo",
  "msg": "Event processed successfully"
}
```

### Automatic Log Cleanup

Axiom automatically cleans up old log files to prevent unbounded disk usage:

**How it works:**
- Runs daily cleanup checks automatically
- Deletes action logs older than `retentionDays` (default: 30 days)
- Deletes event JSON logs older than `retentionDays`
- Removes empty directories after file cleanup
- Runs on first startup and then every 24 hours

**Configuration:**
```yaml
logging:
  retentionDays: 30    # Delete logs older than 30 days
```

**What gets cleaned:**
- Action execution logs in `{logging.basePath}/`
- Event JSON logs in `{logging.eventsPath}/`
- Empty subdirectories (repository folders with no logs)

**Manual cleanup:**
To manually clean up old logs immediately, restart Axiom (cleanup runs on startup).

## Configuration Validation

Axiom performs comprehensive validation of the configuration file:

**Validation checks:**
- Action references in event mappings exist
- Tool patterns in AI agent actions are valid
- Event type patterns are recognized
- AI agent prompts exist
- Repository access (via GitHub API, skipped in dry-run mode)

**Example validation error:**
```
Configuration validation failed:

Event mapping #2 (event: issue.labeled) references undefined action: "analyze-bug"
AI agent action "my-action" references unknown tool: "invalid-tool"
```

The validation runs automatically on startup after loading prompts. Use `--dryRun` mode to validate configuration without executing actions or checking repository access.

## Work Directories

Work directories are created per issue/PR/event and reused:
- `{workDirectory.basePath}/issue-123/`: Git clone for issue #123
- `{workDirectory.basePath}/pr-456/`: Git clone for PR #456
- `{workDirectory.basePath}/event-789/`: Git clone for events without associated issues/PRs

Example (with default path):
- `work/issue-123/`
- `work/pr-456/`

The repository is cloned directly into the work directory and updated with `git pull` on subsequent actions.

**Automatic Cleanup**:
- Monitors total size hourly
- Deletes oldest directories when approaching size limit
- Configurable max size (default: 100GB)
- Base path configurable via `workDirectory.basePath` in `config.yaml`

## Troubleshooting

### Testing Configuration

Use dry run mode to test configuration changes without executing write actions:

```bash
npm start -- --dryRun
```

Check the logs to verify events are being matched correctly and see what actions would be executed. Full event JSON files are written to the configured events path (default: `./logs/events/`) which you can examine to understand event structure and test filter configurations.

### Bot won't start
- Check required environment variables are set (`GITHUB_TOKEN`, `ANTHROPIC_VERTEX_PROJECT_ID` if using AI agents)
- Verify `config.yaml` syntax (use a YAML validator)
- Ensure repositories are accessible with your GitHub token
- Check that all environment variables referenced in config are set (bot validates on startup)
- If GitHub authentication fails, verify your token has the required scopes

### GitHub authentication fails
- Verify `GITHUB_TOKEN` environment variable is set correctly
- Check that the token has not expired
- Ensure the token has the required permissions (repo access at minimum)
- Axiom displays authenticated user info on startup - check console output

### Repository fork validation fails
- Axiom requires all monitored repositories to be forked to your account (unless you own them)
- Check the error message - it will show which forks are missing
- Follow the fork links provided in the error message to create the required forks
- Verify that forks are properly created at `https://github.com/YourUsername/repo-name`
- Ensure forks are actual forks (not just copies) - they should show "forked from..." on GitHub
- After creating forks, restart the bot

### AI Agent actions fail
- Verify Google Cloud credentials are configured: `gcloud auth list`
- Check Vertex AI is enabled in your GCP project
- Verify `vertexAI.projectId` in `config.yaml` matches your GCP project
- Check that `ANTHROPIC_VERTEX_PROJECT_ID` environment variable is set
- Review action logs for specific error messages
- Test in dry-run mode first to validate prompts and tool configurations

### Actions not executing
- Check job queue: `sqlite3 {state.basePath}/events.db "SELECT * FROM job_queue"`
- Review logs in `{logging.basePath}/` directory
- Verify event mappings in `config.yaml`
- Check that event filters are correctly configured

### High disk usage
- Check work directory size: `du -sh {workDirectory.basePath}/`
- Check logs directory size: `du -sh {logging.basePath}/`
- Adjust `workDirectory.maxSizeGB` in config
- Adjust `logging.retentionDays` in config
- Manually clean old directories if needed

## Development

### Project Structure

```
apicurio-axiom/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── types/                      # TypeScript type definitions
│   ├── config/                     # Configuration loading
│   ├── github/                     # GitHub API & current user
│   ├── events/                     # Event processing
│   ├── actions/                    # Action execution
│   ├── agent/                      # AI Agent runtime
│   │   ├── prompts/                # AI Agent task prompts
│   │   └── tools/                  # AI Agent tool system
│   ├── logging/                    # Logging & log management
│   ├── queue/                      # Job queue & work directories
│   └── state/                      # State management
├── actions/
│   └── add-test-comment.js         # Example JS action
├── docs/                           # Documentation
│   ├── Actions.md                  # Action types and configuration
│   └── EventMappings.md            # Event mapping guide
├── start.sh                        # Startup script
├── config.yaml                     # Your configuration
└── config.example.yaml             # Example configuration
```

### Adding New Event Mappings

Edit `config.yaml`:
```yaml
eventMappings:
  - event: issue.labeled
    filters:
      - label: needs-triage
    actions:
      - your-action
```

### Adding New Actions

1. **Shell Action**:
   ```yaml
   actions:
     my-action:
       type: shell
       command: ./scripts/my-script.sh
   ```

2. **JavaScript Action**:
   ```yaml
   actions:
     my-action:
       type: javascript
       code: ./actions/my-action.js
   ```

3. **AI Agent Action**:
   - Create prompt in `src/agent/prompts/my-task.ts`
   - Add to config:
     ```yaml
     actions:
       my-action:
         type: ai-agent
         prompt: my-task
         tools:
           - github-get_issue_details
           - github-add_comment
           - repository-*
     ```

See `docs/Actions.md` for detailed documentation on all action types.

### Accessing Current GitHub User

Axiom provides access to the authenticated GitHub user information throughout the application:

```javascript
import { getCurrentUser, hasCurrentUser } from './github/current-user.js';

// Check if user is available
if (hasCurrentUser()) {
    const user = getCurrentUser();
    console.log(`Running as: ${user.login}`);
    console.log(`User type: ${user.type}`);
    console.log(`Profile: ${user.html_url}`);
}
```

**Available user information:**
- `login`: GitHub username
- `id`: Unique user ID
- `type`: User type (User, Organization, etc.)
- `name`: Display name (may be null)
- `email`: Email address (may be null)
- `company`: Company name (may be null)
- `avatar_url`: Avatar image URL
- `html_url`: GitHub profile URL

This can be useful in custom actions or tools that need to know the application's identity.

## License

Apache-2.0

## Contributing

Contributions welcome! Please open an issue or PR.
