# Research: Claude Code Integration for Apicurio Axiom v2

**Date:** 2026-04-02
**Depth:** Deep
**Confidence:** High

---

## Executive Summary

There are **three viable approaches** for controlling Claude Code from a Java/Quarkus backend.
The recommended approach is **CLI subprocess with `stream-json` output**, with a future migration
path to the **Claude Agent SDK** via a thin Node.js sidecar if more sophisticated control is
needed.

---

## Integration Options

### Option 1: CLI Subprocess (Recommended Starting Point)

Launch `claude` as a subprocess using `-p` (print/non-interactive mode) with structured output.

**Key flags for our use case:**

| Flag | Purpose | Our Usage |
|------|---------|-----------|
| `-p` | Non-interactive mode | Always — no terminal interaction |
| `--output-format json` | Structured JSON result | Final result with metadata |
| `--output-format stream-json` | Streaming JSON (NDJSON) | Real-time progress for UI |
| `--allowedTools` | Pre-approve tools (no prompts) | Enforce action-level safety constraints |
| `--disallowedTools` | Block specific tools | Additional safety layer |
| `--cwd` | Working directory | Scope to project's git clone |
| `--model` | Model selection | Configurable per actor |
| `--max-turns` | Limit iterations | Rate limiting / runaway prevention |
| `--max-budget-usd` | Cost limit | Rate limiting |
| `--append-system-prompt` | Add to system prompt | Inject task-specific instructions |
| `--mcp-config` | Custom MCP servers | Provide project-aware tools |
| `--permission-mode` | Control permissions | Use `acceptEdits` or `dontAsk` |
| `--bare` | Skip auto-discovery | Faster startup, predictable behavior |
| `--resume` | Resume session | Multi-turn within a project |
| `--session-id` | Set session ID | Deterministic session management |
| `--include-partial-messages` | Stream partial tokens | Real-time output to UI |

**Output format (`json`):**
```json
{
  "result": "string — the final text output",
  "session_id": "string — use to resume later",
  "total_cost_usd": 0.05,
  "usage": { "input_tokens": 1200, "output_tokens": 800 }
}
```

**Output format (`stream-json`):** Newline-delimited JSON, one object per line. Includes
partial messages when `--include-partial-messages` is set. Each line has a `type` field.

**Advantages:**
- Simplest integration — just spawn a process from Java
- Full access to all CLI flags
- No additional runtime dependencies
- Session management via `--resume` / `--session-id`
- Cost tracking via JSON output

**Limitations:**
- No built-in mechanism for clarifying questions (must pre-approve everything)
- Process management complexity (lifecycle, timeouts, cleanup)
- Parsing NDJSON for streaming requires careful implementation

### Option 2: Claude Agent SDK (Future Upgrade Path)

The Agent SDK is available for **TypeScript/Node.js** and **Python**. It provides programmatic
control beyond what the CLI offers.

**Key capabilities beyond CLI:**

1. **`canUseTool` callback** — intercept every tool call and approve/deny/modify it
   programmatically. This is the closest thing to a "clarifying question" mechanism — we could
   intercept certain operations and pause for user input.

2. **Multi-turn conversations** via `ClaudeSDKClient` — maintain stateful conversations without
   relying on session files.

3. **Custom MCP servers defined in code** — create tools inline using `createSdkMcpServer()`
   and `tool()`, providing project-specific tools directly.

4. **`interrupt()`** — cancel a running query gracefully.

5. **Streaming with typed messages** — richer message types than CLI NDJSON.

**Integration with Java/Quarkus:**

Since the SDK is Node.js/Python, not Java, integration options are:
- **Thin Node.js sidecar process** — a small Node.js service that wraps the SDK and exposes
  an internal API (HTTP, gRPC, or stdio) for the Quarkus backend to call
- **GraalJS** — run the Node.js SDK within the JVM via GraalVM (experimental, may not work
  with native modules)
- **Python subprocess** — use the Python SDK from a Python script, called by Java

**Advantages:**
- `canUseTool` callback enables fine-grained safety control
- Multi-turn without session file management
- Inline MCP server creation
- Better streaming and interruption support

**Limitations:**
- Requires a Node.js or Python runtime alongside Java
- Additional complexity in the deployment stack
- Sidecar adds a network hop

### Option 3: Direct Anthropic API (Not Recommended for Actor)

Use the Anthropic API directly and reimplement Claude Code's tool infrastructure.

**Not recommended** for either the Manager or actors. Claude Code provides file system tools,
git integration, code editing, search, and more out of the box. Reimplementing all of this
would be enormous effort for no benefit. Both the Manager and actors use Claude Code CLI —
the Manager is configured with specialized MCP tools for decision-making rather than code
editing tools.


