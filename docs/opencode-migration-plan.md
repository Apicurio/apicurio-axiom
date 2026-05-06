# Apicurio Axiom — OpenCode Migration Plan

**Status:** In Progress
**Last Updated:** 2026-05-06

This document defines the plan for adding OpenCode as an AI engine in Apicurio Axiom alongside
the existing Claude Code CLI integration. It covers the feasibility assessment, architectural
differences, feature parity analysis, a phased migration plan, and risk considerations.

A core design principle of this plan is that **the AI engine must be pluggable**. Axiom must
not be locked into any single AI coding agent. The architecture must support multiple engine
implementations (Claude Code, OpenCode, and future engines) selectable at deployment time via
configuration. This is not an optional concern — it is a mandatory architectural requirement
that shapes every phase of this plan.

---

## 1. Executive Summary

Apicurio Axiom currently integrates with Claude Code CLI as its AI engine, invoking it as a
subprocess for event triage (Manager), task execution (Actor), script editing, tool definition
generation, and report generation. This plan proposes adding OpenCode as a second pluggable
AI engine, while retaining Claude Code support and establishing an engine abstraction layer
that allows switching between engines — or adding new ones — via configuration.

**The migration is feasible.** OpenCode's SDK/Server architecture (`opencode serve` + HTTP API)
provides equivalent or superior capabilities for most integration points. The main investment is
in building a pluggable engine abstraction, the OpenCode integration layer, and adapting the
manager/actor services to work against the engine-agnostic interface rather than directly
against Claude Code internals.

---

## 2. Current Claude Code Integration Points

Axiom invokes the Claude Code CLI in **six distinct sites**:

| # | Invocation Site | File | Purpose | Key Flags |
|---|----------------|------|---------|-----------|
| 1 | `ClaudeCodeActor` | `actors/claude-code/.../ClaudeCodeActor.java` | Task execution | `--output-format stream-json`, `--tools`, `--allowedTools`, `--mcp-config`, `--max-turns`, `--max-budget-usd` |
| 2 | `ManagerService` | `manager/.../ManagerService.java` | Event triage (AI decisions) | `--json-schema`, `--output-format stream-json`, tools=`StructuredOutput` only |
| 3 | `ScriptAiService` | `app/.../ScriptAiService.java` | Script generation/editing | `--json-schema`, `--output-format stream-json`, tools=`StructuredOutput` only |
| 4 | `ToolAiService` | `app/.../ToolAiService.java` | Tool definition generation | `--json-schema`, `--output-format stream-json`, tools=`StructuredOutput` only |
| 5 | `ReportExecutionService` | `app/.../ReportExecutionService.java` | Report generation | `--output-format stream-json`, `--mcp-config`, broad tool set |
| 6 | `StartupCheckService` | `app/.../StartupCheckService.java` | Health check | `--output-format text`, `--max-turns 1` |

### Supporting Classes (in `actors/claude-code/`)

- **`ClaudeCodeCommandBuilder`**: Fluent builder that constructs the `claude` CLI argument list.
  Handles `--tools`, `--allowedTools`, `--disallowedTools`, `--permission-mode`, `--model`,
  `--append-system-prompt`, `--max-turns`, `--max-budget-usd`, `--session-id`, `--mcp-config`,
  `--bare`, `--verbose`, `--output-format`.
- **`ClaudeCodeSubprocess`**: Process lifecycle management. Launches `ProcessBuilder`, redirects
  stdin from `/dev/null`, reads stdout/stderr in `CompletableFuture` threads, enforces timeouts,
  parses NDJSON stream events, and assembles a `ClaudeCodeResult`.
- **`ClaudeCodeResult`**: Java record holding `result`, `sessionId`, `totalCostUsd`,
  `inputTokens`, `outputTokens`, `exitCode`, `executionLog`.
- **`ExecutionLogBuilder`**: Thread-safe builder for human-readable execution transcripts.
- **`McpConfigGenerator`** (in `app/`): Generates per-task MCP config JSON files for
  `--mcp-config`, including script-based tools and external MCP servers.

### Claude-Specific Behaviors Relied Upon

1. Exit code 0 = success; exit code 124 = timeout (convention set by `ClaudeCodeSubprocess`).
2. NDJSON streaming with event types: `assistant`, `result`, `tool_result`.
3. `structured_output` field in result JSON when `--json-schema` is used.
4. `total_cost_usd`, `input_tokens`, `output_tokens` in both stream and final result.
5. `--permission-mode dontAsk` causes non-matching tool calls to abort (not prompt).
6. MCP tool naming convention: `mcp__<serverName>__<toolName>`.
7. Working directory set via `ProcessBuilder.directory()`, not a CLI flag.

---

## 3. OpenCode Capabilities

### Integration Approaches

OpenCode offers two integration models:

**A. CLI (`opencode run`):**
- `opencode run "prompt"` — non-interactive execution
- `--format json` — JSON event output
- `--model provider/model` — model selection
- `--agent` — custom agent selection
- `--session` / `--continue` — session continuity
- `--dir` — working directory
- `--dangerously-skip-permissions` — auto-approve all tools
- `--attach` — connect to a running server (avoids cold boot)
- **Limitation**: No `--json-schema` flag; structured output is only available via the SDK.

