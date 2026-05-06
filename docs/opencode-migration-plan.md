# Apicurio Axiom — OpenCode Migration Plan

**Status:** Draft
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

### Phase 1: Engine Abstraction Layer (SPI)

**Goal:** Extract the engine-agnostic interface from the current Claude Code integration.
This is the foundational phase — all subsequent phases depend on it.

**New module:** `engine/spi/`

#### Deliverables

| File | Description |
|------|-------------|
| `AiEngine.java` | Core SPI interface. Methods: `prompt(AiEngineConfig, String prompt)`, `promptWithSchema(AiEngineConfig, String prompt, String jsonSchema)`, `healthCheck()`, `getType()`. Returns `CompletableFuture<AiEngineResult>`. |
| `AiEngineResult.java` | Engine-agnostic result record: `result` (String), `sessionId` (String), `costUsd` (Double), `inputTokens` (Long), `outputTokens` (Long), `success` (boolean), `executionLog` (String). |
| `AiEngineConfig.java` | Engine-agnostic configuration record: `model`, `systemPrompt`, `promptTemplate`, `allowedTools` (List), `disallowedTools` (List), `mcpServers` (List), `workingDirectory` (Path), `environment` (Map), `timeoutSeconds` (int), `maxSteps` (int), `maxBudgetUsd` (Double), `sessionId` (String). |
| `AiEngineMcpManager.java` | SPI interface for MCP server lifecycle: `registerServers(taskId, List<McpServerConfig>)`, `cleanup(taskId)`. |
| `AiEngineType.java` | CDI qualifier annotation: `@AiEngineType("claude-code")`, `@AiEngineType("opencode")`. |
| `AiEngineProducer.java` | CDI producer that resolves the active `AiEngine` implementation based on the `axiom.ai-engine` config property. Injected by `ManagerService`, `ScriptAiService`, `ToolAiService`, `ReportExecutionService`. |
| `ExecutionLogBuilder.java` | Moved from `actors/claude-code/` to `engine/spi/` (engine-agnostic parts). Each engine can extend or wrap it for engine-specific event logging. |

#### Refactoring Required

The following classes in `app/` and `manager/` currently import Claude Code classes directly.
They must be refactored to use the `AiEngine` SPI instead:

| Class | Current Dependency | Change |
|-------|-------------------|--------|
| `ManagerService` | `ClaudeCodeSubprocess`, `ClaudeCodeCommandBuilder` | Inject `AiEngine`, call `promptWithSchema()` |
| `ScriptAiService` | `ClaudeCodeSubprocess`, `ClaudeCodeCommandBuilder` | Inject `AiEngine`, call `promptWithSchema()` |
| `ToolAiService` | `ClaudeCodeSubprocess`, `ClaudeCodeCommandBuilder` | Inject `AiEngine`, call `promptWithSchema()` |
| `ReportExecutionService` | `ClaudeCodeSubprocess`, `ClaudeCodeCommandBuilder` | Inject `AiEngine`, call `prompt()` |
| `TaskExecutionService` | Hardcoded `"claude-code"` actor type | Resolve actor type from `axiom.ai-engine` config |
| `StartupCheckService` | Hardcoded `claude` CLI check | Delegate to `AiEngine.healthCheck()` |
| `McpConfigGenerator` | Claude-specific MCP config format | Delegate to `AiEngineMcpManager` |

### Phase 2: Claude Code Engine Refactor

**Goal:** Wrap the existing Claude Code integration behind the new SPI, without changing
its behavior. After this phase, Axiom's core modules have zero Claude Code imports.

**Refactored module:** `engine/claude-code/` (renamed from `actors/claude-code/`, plus
code moved out of `app/` and `manager/`).

#### Deliverables

| File | Description |
|------|-------------|
| `ClaudeCodeEngine.java` | Implements `AiEngine`. Wraps existing `ClaudeCodeSubprocess` + `ClaudeCodeCommandBuilder` logic. Methods delegate to the existing subprocess code. |
| `ClaudeCodeActor.java` | Unchanged (already implements `Actor` SPI). Moved to `engine/claude-code/`. |
| `ClaudeCodeMcpManager.java` | Implements `AiEngineMcpManager`. Extracts MCP config file generation logic from `McpConfigGenerator` in `app/`. |
| `ClaudeCodeSubprocess.java` | Unchanged, now internal to `engine/claude-code/`. |
| `ClaudeCodeCommandBuilder.java` | Unchanged, now internal to `engine/claude-code/`. |
| `ClaudeCodeResult.java` | Unchanged, now internal. `ClaudeCodeEngine` maps it to `AiEngineResult`. |