## Recommended Architecture

### Phase 1: CLI Subprocess

```
┌─────────────────────────────────────────────────┐
│ Quarkus Backend                                 │
│                                                 │
│  ClaudeCodeActor                                │
│  ├── Builds command line from Task + constraints│
│  ├── Spawns `claude -p ...` subprocess          │
│  ├── Reads stream-json output line by line      │
│  ├── Emits progress events to SSE               │
│  ├── Parses final JSON result                   │
│  └── Manages subprocess lifecycle               │
└──────────────────┬──────────────────────────────┘
                   │ ProcessBuilder
                   ▼
         ┌─────────────────┐
         │ claude CLI       │
         │ --cwd <project>  │
         │ -p "<prompt>"    │
         │ --stream-json    │
         │ --allowedTools   │
         │ --bare           │
         └─────────────────┘
```

**Clarifying questions in Phase 1:** Not directly supported. Mitigations:
- Pre-approve all necessary tools via `--allowedTools`
- Use `--permission-mode acceptEdits` or `dontAsk`
- Provide comprehensive context in the prompt to minimize the need for questions
- If the task fails or produces incomplete results, the Manager can create a follow-up task
  with additional context

**Session continuity:** Use `--session-id` with a deterministic ID derived from the task ID.
If a task needs to be resumed (e.g., after providing a clarifying answer), use `--resume` with
the same session ID.

### Phase 2: Agent SDK Sidecar (When Needed)

If Phase 1 reveals limitations (especially around clarifying questions or fine-grained tool
control), introduce a thin Node.js sidecar:

```
┌─────────────────┐         ┌──────────────────────────────┐
│ Quarkus Backend  │◄──────▶│ Node.js Sidecar               │
│                  │  HTTP   │                                │
│ ClaudeCodeActor  │        │  Uses @anthropic-ai/           │
│ (HTTP client)    │        │  claude-agent-sdk              │
│                  │        │                                │
│                  │        │  canUseTool callback:          │
│                  │        │  ├── Intercepts questions      │
│                  │        │  ├── Calls back to Quarkus     │
│                  │        │  └── Waits for answer          │
│                  │        │                                │
│                  │        │  Custom MCP servers:           │
│                  │        │  ├── Project-aware tools       │
│                  │        │  └── Safety enforcement        │
└─────────────────┘        └──────────────────────────────┘
```


## Safety Constraint Mapping

How our three levels of safety constraints map to Claude Code flags:

| Constraint Level | Mechanism |
|------------------|-----------|
| **Actor-level** (broadest tool set) | `--allowedTools` with the actor's full permission list |
| **Action-level** (narrowed per action type) | Compute intersection, pass as `--allowedTools` |
| **Project-level** (directory scoping) | `--cwd` pointed at the project's git clone |

Additional safety mechanisms:
- `--max-turns` — prevent runaway agent loops
- `--max-budget-usd` — cost guardrails
- `--bare` — skip auto-discovery of hooks, plugins, CLAUDE.md files from other projects
- `--disallowedTools` — explicit blocklist as a safety net


## Session Management Strategy

For multi-turn task execution within a project:

1. **Task starts:** Generate a session ID (e.g., `axiom-task-{taskId}`)
2. **First invocation:** Use `--session-id {generated-id}` to set a known session ID
3. **Continuation (e.g., after clarifying answer):** Use `--resume {session-id}` to continue
4. **Session data:** Claude Code stores session data locally; ensure the `--cwd` is consistent
   across invocations so session files are found

This approach lets us resume interrupted tasks without losing context.


## Key Findings

1. **No REST/WebSocket API** — Claude Code has no network interface. All integration is via
   CLI subprocess or the Agent SDK (Node.js/Python).

2. **Clarifying questions are the hardest problem** — The CLI has no mechanism for interactive
   Q&A from an external process. The Agent SDK's `canUseTool` callback is the closest thing,
   but it intercepts tool calls, not arbitrary questions.

3. **`--bare` flag is essential** — Without it, Claude Code will discover and load CLAUDE.md
   files, hooks, and plugins from the project directory, which could interfere with our
   controlled execution.

4. **`stream-json` gives us real-time visibility** — We can stream task progress to the UI
   in real time by parsing the NDJSON output.

5. **Cost tracking is built in** — The JSON output includes `total_cost_usd` and token usage,
   which we can use for rate limiting and budgeting.

6. **MCP servers can be injected** — Via `--mcp-config`, we can provide project-specific tools
   to the Claude Code agent, potentially including tools to interact with our system (e.g.,
   query project metadata, post to the conversation thread).