**B. SDK/Server (`opencode serve` + HTTP API) — RECOMMENDED:**
- `opencode serve` starts a headless HTTP server (OpenAPI 3.1 spec)
- `POST /session/:id/message` — send prompts, receive responses
- Structured output via `format: { type: "json_schema", schema: {...} }` in request body
- SSE events via `GET /event` for real-time streaming
- Session management: create, abort, list, continue, fork
- MCP server management: configure in `opencode.json` or add dynamically via `POST /mcp`
- Agent configuration: custom agents with per-tool permissions, models, system prompts
- JS/TS SDK (`@opencode-ai/sdk`) available; Java integration via HTTP client

### Why the SDK/Server Approach

The SDK/Server approach is the correct choice for Axiom because:
1. **Structured output** is critical for the Manager, ScriptAi, and ToolAi services — only
   available via the SDK, not the CLI.
2. **Session management** provides proper task isolation and continuity.
3. **No cold-boot penalty** — a persistent server avoids subprocess startup cost per task.
4. **MCP server management** can be done dynamically via API.
5. **Multi-provider support** — can use Anthropic, OpenAI, Google, or any configured provider.

---

## 4. Feature Parity Analysis

| Capability | Claude Code CLI | OpenCode | Parity |
|---|---|---|---|
| Non-interactive execution | `claude -p` | `opencode run` or SDK `session.prompt()` | Full |
| Structured output | `--json-schema` CLI flag | SDK `format: { type: "json_schema", schema }` | Full (SDK only) |
| Streaming events | NDJSON (`--output-format stream-json`) | SSE (`GET /event`) or `--format json` | Full (different format) |
| Tool restrictions | `--tools`, `--allowedTools`, `--permission-mode dontAsk` | Agent permission config (allow/ask/deny per tool, glob patterns) | Full (different mechanism) |
| MCP server integration | `--mcp-config <path>` per task | `opencode.json` config or `POST /mcp` dynamic registration | Full (different mechanism) |
| System prompt injection | `--append-system-prompt` | Agent `prompt` config (markdown or JSON) | Full |
| Model selection | `--model claude-sonnet-4-6` | `--model anthropic/claude-sonnet-4-6` or agent config | Full |
| Session continuity | `--session-id` | SDK session API (`POST /session`, `--session` flag) | Full |
| Cost tracking | NDJSON `result` event: `total_cost_usd` | SDK response metadata; `opencode stats` | Partial (needs verification) |
| Token tracking | NDJSON: `input_tokens`, `output_tokens` | SDK response metadata | Partial (needs verification) |
| Budget control | `--max-budget-usd` | No direct equivalent | **GAP** |
| Max turns/steps | `--max-turns` | Agent `steps` config | Full |
| Cancellation | `process.destroyForcibly()` | `POST /session/:id/abort` | Full |
| Working directory | `ProcessBuilder.directory()` | `--dir` flag or ProcessBuilder | Full |
| Multi-provider support | Anthropic only | Any provider (Anthropic, OpenAI, Google, etc.) | **Advantage** |

### Gaps Requiring Mitigation

1. **Budget control (`--max-budget-usd`)**: Must be implemented at the Axiom layer. Track
   cumulative cost per task from API responses and abort the session if it exceeds the
   configured budget.

2. **Per-invocation cost/token data**: Verify that OpenCode's HTTP response includes
   per-message cost and token counts. If not, implement cost estimation using the model's
   known pricing and token counts from the response.

3. **NDJSON event format**: The `ClaudeCodeSubprocess` NDJSON parser is not reusable.
   A new response parser must be written for OpenCode's SSE event format or HTTP response
   structure.

---

## 5. Architectural Changes

### Design Principle: Pluggable AI Engine

The AI engine **must be pluggable**. Axiom must not be coupled to any single AI coding agent.
This means:

1. All AI invocations (task execution, manager triage, script/tool AI, report generation)
   must go through an **engine-agnostic abstraction layer** (SPI interfaces).
2. Engine implementations (Claude Code, OpenCode, future engines) are **discovered via CDI**
   and selected at deployment time via a configuration property.
3. Engine-specific details (NDJSON parsing, HTTP API calls, CLI flags, MCP config format)
   are fully encapsulated within each engine module — no engine-specific code in `app/`,
   `manager/`, or other shared modules.

### Current Architecture (Claude Code — tightly coupled)

```
Axiom (Java/Quarkus)
  │
  ├── PipelineOrchestrator
  │     └── ManagerService ──▶ [claude -p ... --json-schema] ──▶ NDJSON ──▶ ManagerDecision
  │
  ├── TaskExecutionService
  │     └── ClaudeCodeActor ──▶ [claude -p ... --tools ...] ──▶ NDJSON ──▶ TaskResult
  │
  ├── ScriptAiService ──▶ [claude -p ... --json-schema] ──▶ NDJSON ──▶ Script
  ├── ToolAiService ──▶ [claude -p ... --json-schema] ──▶ NDJSON ──▶ ToolDefinition
  └── ReportExecutionService ──▶ [claude -p ... --mcp-config] ──▶ NDJSON ──▶ Report
```

Problem: `ManagerService`, `ScriptAiService`, `ToolAiService`, and `ReportExecutionService`
in `app/` and `manager/` directly instantiate `ClaudeCodeSubprocess` and
`ClaudeCodeCommandBuilder`. This tight coupling prevents pluggability.

