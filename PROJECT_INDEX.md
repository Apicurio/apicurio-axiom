# Project Index: apicurio-axiom

**Generated:** 2026-02-04
**Version:** 1.0.0
**Type:** GitHub Automation System with AI Agent Integration

## 📋 Project Overview

A locally-running GitHub automation system that monitors GitHub events and triggers custom actions based on
configurable rules. Features AI Agent integration via Google Cloud Vertex AI for intelligent automation. Built
with TypeScript and Node.js, using event-driven architecture with persistent job queuing.

**Key Capabilities:**
- Event-driven GitHub repository monitoring
- Flexible action execution (shell, JavaScript, AI agents)
- Persistent SQLite-based job queue
- AI-powered automation via Claude (Vertex AI)
- Comprehensive logging and event tracking
- Automatic resource cleanup and management

## 📁 Project Structure

```
apicurio-axiom/
├── src/                      # TypeScript source code (41 files)
│   ├── index.ts              # Main entry point
│   ├── actions/              # Action execution system
│   │   └── executors/        # Shell, JavaScript, AI agent executors
│   ├── agent/                # AI agent runtime
│   │   ├── prompts/          # Prompt registry system
│   │   └── tools/            # AI agent tool system (GitHub, Git, Repository)
│   ├── config/               # Configuration loading and validation
│   ├── events/               # Event processing engine
│   ├── github/               # GitHub API client and utilities
│   ├── logging/              # Structured logging and log management
│   ├── queue/                # Job queue and work directory management
│   ├── state/                # State management (SQLite)
│   ├── types/                # TypeScript type definitions
│   └── validation/           # Event and config validation
├── prompts/                  # AI agent task prompts (5 templates)
│   ├── base.hbs              # Base prompt template
│   ├── label-issue.hbs       # Issue labeling prompt
│   ├── analyze-issue.hbs     # Issue analysis prompt
│   ├── discussion.hbs        # Discussion participation prompt
│   └── test-comment.hbs      # Test comment prompt
├── actions/                  # Custom JavaScript actions (4 files)
├── schemas/                  # JSON schemas and examples (5 files)
│   ├── event.schema.json     # Event validation schema
│   └── examples/             # Example event payloads
├── docs/                     # Documentation
│   ├── Actions.md            # Action types and configuration
│   ├── EventMappings.md      # Event mapping guide
│   └── event-validation.md   # Event validation documentation
├── dist/                     # Compiled JavaScript output
├── data/                     # Runtime data directories
│   ├── state/                # SQLite database
│   ├── work/                 # Repository clones
│   ├── logs/                 # Action execution logs
│   └── events/               # Event JSON logs
└── .github/workflows/        # GitHub Actions workflows

```

## 🚀 Entry Points

- **CLI**: `src/index.ts` - Main application entry point
- **Start Script**: `start.sh` - Startup script with environment validation
- **Package Main**: `dist/index.js` - Compiled entry point

## 📦 Core Modules

### Configuration System
- **Path**: `src/config/`
- **Files**: `config-loader.ts`, `validators.ts`
- **Purpose**: Load and validate YAML configuration with environment variable substitution

### GitHub Integration
- **Path**: `src/github/`
- **Files**: `client.ts`, `poller.ts`, `repository-manager.ts`, `fork-validator.ts`, `current-user.ts`
- **Purpose**: GitHub API client, event polling, repository management, and user authentication

### Event Processing
- **Path**: `src/events/`
- **Files**: `event-processor.ts`
- **Purpose**: Match GitHub events against configured rules and trigger actions

### Action Execution
- **Path**: `src/actions/`
- **Key Exports**: `ActionExecutor`, action executors (shell, JavaScript, AI agent)
- **Purpose**: Execute actions with logging, environment setup, and error handling

### AI Agent Runtime
- **Path**: `src/agent/`
- **Key Components**:
  - `runtime.ts` - Agent execution loop
  - `conversation.ts` - Conversation management
  - `vertex-client.ts` - Vertex AI integration
  - `tools/` - Tool system (GitHub, Git, Repository operations)
  - `prompts/` - Prompt registry and templates