#### Validation

After this phase, the entire test suite must pass with `axiom.ai-engine=claude-code` (the
default). No behavioral changes — this is a pure refactoring phase.

### Phase 3: OpenCode Core Integration Layer

**Goal:** Build the OpenCode engine implementation behind the SPI.

**New module:** `engine/opencode/`

#### Deliverables

| File | Description |
|------|-------------|
| `OpenCodeEngine.java` | Implements `AiEngine`. Manages server lifecycle, sends prompts via HTTP API, supports structured output via `format: { type: "json_schema" }`. |
| `OpenCodeActor.java` | Implements `Actor` SPI. Type: `"opencode"`. Creates sessions, sends prompts, streams progress, converts response to `TaskResult`. |
| `OpenCodeServerManager.java` | Manages `opencode serve` process lifecycle: start, stop, health-check, restart on crash. Configurable port range. One server per workspace or shared. |
| `OpenCodeClient.java` | Java HTTP client wrapping the OpenCode server API. Methods: `createSession()`, `sendPrompt()`, `sendPromptWithSchema()`, `abortSession()`, `healthCheck()`, `registerMcpServer()`. Uses `java.net.http.HttpClient`. |
| `OpenCodeResult.java` | Internal result record. `OpenCodeEngine` maps it to `AiEngineResult`. |
| `OpenCodeConfigBuilder.java` | Builds `opencode.json` config fragments and HTTP request payloads. Handles model name translation (`claude-sonnet-4-6` → `anthropic/claude-sonnet-4-6`). |
| `OpenCodeAgentBuilder.java` | Generates OpenCode agent configurations (JSON or markdown) from `AiEngineConfig`: system prompt, allowed tools → permissions, model, max steps. |

#### Configuration Properties

| Property | Default | Description |
|----------|---------|-------------|
| `axiom.opencode.server.port` | `4096` | Port for the OpenCode server |
| `axiom.opencode.server.hostname` | `127.0.0.1` | Hostname for the OpenCode server |
| `axiom.opencode.model` | (none) | Default model in `provider/model` format |
| `axiom.opencode.available-models` | (dynamic) | Override model list, or use `GET /config/providers` |
| `axiom.opencode.max-steps` | `50` | Default max agent steps (replaces `max-turns`) |
| `axiom.opencode.timeout-seconds` | `600` | HTTP request timeout for task execution |
| `axiom.opencode.manager.model` | (none) | Model override for Manager evaluations |
| `axiom.opencode.manager.timeout-seconds` | `120` | Timeout for Manager evaluations |
| `axiom.opencode.manager.max-steps` | `5` | Max steps for Manager evaluations |
| `axiom.opencode.budget-usd` | `5.0` | Per-task budget limit (enforced by Axiom) |

### Phase 4: Permission & Tool Mapping

**Goal:** Map Axiom's tool restriction model to OpenCode's permission system.

#### Tool Mapping Table

| Axiom Tool Name | OpenCode Permission Key | Notes |
|-----------------|------------------------|-------|
| `Read` | `read` | Direct mapping |
| `Glob` | `glob` | Direct mapping |
| `Grep` | `grep` | Direct mapping |
| `Bash` | `bash` | Direct mapping |
| `Bash(git log *)` | `bash: { "git log*": "allow" }` | Pattern syntax differs slightly |
| `Write` | `edit` | OpenCode `edit` covers write, edit, apply_patch |
| `Edit` | `edit` | Same |
| `StructuredOutput` | (built-in to SDK) | Not a tool in OpenCode; use `format.type: "json_schema"` |
| `mcp__<server>__<tool>` | `<server>_<tool>` | OpenCode uses `_` separator, not `__` |

#### Deliverables

- Permission mapping logic in `OpenCodeConfigBuilder.java`.
- MCP tool name translation (double underscore → single underscore).
- `ToolsetResolver` integration to expand `@ToolsetName` references before mapping.
- Unit tests for all mapping edge cases.

### Phase 5: MCP Server Management