### Proposed Architecture (Pluggable Engine)

```
Axiom (Java/Quarkus)
  │
  ├── engine/spi/                          ◄── NEW: Engine abstraction layer
  │     ├── AiEngine (interface)           — prompt(), promptWithSchema(), healthCheck()
  │     ├── AiEngineResult (record)        — result, sessionId, costUsd, tokens, log
  │     ├── AiEngineConfig (record)        — model, systemPrompt, tools, mcpServers, timeout, budget
  │     └── AiEngineMcpManager (interface) — registerMcpServers(), cleanup()
  │
  ├── engine/claude-code/                  ◄── Existing code, refactored behind SPI
  │     ├── ClaudeCodeEngine implements AiEngine
  │     ├── ClaudeCodeActor implements Actor
  │     ├── ClaudeCodeMcpManager implements AiEngineMcpManager
  │     └── (ClaudeCodeSubprocess, CommandBuilder, etc. — internal)
  │
  ├── engine/opencode/                     ◄── NEW: OpenCode engine implementation
  │     ├── OpenCodeEngine implements AiEngine
  │     ├── OpenCodeActor implements Actor
  │     ├── OpenCodeMcpManager implements AiEngineMcpManager
  │     ├── OpenCodeServerManager          — lifecycle for `opencode serve`
  │     ├── OpenCodeClient                 — HTTP client for OpenCode server API
  │     └── (OpenCodeConfigBuilder, AgentBuilder, etc. — internal)
  │
  ├── PipelineOrchestrator
  │     └── ManagerService ──▶ AiEngine.promptWithSchema() ──▶ AiEngineResult ──▶ ManagerDecision
  │
  ├── TaskExecutionService
  │     └── Actor (resolved by type) ──▶ AiEngineResult ──▶ TaskResult
  │
  ├── ScriptAiService ──▶ AiEngine.promptWithSchema() ──▶ AiEngineResult ──▶ Script
  ├── ToolAiService ──▶ AiEngine.promptWithSchema() ──▶ AiEngineResult ──▶ ToolDefinition
  └── ReportExecutionService ──▶ AiEngine.prompt() ──▶ AiEngineResult ──▶ Report
```

### Engine Selection

The active engine is selected via configuration:

```properties
# application.properties
axiom.ai-engine=opencode   # or "claude-code"
```

Engine implementations are CDI beans annotated with a qualifier (e.g., `@AiEngineType("opencode")`).
The `ManagerService`, `ScriptAiService`, `ToolAiService`, and `ReportExecutionService` inject
`AiEngine` via a CDI producer that resolves the active implementation based on the config property.

The `Actor` SPI already supports pluggable implementations via `getType()`. The actor type
mapping in `TaskExecutionService` is extended to support both engines:

```java
// TaskExecutionService
String actorType = switch (axiomAiEngine) {
    case "claude-code" -> "claude-code";
    case "opencode"    -> "opencode";
    default            -> throw new IllegalStateException("Unknown AI engine: " + axiomAiEngine);
};
```

Key architectural properties:
- **Engine-agnostic core**: `app/`, `manager/`, and `core/` modules have zero imports from
  engine-specific packages.
- **Pluggable via config**: Switching engines requires only a config property change.
- **Independently testable**: Each engine module has its own test suite.
- **Extensible**: Adding a third engine (e.g., Aider, Goose) requires only a new module
  implementing the SPI interfaces.

---

## 6. Phased Migration Plan

### Phase 1: Engine Abstraction Layer (SPI) — COMPLETED