- **Purpose**: Claude AI integration with custom tool system for intelligent automation

### Job Queue
- **Path**: `src/queue/`
- **Files**: `job-queue.ts`, `work-directory-manager.ts`
- **Purpose**: Persistent job queue with concurrency control and work directory management

### State Management
- **Path**: `src/state/`
- **Files**: `state-manager.ts`
- **Purpose**: SQLite-based event tracking and job queue persistence

### Logging System
- **Path**: `src/logging/`
- **Files**: `logger.ts`, `log-manager.ts`
- **Purpose**: Structured JSON logging with correlation IDs and automatic cleanup

## 🔧 Configuration

**Main Config**: `config.yaml` (example: `config.example.yaml`)

**Key Sections:**
- `github` - API token, polling interval, event filtering
- `repositories` - List of repositories to monitor
- `eventMappings` - Event-to-action mappings with filters
- `actions` - Action definitions (shell, JavaScript, AI agent)
- `queue` - Job queue concurrency and polling
- `workDirectory` - Work directory location, size limits, cleanup
- `logging` - Log levels, directories, retention
- `vertexAI` - Google Cloud Vertex AI configuration for AI agents
- `prompts` - Prompt template directory location

**Environment Variables:**
- `GITHUB_TOKEN` - GitHub Personal Access Token (required)
- `ANTHROPIC_VERTEX_PROJECT_ID` - Google Cloud project ID for AI agents (required for AI actions)

## 📚 Documentation

- **README.md** - Comprehensive setup and usage guide
- **docs/Actions.md** - Detailed action type documentation (shell, JavaScript, AI agent)
- **docs/EventMappings.md** - Event mapping configuration guide
- **docs/event-validation.md** - Event validation system documentation
- **prompts/README.md** - AI agent prompt system documentation
- **CODE_OF_CONDUCT.md** - Community guidelines
- **CONTRIBUTING.md** - Contribution guidelines

## 🔗 Key Dependencies

**Core Runtime:**
- `typescript` (^5.3.3) - TypeScript language
- `ts-node` (^10.9.2) - TypeScript execution

**GitHub Integration:**
- `@octokit/rest` (^20.0.2) - GitHub REST API client

**AI Agent:**
- `@anthropic-ai/sdk` (^0.32.0) - Anthropic SDK
- `@anthropic-ai/vertex-sdk` (^0.4.0) - Vertex AI integration for Claude

**Data & Persistence:**
- `better-sqlite3` (^11.0.0) - SQLite database
- `js-yaml` (^4.1.0) - YAML configuration parsing
- `ajv` (^8.17.1) + `ajv-formats` (^3.0.1) - JSON schema validation

**Logging:**
- `pino` (^10.3.0) - Structured logging
- `pino-pretty` (^13.1.3) - Pretty log formatting

**Templates:**
- `handlebars` (^4.7.8) - Template engine for prompts

**Terminal:**
- `node-pty` (^1.0.0) - Pseudo-terminal for shell actions

**Code Quality:**
- `@biomejs/biome` (^2.3.14) - Linting and formatting

## 🧪 Test Coverage

- **Test Files**: Located in `node_modules/` (dependency tests only)
- **Project Tests**: No dedicated test suite in main source
- **Validation**: Configuration validation, event schema validation

## 📝 Quick Start

1. **Prerequisites**
   ```bash
   # Node.js 20+, GitHub PAT, SSH key for GitHub
   # Google Cloud with Vertex AI (for AI agents)
   ```

2. **Install**
   ```bash
   npm install
   ```

3. **Configure**
   ```bash
   cp config.example.yaml config.yaml
   # Edit config.yaml - set repositories, event mappings, actions
   export GITHUB_TOKEN=your_token
   export ANTHROPIC_VERTEX_PROJECT_ID=your_gcp_project  # For AI agents
   ```