**Goal:** Implement OpenCode's MCP management behind the `AiEngineMcpManager` SPI.

#### Current Approach (Claude Code)
`McpConfigGenerator` writes a per-task JSON file containing:
- `axiom-tools` server (bundled Node.js MCP server for script-based tools)
- External MCP servers (from `McpServerEntity` database entries)

The file is passed via `--mcp-config <path>`. This logic is now encapsulated in
`ClaudeCodeMcpManager` (Phase 2 refactor).

#### New Approach (OpenCode)
Two options (both supported):

**Option A — Static config per workspace:**
Generate an `opencode.json` in each project workspace directory with the MCP servers
configured. Regenerate when MCP server configuration changes.

**Option B — Dynamic registration (preferred):**
Use `POST /mcp` to register MCP servers dynamically when a task starts. This avoids
file management and allows per-task server sets.

#### Deliverables

| File | Description |
|------|-------------|
| `OpenCodeMcpManager.java` | Implements `AiEngineMcpManager`. Registers MCP servers via HTTP API or generates `opencode.json` config. Handles both script-based tools (`axiom-tools`) and external servers. |
| MCP name mapping | Translate `mcp__<server>__<tool>` convention to OpenCode's `<server>_<tool>` format in allowed tool lists. |

### Phase 6: OpenCode Actor & Task Execution

**Goal:** Implement the `OpenCodeActor` behind the existing `Actor` SPI.

Note: `OpenCodeActor` and `OpenCodeEngine` are both in `engine/opencode/` (Phase 3).
This phase focuses on wiring up the full task execution flow end-to-end.

#### Execution Flow

```
1. Resolve ActionType → build AiEngineConfig (permissions, model, system prompt, max steps)
2. Ensure OpenCode server is running for this workspace (via OpenCodeServerManager)
3. Register required MCP servers (via OpenCodeMcpManager)
4. Create session: POST /session { title: "axiom-task-<id>" }
5. Send prompt: POST /session/:id/message {
     model: { providerID, modelID },
     parts: [{ type: "text", text: prompt }],
     format: { type: "json_schema", schema } // only for structured output
   }
6. Stream progress via GET /event (SSE) — feed to ExecutionLogBuilder
7. On completion: extract result text, cost, tokens from response
8. On cancel: POST /session/:id/abort
9. Return TaskResult with output, sessionId, cost, tokens, executionLog
```

#### Budget Enforcement

Since OpenCode lacks `--max-budget-usd`, implement at the Axiom layer (in the `AiEngine`
SPI or in `TaskExecutionService`):

```java
// In OpenCodeEngine or TaskExecutionService
if (cumulativeCostUsd > budgetLimitUsd) {
    openCodeClient.abortSession(sessionId);
    return AiEngineResult.failure("Budget exceeded: $" + cumulativeCostUsd);
}
```

This can be checked after each SSE event that includes cost data, or after the final response.
This budget enforcement logic should live in the engine-agnostic layer so it applies to all
engines.

### Phase 7: Configuration & UI Updates

**Goal:** Update configuration, model picker, and UI to support pluggable engines.

#### Deliverables

| Change | Description |
|--------|-------------|
| Engine selector config | Add `axiom.ai-engine` property (values: `claude-code`, `opencode`; default: `claude-code`) |
| Engine-specific config | Both `axiom.claude-code.*` and `axiom.opencode.*` property namespaces coexist |
| Model list endpoint | Dynamically populate available models based on the active engine. For OpenCode: use `GET /config/providers`. For Claude Code: use existing static list. |
| UI engine indicator | Show the active engine name in the UI (settings page or status bar) |
| UI model picker | Update to show `provider/model` format when OpenCode is active; support models from multiple providers |
| Actor type mapping | `TaskExecutionService` resolves actor type from `axiom.ai-engine` config instead of hardcoding `"claude-code"` |
| StartupCheckService | Delegate to `AiEngine.healthCheck()` — each engine validates its own prerequisites |
| Documentation | Update README, `docs/architecture-v2.md`, and `docs/design-v2.md` to describe the pluggable engine architecture |
| Install instructions | Document both `npm install -g @anthropic-ai/claude-code` and `curl -fsSL https://opencode.ai/install \| bash` as options |

### Phase 8: Testing