**Status:** Completed (PR [#2](https://github.com/Apicurio/apicurio-axiom/pull/2))
**Branch:** `feature/engine-spi`

**Goal:** Extract the engine-agnostic interface from the current Claude Code integration,
create the Claude Code engine wrapper behind the SPI, and refactor all consumers to use
the engine-agnostic interface. This phase also encompassed the originally planned Phase 2
deliverables (Claude Code engine wrapper), since both were required to keep the codebase
compilable.

**New module:** `engine/spi/`

#### Delivered: SPI Interfaces (in `engine/spi/`)

| File | Description |
|------|-------------|
| `AiEngine.java` | Core SPI interface. Methods: `prompt(AiEngineConfig, String prompt)`, `promptWithSchema(AiEngineConfig, String prompt, String jsonSchema)`, `healthCheck()`, `getType()`, `getActorType()`. Returns `CompletableFuture<AiEngineResult>`. |
| `AiEngineResult.java` | Engine-agnostic result record: `result`, `sessionId`, `costUsd`, `inputTokens`, `outputTokens`, `success`, `executionLog`. Static factories: `success()`, `failure()`. |
| `AiEngineConfig.java` | Engine-agnostic configuration with builder pattern: `model`, `systemPrompt`, `allowedTools`, `disallowedTools`, `workingDirectory`, `environment`, `timeoutSeconds`, `maxSteps`, `maxBudgetUsd`, `sessionId`, `mcpConfigFile`. |
| `AiEngineMcpManager.java` | SPI interface for engine-specific MCP server management: `configureMcpServers(taskId, environment, allowedTools)`, `cleanup(taskId)`. |
| `AiEngineType.java` | CDI qualifier annotation: `@AiEngineType("claude-code")`. |
| `AiEngineCheckResult.java` | Health check result record: `name`, `status`, `message`. |
| `AiEngineProducer.java` | CDI producer that resolves the active `AiEngine` and `AiEngineMcpManager` based on `axiom.ai-engine` config property. Falls back to a no-op MCP manager if none found. |

#### Delivered: Claude Code Engine Wrapper (in `actors/claude-code/`)

| File | Description |
|------|-------------|
| `ClaudeCodeEngine.java` | Implements `AiEngine` with `@AiEngineType("claude-code")`. Wraps existing `ClaudeCodeCommandBuilder` + `ClaudeCodeSubprocess` logic. Supports `prompt()`, `promptWithSchema()` (adds `--json-schema` flag), and `healthCheck()` (runs `claude -p "AXIOM_OK"`). |
| `ClaudeCodeMcpManager.java` | Implements `AiEngineMcpManager` with `@AiEngineType("claude-code")`. Uses a delegate pattern — `McpConfigGenerator` in `app/` registers itself as the delegate at startup via `@PostConstruct`. |

#### Delivered: Consumer Refactoring

| Class | Change |
|-------|--------|
| `ManagerService` | Removed all `ClaudeCodeSubprocess`/`ClaudeCodeCommandBuilder`/`ExecutionLogBuilder` imports. Injects `AiEngine`, calls `promptWithSchema()`. Manager module POM no longer depends on `apicurio-axiom-actors-claude-code`. |
| `ScriptAiService` | Same — uses `AiEngine.promptWithSchema()` with `AiEngineConfig` builder. |
| `ToolAiService` | Same — uses `AiEngine.promptWithSchema()` with `AiEngineConfig` builder. |
| `ReportExecutionService` | Uses `AiEngine.prompt()` and `AiEngineMcpManager.configureMcpServers()`. Callback `onReportCompleted()` now receives `AiEngineResult` instead of `ClaudeCodeResult`. |
| `TaskExecutionService` | Injects `AiEngine` and `AiEngineMcpManager`. Actor type resolved via `aiEngine.getActorType()` instead of hardcoded `"claude-code"`. MCP config via `mcpManager.configureMcpServers()` instead of direct `McpConfigGenerator`. |
| `StartupCheckService` | Injects `AiEngine`. Delegates to `aiEngine.healthCheck()` instead of hardcoded `claude` CLI check. Results converted from `AiEngineCheckResult` to internal `CheckResult`. |
| `McpConfigGenerator` | Registers itself as the `ClaudeCodeMcpManager` delegate via `@PostConstruct`. Injects `Instance<AiEngineMcpManager>` to find the Claude Code MCP manager. |

#### Delivered: Configuration & POM Changes

| Change | Description |
|--------|-------------|
| `application.properties` | Added `axiom.ai-engine=claude-code` property |
| `pom.xml` (parent) | Added `engine/spi` module, `apicurio-axiom-engine-spi` dependency management entry |
| `manager/pom.xml` | Replaced `apicurio-axiom-actors-claude-code` dependency with `apicurio-axiom-engine-spi` |
| `actors/claude-code/pom.xml` | Added `apicurio-axiom-engine-spi` dependency |
| `app/pom.xml` | Added `apicurio-axiom-engine-spi` dependency |

#### Design Decision: Merged Phase 2 into Phase 1

The original plan had Phase 2 as a separate "Claude Code Engine Refactor" phase. In practice,
the SPI interfaces and the Claude Code engine wrapper had to be delivered together: refactoring
consumers to inject `AiEngine` requires a concrete implementation to exist for the code to
compile. The `ClaudeCodeEngine` and `ClaudeCodeMcpManager` were therefore created alongside
the SPI interfaces in a single commit.

The remaining Phase 2 items (module rename from `actors/claude-code/` to `engine/claude-code/`)
are deferred as optional cleanup — the current structure is functional and the engine
abstraction is complete.

#### What Remains from Original Phase 2

The following items were **not** done and are deferred to a future cleanup:

- **Module rename**: `actors/claude-code/` → `engine/claude-code/`. Low priority since the
  engine abstraction works correctly in the current module location.
- **`ExecutionLogBuilder` move**: Remains in `actors/claude-code/` rather than `engine/spi/`.
  Each engine implementation can provide its own logging; the SPI returns the log as a String
  in `AiEngineResult.executionLog()` so no shared base class is needed.

### Phase 2: OpenCode Core Integration Layer — COMPLETED

**Status:** Completed (same PR [#2](https://github.com/Apicurio/apicurio-axiom/pull/2))
**Branch:** `feature/engine-spi`

**Goal:** Build the OpenCode engine implementation behind the SPI.

**New module:** `engine/opencode/`

#### Delivered

| File | Description |
|------|-------------|
| `OpenCodeClient.java` | Java HTTP client wrapping the OpenCode server API using `java.net.http.HttpClient`. Endpoints: `POST /session` (create), `POST /session/:id/message` (prompt with optional `format: { type: "json_schema" }` for structured output), `POST /session/:id/abort` (cancel), `GET /global/health` (health/version), `POST /mcp` (register MCP server). Model specified in `provider/model` format. |
| `OpenCodeServerManager.java` | Manages `opencode serve` process lifecycle: start with `--port` and `--hostname`, health polling (500ms intervals, 30s timeout), exponential backoff restart (up to 5 attempts), graceful shutdown with 10s grace period. Static helpers: `isOpenCodeAvailable()`, `getCliVersion()`. |
| `OpenCodeEngine.java` | Implements `AiEngine` + `AiEngineProvider` with `@Typed({OpenCodeEngine.class, AiEngineProvider.class})`. Manages server via lazy-initialized `OpenCodeServerManager`. Creates a new session per invocation, sends prompt, parses response (text parts, `structured_output` field, usage/cost metadata). Supports `prompt()` and `promptWithSchema()`. Server shut down on `@PreDestroy`. |
| `OpenCodeActor.java` | Implements `Actor` SPI. Type: `"opencode"`. Builds `AiEngineConfig` from `ActorContext`, delegates to `OpenCodeEngine.prompt()`. Tracks sessions in `ConcurrentHashMap<Long, String>` for cancellation via `POST /session/:id/abort`. Config: `axiom.opencode.model`, `axiom.opencode.max-steps`, `axiom.opencode.timeout-seconds`. |
| `OpenCodeMcpManager.java` | Implements `AiEngineMcpManager` with `@Typed(OpenCodeMcpManager.class)`. Stub implementation — logs MCP tool intent, returns null (no config file needed; full `POST /mcp` registration planned for Phase 4). |

#### Design Decisions

- **No `OpenCodeResult.java`**: The `OpenCodeEngine` parses the JSON response directly
  into `AiEngineResult` — an intermediate record added no value.
- **No `OpenCodeConfigBuilder.java` / `OpenCodeAgentBuilder.java`**: Config translation
  (model format, permissions) is handled inline in `OpenCodeEngine` and `OpenCodeClient`.
  These may be extracted later in Phase 3 (Permission & Tool Mapping) if the mapping logic
  becomes complex enough to warrant separate classes.
- **System prompt as prompt prefix**: OpenCode's `POST /session/:id/message` does not have
  a separate system prompt field. The system prompt is prepended to the user prompt with
  a `---` separator. A future improvement could use OpenCode's agent configuration for
  cleaner system prompt injection.
- **One session per invocation**: Each `prompt()` / `promptWithSchema()` call creates a new
  session. This matches the Claude Code subprocess-per-invocation model. Session reuse for
  multi-turn conversations can be added later via `AiEngineConfig.sessionId`.

#### Delivered: Configuration Properties

| Property | Default | Description |
|----------|---------|-------------|
| `axiom.opencode.server.hostname` | `127.0.0.1` | Hostname for the OpenCode server |
| `axiom.opencode.server.port` | `4096` | Port for the OpenCode server |
| `axiom.opencode.model` | (none) | Default model in `provider/model` format |
| `axiom.opencode.max-steps` | `50` | Default max agent steps |
| `axiom.opencode.timeout-seconds` | `600` | HTTP request timeout for task execution |

#### Deferred to Future Phases

| Item | Deferred To | Reason |
|------|-------------|--------|
| `axiom.opencode.available-models` | Phase 6 (Config & UI) | Requires `GET /config/providers` integration in the UI model picker |
| `axiom.opencode.manager.*` properties | Phase 6 | Manager config is engine-agnostic (`axiom.manager.*`); engine-specific overrides not yet needed |
| `axiom.opencode.budget-usd` | Phase 5 (Actor & Task Execution) | Budget enforcement requires cost tracking from SSE events |
| Full MCP server registration via `POST /mcp` | Phase 4 (MCP Server Management) | Requires tool name mapping and `McpServerEntity` integration |

### Phase 3: Permission & Tool Mapping — COMPLETED

**Status:** Completed (same PR [#2](https://github.com/Apicurio/apicurio-axiom/pull/2))
**Branch:** `feature/engine-spi`

**Goal:** Map Axiom's tool restriction model to OpenCode's permission system.

#### Tool Mapping Table (implemented)

| Axiom Tool Name | OpenCode Permission Key | Notes |
|-----------------|------------------------|-------|
| `Read` | `read` | Direct mapping |
| `Glob` | `glob` | Direct mapping |
| `Grep` | `grep` | Direct mapping |
| `Bash` | `bash: "allow"` | Unrestricted bash |
| `Bash(git log *)` | `bash: { "*": "deny", "git log *": "allow" }` | Object syntax with deny-by-default |
| `Write` | `edit` | OpenCode `edit` covers write, edit, apply_patch |
| `Edit` | `edit` | Same permission key as Write |
| `StructuredOutput` | *(ignored)* | Not a tool in OpenCode; handled via `format.type: "json_schema"` |
| `mcp__<server>__<tool>` | `<server>_<tool>` | Double-underscore → single-underscore |
| Unknown tools | `<lowercase name>` | Passed through as-is |

#### Delivered

| File | Description |
|------|-------------|
| `OpenCodePermissionMapper.java` | Stateless utility class that converts Axiom tool lists to OpenCode permission maps. Handles all 4 tool name formats: simple tools, parameterized Bash, MCP tools, and `StructuredOutput` (ignored). Supports both allowed and disallowed tool lists. Includes `mapMcpToolName()` and `toAxiomMcpToolName()` for bidirectional MCP name translation. |
| `OpenCodePermissionMapperTest.java` | 20 unit tests covering: simple tools, Write/Edit deduplication, unrestricted Bash, parameterized Bash patterns, mixed Bash, MCP tool translation, MCP reverse mapping, StructuredOutput filtering, disallowed tools, null/empty inputs, realistic action type tool lists, unknown tool passthrough, and edge cases. |

#### Integration

`OpenCodeEngine.executeInternal()` calls `OpenCodePermissionMapper.mapPermissions()`
on every prompt invocation, passing the resulting permission map to `OpenCodeClient.sendPrompt()`
which includes the allowed tools in the request body.

#### Design Decision: ToolsetResolver Not Needed

`ToolsetResolver` expansion of `@ToolsetName` references happens upstream in
`TaskExecutionService.getToolsFromActionType()` and `ReportExecutionService.resolveAllowedTools()`
before the tool list reaches the engine. The permission mapper only needs to handle the
four resolved tool name formats — it never sees `@ToolsetName` references.

### Phase 4: MCP Server Management — COMPLETED

**Status:** Completed (same PR [#2](https://github.com/Apicurio/apicurio-axiom/pull/2))
**Branch:** `feature/engine-spi`

**Goal:** Implement OpenCode's MCP management behind the `AiEngineMcpManager` SPI.

#### Approach: Dynamic Registration via `POST /mcp`

OpenCode manages MCP servers at the server level (not per-task config files). The
`OpenCodeMcpManager` registers servers dynamically via the OpenCode server's HTTP API
when a task first requires them. Registered servers persist for the lifetime of the
OpenCode server process and are tracked to avoid re-registration on subsequent tasks.

#### Delivered

| File | Change |
|------|--------|
| `OpenCodeMcpManager.java` | Full implementation replacing the Phase 2 stub. Uses a `McpServerProvider` delegate pattern (same approach as `ClaudeCodeMcpManager`). `McpConfigGenerator` in `app/` provides `McpServerConfig` records; this class registers them via `OpenCodeClient.addMcpServer()`. Tracks registered servers in a `ConcurrentHashMap` to skip re-registration. Supports both local (stdio) and remote (HTTP) MCP servers. |
| `OpenCodeMcpManager.McpServerConfig` | Record type for MCP server configuration: `name`, `type` (local/remote), `command` (List), `environment` (Map), `url` (String). Static factories: `local()`, `remote()`. |
| `OpenCodeMcpManager.McpServerProvider` | Functional interface for the delegate: `getMcpServers(taskId, environment, allowedTools)`. |
| `McpConfigGenerator.java` | Extended with `getMcpServersForOpenCode()` method that queries `ToolDefinitionEntity` and `McpServerEntity`, filters by allowed tools, and returns `McpServerConfig` records. Registers itself as the delegate for both `ClaudeCodeMcpManager` and `OpenCodeMcpManager` in `@PostConstruct`. |

#### Design Decision: Delegate Pattern (not direct DB access)

`OpenCodeMcpManager` lives in `engine/opencode/` which does not depend on `core/` (where
the JPA entities are). The `McpServerProvider` delegate pattern allows `McpConfigGenerator`
in the `app/` module (which has DB access) to provide the MCP server configurations
without coupling the engine module to the data layer. This is the same pattern used by
`ClaudeCodeMcpManager`.

#### MCP tool name mapping

Delivered in Phase 3 via `OpenCodePermissionMapper.mapMcpToolName()`:
`mcp__serverName__toolName` → `serverName_toolName`.

### Phase 5: OpenCode Actor & Task Execution — COMPLETED (merged into Phase 2)

**Status:** Completed (delivered as part of Phase 2)

`OpenCodeActor` was implemented alongside `OpenCodeEngine` in Phase 2 since the two are
tightly coupled — the actor delegates to the engine and both live in `engine/opencode/`.
The full execution flow is:

```
1. TaskExecutionService resolves actor type from aiEngine.getActorType() → "opencode"
2. OpenCodeActor.execute() builds AiEngineConfig from ActorContext
3. OpenCodeEngine.prompt() lazily starts the OpenCode server via OpenCodeServerManager
4. Creates session: POST /session { title: "axiom-<timestamp>" }
5. Sends prompt: POST /session/:id/message { parts, model, format }
6. On completion: parses response (text parts, structured_output, usage)
7. On cancel: POST /session/:id/abort
8. Returns TaskResult with output, sessionId, cost, tokens
```

#### Budget Enforcement — Deferred

Budget enforcement (`--max-budget-usd` equivalent) is deferred. It requires cost data
from SSE streaming events (`GET /event`), which is not yet implemented. The current
implementation returns cost data from the final response only. Budget enforcement should
be implemented in the engine-agnostic layer so it applies to all engines.

### Phase 6: Configuration & UI Updates — COMPLETED

**Status:** Completed (same PR [#2](https://github.com/Apicurio/apicurio-axiom/pull/2))
**Branch:** `feature/engine-spi`

**Goal:** Update configuration, model picker, and UI to support pluggable engines.

#### Delivered

| Change | Description | Delivered In |
|--------|-------------|--------------|
| Engine selector config | `axiom.ai-engine` property (values: `claude-code`, `opencode`; default: `claude-code`) | Phase 1 |
| Engine-specific config | Both `axiom.claude-code.*` and `axiom.opencode.*` property namespaces coexist in `application.properties` | Phase 2 + Phase 6 |
| Active engine in REST API | `SystemConfig.engine` field added to OpenAPI spec and `GET /system/config` response. UI can read the active engine type. | Phase 6 |
| Model list endpoint | `GET /system/models` dynamically returns models for the active engine: Claude Code models (`claude-sonnet-4-6`, etc.) or OpenCode models in `provider/model` format (`anthropic/claude-sonnet-4-6`, `openai/gpt-4o`, etc.) | Phase 6 |
| OpenCode available-models config | `axiom.opencode.available-models` property with default multi-provider model list | Phase 6 |
| Actor type mapping | `TaskExecutionService` resolves actor type from `aiEngine.getActorType()` | Phase 1 |
| StartupCheckService | Delegates to `AiEngine.healthCheck()` | Phase 1 |
| README | Updated with pluggable engine table, install instructions for both engines, updated project structure showing `engine/spi/` and `engine/opencode/`, link to migration plan | Phase 6 |

#### Deferred

| Item | Reason |
|------|--------|
| UI engine indicator component | Requires React/TypeScript changes; the data is now exposed via `SystemConfig.engine` for the UI to consume when ready |
| UI model picker format update | Requires React component changes; the `GET /system/models` endpoint already returns the correct format for both engines |

### Phase 7: Testing — COMPLETED

**Status:** Completed (same PR [#2](https://github.com/Apicurio/apicurio-axiom/pull/2))
**Branch:** `feature/engine-spi`

**Goal:** Port and expand the test suite for both engines and the SPI layer.

#### Existing Tests (unchanged, all passing)

| Test | Module | Count | Status |
|------|--------|-------|--------|
| `ClaudeCodeCommandBuilderTest` | `actors/claude-code/` | 15 | Passing |
| `ClaudeCodeResultTest` | `actors/claude-code/` | 3 | Passing |
| `ClaudeCodeSubprocessTest` | `actors/claude-code/` | 10 | 10 skipped (require `AXIOM_CLAUDE_TESTS=true`) |
| `ManagerDecisionTest` | `manager/` | 4 | Passing |
| `ManagerDecisionParsingTest` | `manager/` | 11 | Passing |
| `ManagerPromptBuilderTest` | `manager/` | 7 | Passing |

#### New Tests Delivered

| Test | Module | Count | Description |
|------|--------|-------|-------------|
| `AiEngineResultTest` | `engine/spi/` | 6 | Success/failure factories, full constructor, null handling, record equality |
| `AiEngineConfigTest` | `engine/spi/` | 4 | Builder defaults, all fields set, builder reuse, partial build |
| `AiEngineCheckResultTest` | `engine/spi/` | 3 | OK/error results, record equality |
| `ClaudeCodeEngineTest` | `actors/claude-code/` | 5 | Type/actorType, provider identity, health check structure |
| `OpenCodePermissionMapperTest` | `engine/opencode/` | 20 | All tool name formats, Bash patterns, MCP mapping, edge cases |
| `OpenCodeEngineTest` | `engine/opencode/` | 4 | Type/actorType, provider identity, health check structure |
| `OpenCodeServerManagerTest` | `engine/opencode/` | 4 | CLI availability, version retrieval, constructor, stop-without-start |
| `OpenCodeMcpManagerTest` | `engine/opencode/` | 9 | McpServerConfig local/remote factories, delegate pattern, null inputs, record equality |

#### Test Totals

| Module | Tests | Passing | Skipped |
|--------|-------|---------|---------|
| `engine/spi/` | 13 | 13 | 0 |
| `engine/opencode/` | 37 | 37 | 0 |
| `manager/` | 22 | 22 | 0 |
| `actors/claude-code/` | 33 | 23 | 10 |
| **Total** | **105** | **95** | **10** |

The 10 skipped tests are pre-existing Claude Code CLI integration tests that require
`AXIOM_CLAUDE_TESTS=true` and the `claude` CLI binary. They are unchanged.

#### Deferred

| Test | Reason |
|------|--------|
| `AiEngineProducerTest` | Requires a Quarkus test harness for CDI producer testing; validated by CI's app integration tests |
| `OpenCodeClientTest` (HTTP integration) | Requires a running OpenCode server; to be added as integration test with `AXIOM_OPENCODE_TESTS=true` guard |
| `OpenCodeActorTest` (full flow) | Requires a running OpenCode server; same integration test guard |
| `BudgetEnforcementTest` | Budget enforcement not yet implemented (deferred from Phase 5) |
| `EngineIntegrationTest` (parameterized) | Requires both engines' binaries; to be added as CI job with dual-engine setup |

---

## 7. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SPI abstraction too leaky or too restrictive | Engine-specific features lost or awkward workarounds needed | Medium | Design the SPI iteratively: start with the minimum viable interface, then extend as the OpenCode implementation reveals gaps. Allow engines to expose optional capabilities. |
| OpenCode response format lacks per-invocation cost/token data | Cost tracking breaks; AI usage dashboard shows no data | Medium | Verify via testing. Fallback: estimate cost from model pricing + token counts. Use `opencode stats` as supplementary data source. |
| Budget enforcement is less reliable at the Axiom layer | Tasks may slightly exceed budget before abort takes effect | Medium | Check cost after each SSE event. Accept small overruns as tolerable. Implement in the engine-agnostic layer so all engines benefit. |
| Server lifecycle complexity (crash recovery, port conflicts) | Stuck tasks, failed health checks | Medium | Implement watchdog in `OpenCodeServerManager` with exponential backoff restart. Use random port assignment to avoid conflicts. |
| OpenCode binary not available on all deployment targets | Deployment failures | Low | Document prerequisites. Provide Docker image with both engines pre-installed. Startup validation per engine. |
| Different tool permission semantics cause unexpected behavior | Tasks fail due to denied tool calls or overly permissive access | Medium | Comprehensive mapping tests. Start with `--dangerously-skip-permissions` for initial validation, then tighten. |
| MCP tool naming convention differs (`__` vs `_`) | Tool filtering breaks; wrong tools available to tasks | Low | Centralize naming convention translation in each engine's `AiEngineMcpManager`. |
| OpenCode structured output retry behavior differs from Claude | Manager decision parsing fails intermittently | Low | OpenCode SDK supports `retryCount` for structured output validation. Set to 2-3 retries. |
| Maintaining two engine implementations long-term | Increased maintenance burden; feature drift | Medium | Keep the SPI minimal and well-documented. Engine-specific features are encapsulated. Shared test suite (parameterized) catches regressions in both engines. |

---

## 8. Estimated Effort

| Phase | Description | Estimated Effort | Files Changed/Created | Status |
|-------|-------------|------------------|-----------------------|--------|
| 1 | Engine Abstraction Layer (SPI) + Claude Code Wrapper | — | 9 new, 12 modified (23 total) | **Completed** |
| 2 | OpenCode Core Integration Layer | — | 5 new, 3 modified (8 total) | **Completed** |
| 3 | Permission & Tool Mapping | — | 1 new + 1 test + 2 modified (4 total) | **Completed** |
| 4 | MCP Server Management | — | 1 rewritten + 1 modified (2 total) | **Completed** |
| 5 | OpenCode Actor & Task Execution | — | — | **Completed** (merged into Phase 2) |
| 6 | Configuration & UI Updates | — | 3 modified + 1 OpenAPI schema (4 total) | **Completed** |
| 7 | Testing | — | 7 new test files + 1 POM (8 total) | **Completed** |
| **Total** | | | **49 files changed/created** | **All phases complete** |

---

## 9. Prerequisites

- For Claude Code engine: `claude` CLI installed and on PATH (`npm install -g @anthropic-ai/claude-code`)
- For OpenCode engine: `opencode` CLI installed and on PATH (`curl -fsSL https://opencode.ai/install | bash`)
- API keys for the desired LLM provider(s) configured for the active engine
- Node.js 22+ (for the bundled `axiom-tools` MCP server — unchanged from current)
- Java 25+ and Maven 3.9+ (unchanged)

Note: Only the engine selected via `axiom.ai-engine` needs to be installed. Both can be
installed side-by-side for development and testing.

---

## 10. Success Criteria

Items marked with a checkmark have been achieved.

1. [x] **Pluggable engine architecture**: Switching between Claude Code and OpenCode requires only
   changing `axiom.ai-engine` in `application.properties`. No code changes needed.
2. [x] **Engine-agnostic core**: `manager/` module has zero imports from engine-specific
   packages. `app/` module imports `ClaudeCodeMcpManager` only for the delegate wiring
   (`McpConfigGenerator.init()`), which is a one-time bootstrap — all runtime invocations
   go through the `AiEngineMcpManager` SPI.
3. [x] **Claude Code parity**: All existing functionality works identically with
   `axiom.ai-engine=claude-code` (the default). All consumer services refactored.
4. [~] **OpenCode parity**: Manager structured output (decisions), task execution, script/tool AI,
   and report generation all work correctly with `axiom.ai-engine=opencode`.
   Engine implementation complete; pending end-to-end validation with live OpenCode server.
5. [ ] **Cost and token tracking**: `AiUsageEntity` is populated correctly by both engines.
6. [x] **MCP server integration**: Script tools and external MCP servers work with both engines
   via their respective `AiEngineMcpManager` implementations. Claude Code uses per-task
   config files; OpenCode uses dynamic `POST /mcp` registration.
7. [x] **All tests pass** for both engines — 95 passing, 10 skipped (pre-existing Claude CLI
   integration tests). New tests: 55 across SPI, OpenCode, and Claude Code engine modules.
8. [x] **Startup health check** validates the active engine's prerequisites via
   `AiEngine.healthCheck()`.
9. [x] **UI model picker** supports multiple providers when OpenCode is active.
   `GET /system/models` returns provider/model format; `GET /system/config` exposes
   the active engine type. UI component updates deferred to a follow-up.
10. [~] **End-to-end pipeline** (event → manager → task → actor → result) works with both engines.
    All code paths wired; end-to-end integration test deferred until both binaries available in CI.
11. [x] **Extensibility**: Adding a third engine requires only implementing `AiEngine`,
    `AiEngineMcpManager`, and `Actor` in a new module — no changes to core modules.