4. **Run**
   ```bash
   ./start.sh                # Production mode
   npm run dev               # Development with auto-restart
   npm start -- --dryRun     # Test without executing write actions
   npm start -- --listTools  # List available AI agent tools
   ```

5. **Build**
   ```bash
   npm run build             # Compile TypeScript to dist/
   npm run clean             # Remove dist/
   npm run reset             # Remove dist/, data/, node_modules/
   ```

## 🎯 Common Use Cases

**1. Automatic Issue Labeling**
```yaml
eventMappings:
  - event: issue.opened
    actions:
      - auto-label-issues  # AI agent action
```

**2. Bug Triage Workflow**
```yaml
eventMappings:
  - event: issue.labeled
    filters:
      - path: payload.label.name
        equals: type/bug
    actions:
      - triage-bugs  # AI agent analyzes and comments
```

**3. PR Welcome Message**
```yaml
eventMappings:
  - event: pull_request.opened
    filters:
      - draft: false
    actions:
      - welcome-contributor  # JavaScript action
```

**4. Discussion Participation**
```yaml
eventMappings:
  - event: discussion.created
    actions:
      - ai-discuss  # AI agent participates in discussions
```

## 🔄 Event Flow

```
GitHub Events
    ↓
GitHubPoller (polls every N seconds)
    ↓
EventProcessor (matches events → actions)
    ↓
JobQueue (persistent, FIFO, concurrent)
    ↓
ActionExecutor (executes shell/JS/AI agent)
    ↓
Logs (action logs + event JSON)
```

## 🛠️ AI Agent Tools

**Tool Categories:**
- `github-*` - GitHub API operations (read/write)
- `git-*` - Git operations (status, diff, log, branch)
- `repository-*` - File system operations (read, list, search)

**Example Tool Patterns:**
- `github-get_*` - All GitHub read tools
- `github-add_*` - All GitHub write tools
- `git-*` - All git tools
- `repository-*` - All repository tools
- `*` - All tools (use with caution)

## 📊 Directory Layout (Runtime)

```
data/
├── state/
│   └── events.db           # SQLite database (events, job queue)
├── work/
│   └── {owner}/{repo}/     # Git clones per issue/PR
├── logs/
│   └── {owner}/{repo}/     # Action execution logs
└── events/
    └── {owner}/{repo}/     # Event JSON logs
```

## 🔒 Security Notes

- **Fork Requirement**: All monitored repositories must be forked to the authenticated user's account
- **Token Scopes**: GitHub token needs `repo` scope (or `public_repo` for public repos only)
- **SSH Access**: Repositories cloned via SSH (requires SSH key configured)
- **Tool Allowlists**: AI agents restricted to explicitly configured tools
- **Work Directory Isolation**: Actions execute in isolated work directories
- **No File System Access**: AI agents cannot access files outside work directories

## 📈 Resource Management

- **Log Retention**: Automatic cleanup after N days (configurable)
- **Work Directory Cleanup**: Size-based cleanup when threshold reached
- **Job Queue**: Persistent, survives application restarts
- **Concurrency**: Configurable max concurrent jobs (default: 3)

## 🏗️ Architecture Patterns

- **Event-Driven**: GitHub events trigger configured actions
- **Queue-Based**: All actions queued for execution (persistent, FIFO)
- **Modular**: Clear separation of concerns (config, events, actions, state)
- **Extensible**: Easy to add new action types, prompts, and tools
- **Observable**: Comprehensive logging with correlation IDs

## 🚦 Development

**Linting:**
```bash
npm run lint          # Check code quality
npm run lint:fix      # Fix issues automatically
```

**File Watching:**
```bash
npm run dev           # Auto-restart on file changes
```

**Debugging:**
- Set `logging.level: debug` for detailed logs
- Use `--dryRun` to test without executing write actions
- Check `logs/events/` for full event JSON
- Review `logs/{owner}/{repo}/` for action execution logs

---

**License:** Apache-2.0
**Author:** Apicurio Community
**Node Version:** >=18.0.0