**Goal:** Port and expand the test suite for both engines and the SPI layer.

#### Test Mapping

| Current Test | New Test | Type |
|-------------|----------|------|
| `ClaudeCodeCommandBuilderTest` (12 tests) | Unchanged (stays in `engine/claude-code/`) | Unit |
| `ClaudeCodeResultTest` (3 tests) | Unchanged (stays in `engine/claude-code/`) | Unit |
| `ClaudeCodeSubprocessTest` (8 integration tests) | Unchanged (stays in `engine/claude-code/`) | Integration |
| `ManagerDecisionTest` (4 tests) | Unchanged (schema-level parsing, engine-agnostic) | Unit |
| `ManagerDecisionParsingTest` (10 tests) | Unchanged (engine-agnostic) | Unit |
| App integration tests (14 tests) | Run against both engines via parameterized config | Integration |

#### New Tests

| Test | Module | Description |
|------|--------|-------------|
| `AiEngineSpiTest` | `engine/spi/` | Verify SPI contracts: interface methods, result mapping, config builder |
| `AiEngineProducerTest` | `engine/spi/` | CDI producer resolves correct engine based on `axiom.ai-engine` config |
| `OpenCodeConfigBuilderTest` | `engine/opencode/` | Config/request payload construction, model name mapping |
| `OpenCodeResultTest` | `engine/opencode/` | Result record construction, mapping to `AiEngineResult` |
| `OpenCodeClientTest` | `engine/opencode/` | HTTP client integration (requires `opencode` binary) |
| `OpenCodeServerManagerTest` | `engine/opencode/` | Server lifecycle: start, health-check, stop, restart |
| `OpenCodeMcpManagerTest` | `engine/opencode/` | MCP server registration and cleanup |
| `OpenCodeActorTest` | `engine/opencode/` | Full task execution flow with mock server |
| `PermissionMappingTest` | `engine/opencode/` | Axiom tool list → OpenCode permission config |
| `BudgetEnforcementTest` | `engine/spi/` or `app/` | Verify session abort when budget exceeded (engine-agnostic) |
| `EngineIntegrationTest` | `app/` | End-to-end pipeline with both engines (parameterized) |

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

| Phase | Description | Estimated Effort | Files Changed/Created |
|-------|-------------|------------------|-----------------------|
| 1 | Engine Abstraction Layer (SPI) | 3-4 days | 7 new files, 6 refactored |
| 2 | Claude Code Engine Refactor | 2-3 days | 6 moved/refactored files |
| 3 | OpenCode Core Integration Layer | 3-4 days | 7 new files |
| 4 | Permission & Tool Mapping | 1-2 days | 2 files + tests |
| 5 | MCP Server Management | 2-3 days | 2 files + tests |
| 6 | OpenCode Actor & Task Execution | 2-3 days | 2 files + integration wiring |
| 7 | Configuration & UI Updates | 2-3 days | 5-8 modified files |
| 8 | Testing | 3-4 days | 10-12 test files |
| **Total** | | **18-26 days** | **~35-45 files** |

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

1. **Pluggable engine architecture**: Switching between Claude Code and OpenCode requires only
   changing `axiom.ai-engine` in `application.properties`. No code changes needed.
2. **Engine-agnostic core**: `app/`, `manager/`, and `core/` modules have zero imports from
   `engine/claude-code/` or `engine/opencode/` packages.
3. **Claude Code parity**: All existing functionality works identically with
   `axiom.ai-engine=claude-code` after the refactor (Phase 2 validation).
4. **OpenCode parity**: Manager structured output (decisions), task execution, script/tool AI,
   and report generation all work correctly with `axiom.ai-engine=opencode`.
5. **Cost and token tracking**: `AiUsageEntity` is populated correctly by both engines.
6. **MCP server integration**: Script tools and external MCP servers work with both engines
   via their respective `AiEngineMcpManager` implementations.
7. **All tests pass** for both engines — existing tests (adapted) and new engine-specific tests.
8. **Startup health check** validates the active engine's prerequisites.
9. **UI model picker** supports multiple providers when OpenCode is active.
10. **End-to-end pipeline** (event → manager → task → actor → result) works with both engines.
11. **Extensibility**: Adding a third engine (e.g., Aider, Goose) requires only implementing the
    SPI interfaces in a new module — no changes to core modules.
