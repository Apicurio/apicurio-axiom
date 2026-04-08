# Apicurio Axiom v2 — Design Document

**Status:** Draft
**Last Updated:** 2026-04-01

---

## 1. Vision & Goals

Apicurio Axiom v2 is an **event-driven project orchestration platform** that monitors GitHub and Jira
repositories for issue activity, creates and manages long-lived Projects around those issues, and
delegates work to a mix of human and AI actors.

### What It Is
- A project tracker that bridges external issue trackers (GitHub, Jira) with an internal orchestration
  layer
- An intelligent dispatcher that reacts to issue events and assigns work to appropriate actors
- A user-facing application with a UI for visibility, interaction, and control
- A framework for safely integrating autonomous AI agents into software development workflows

### What It Is Not
- Not a replacement for GitHub or Jira — it augments them
- Not a CI/CD system — it orchestrates work, not builds
- Not a general-purpose task management tool — it is purpose-built for software development workflows
  driven by issue tracker events


## 2. Core Concepts

### 2.1 Project

A **Project** is the central entity in the system. It represents a tracked unit of work tied to a single
external issue.

| Field            | Description                                                    |
|------------------|----------------------------------------------------------------|
| `id`             | Internal unique identifier                                     |
| `name`           | Human-readable name (often derived from issue title)           |
| `description`    | Summary of the project's purpose                               |
| `type`           | Category of work (bug-fix, feature, question, help, other)     |
| `status`         | Current lifecycle state (Created, In Progress, Idle, Completed)|
| `issueSource`    | The issue tracker type (GitHub, Jira)                          |
| `issueRef`       | Reference to the linked issue (e.g. `owner/repo#123`)         |
| `repository`     | The repository the issue belongs to                            |
| `createdOn`      | Timestamp of creation                                          |
| `updatedOn`      | Timestamp of last modification                                 |
| `metadata`       | Extensible key-value metadata (labels, priority, assignee)     |

**Key rules:**
- A Project is linked 1:1 with a single GitHub or Jira issue.
- A Project cannot span multiple issues or multiple repositories.
- The application can monitor multiple repositories, but each Project is scoped to one.
- A completed Project can be re-opened by the application user via the UI, or by the Manager in
  response to new activity on the linked issue (see Section 3).

### 2.2 Task

A **Task** is a discrete unit of work within a Project. When the Manager determines that an action
needs to be taken, it creates a Task and assigns it to an Actor.

| Field            | Description                                                    |
|------------------|----------------------------------------------------------------|
| `id`             | Internal unique identifier                                     |
| `projectId`      | The Project this task belongs to                               |
| `actionType`     | The type of action (label, analyze, propose, implement, review, respond, etc.) |
| `createdBy`      | Who created this task (manager, user)                           |
| `assignedActor`  | The Actor responsible for this task (null for system actions)   |
| `status`         | Task state (Pending, In Progress, Awaiting Input, Completed, Failed, Cancelled) |
| `input`          | Context provided to the actor (issue body, comment, diff, etc.)|
| `output`         | Result produced by the actor (analysis, code, comment, etc.)   |
| `createdOn`      | When the task was created                                      |
| `completedOn`    | When the task finished (if applicable)                         |

**Why Task exists as a separate concept from Action:**

"Action" is a *type* — it describes the kind of work (proposal, implementation, code review). "Task" is
an *instance* — it records that a specific Actor was assigned to perform a specific Action on a specific
Project at a specific time, along with the inputs provided and the results produced. Without Task as a
first-class entity:
- There is no place to attach the output/result of an action
- There is no way to track the sequence of work performed on a project over time
- The activity timeline has no structured records to display
- There is no entity to associate with safety constraint enforcement

A Project accumulates Tasks over its lifetime. The activity timeline for a Project is largely a view over
its Tasks.

### 2.3 Actor

An **Actor** is an entity capable of performing work. Actors are configured at the application level and
can be assigned Tasks by the Manager.

| Field            | Description                                                    |
|------------------|----------------------------------------------------------------|
| `id`             | Internal unique identifier                                     |
| `name`           | Human-readable name (e.g. "Claude Code Agent", "Eric")         |
| `description`    | Description of the actor's role or specialty                   |
| `type`           | `human` or `ai-agent`                                          |
| `capabilities`   | What the actor *can* do (list of action types)                 |
| `permissions`    | What the actor is *allowed* to do (safety constraints)         |
| `configuration`  | Type-specific config (e.g. model, API keys, Slack handle)      |

**Actor SPI:** The system defines a generic Actor interface. Concrete implementations exist for:
- **Human Actor** — notifies the human of the task assignment via a configured channel (Slack,
  Telegram, UI) and collects their response
- **AI Agent Actor** — dispatches the task to an AI agent (e.g. Claude Code) with appropriate context
  and safety constraints

The SPI must support:
- Assigning a task with context
- Receiving results (synchronous or asynchronous)
- Asking and answering clarifying questions
- Reporting progress/status
- Cancelling a task in progress

### 2.4 Manager

The **Manager** is a specialized Actor responsible for triaging events and deciding what actions to take.
The Manager is invoked whenever an event is detected and must decide:

1. Should a Task be created in response to this event? If so, what action type?
2. Which Actor should be assigned to the Task?

If the Manager decides a Task should be created and no Project exists yet for the associated issue,
a Project is automatically created first. Project creation is not a discrete action — it is a
side effect of the first Task being created for an issue.

The Manager is implemented as an **AI Agent**. It evaluates each event using a set of configurable
natural-language **Policies** (see Section 6) that serve as decision guidelines. The Manager
interprets the policies in the context of the event, the issue metadata, and the current state of
the project (if one exists) to decide what to do.

- If the Manager has **high confidence** in its decision (self-assessed), it proceeds autonomously.
- If it has **low confidence**, it escalates to the **application user** for confirmation or override
  (via the notification system).

**Manager context and tools:** The Manager is implemented using **Claude Code** (the same
technology used for AI Agent actors), configured with a specialized set of MCP tools for
querying project information and making decisions. It is provided with an MCP server that
allows it to query:
- Project metadata and current status
- Task history for the project (what has been done so far)
- Conversation thread (prior discussions and clarifications)
- The event payload and issue metadata
- The list of available action types and actors
- The configured policies

This gives the Manager enough context to make informed decisions without requiring the entire
project history to be serialized into every prompt.

### 2.5 Event

An **Event** represents something that happened — either externally (a change in an issue tracker) or
internally (a Task completed). All events flow through the same Manager pipeline, creating a unified
event loop.

| Field            | Description                                                    |
|------------------|----------------------------------------------------------------|
| `id`             | Internal unique identifier                                     |
| `source`         | Where the event originated (github, jira, internal)            |
| `eventType`      | The kind of change (see event types below)                     |
| `issueRef`       | Reference to the associated issue (if applicable)              |
| `repository`     | The repository the event relates to (if applicable)            |
| `projectId`      | Associated Project (if one exists; null otherwise)             |
| `taskId`         | Associated Task (for internal events; null otherwise)          |
| `payload`        | Full event data                                                |
| `receivedAt`     | When the event was received                                    |

**Event sources:**

- **GitHub:** Issues and Pull Requests. PR events are only processed if the PR is linked to a tracked
  GitHub issue; unlinked PRs are ignored.
  - Event types: `issue-created`, `issue-updated`, `issue-closed`, `issue-reopened`,
    `comment-added`, `pr-opened`, `pr-updated`, `review-submitted`, `checks-completed`
  - Note: the list of supported event types will expand over time as new integrations are added.
- **Jira:** Issues and their transitions, comments, and field changes.
  - Event types: `issue-created`, `issue-updated`, `issue-transitioned`, `comment-added`
- **Internal:** Generated by the system when a Task completes. This allows the Manager to evaluate
  the result and decide whether follow-up actions are needed — without requiring the Task to have
  modified the external issue.
  - Event types: `task-completed`, `task-failed`

**Internal event flow:**

When a Task completes, the system can optionally emit an internal Event. Whether an internal event is
emitted depends on the action type and configuration — not every task completion needs follow-up
evaluation. When emitted, the internal event carries the Task's output in its payload and flows through
the same Manager pipeline as external events. This means the Manager can:
- Chain tasks together (e.g., an `analyze` task completes → Manager creates an `implement` task)
- React to failures (e.g., a `review` task found issues → Manager creates a `fix` task)
- Decide the project is complete based on task results rather than waiting for the issue to close

Events that are not associated with any existing Project are still evaluated by the Manager, which may
decide to create a new Project or ignore the event.

### 2.6 Action Type

An **Action Type** defines a kind of work that can be performed within the system. Action Types are
registered in the system and form the vocabulary used by Policies, the Manager, and the UI.

| Field            | Description                                                    |
|------------------|----------------------------------------------------------------|
| `id`             | Internal unique identifier                                     |
| `name`           | Human-readable name (e.g. "Analyze Issue", "Implement Feature")|
| `description`    | What this action type does and when it is appropriate           |
| `executionMode`  | How this action is executed: `actor` or `system` (see below)   |
| `userTriggerable`| Whether the application user can manually trigger this action  |
| `inputSchema`    | (Optional) Description of input required when manually triggered (e.g. "target branch", "additional instructions") |
| `toolConstraints`| The set of tools available to actors performing this action (see Section 7.2); only applicable to `actor` mode |
| `emitsEvent`     | Whether completing a task of this type emits an internal event  |

**Execution modes:**

- **Actor actions** (`executionMode: actor`) — require an Actor to perform work. The Manager assigns
  the task to an appropriate actor based on capabilities and availability. Examples: `analyze`,
  `implement`, `review`.
- **System actions** (`executionMode: system`) — executed directly by the application without
  involving an Actor. These are administrative operations that change system state. The Task is
  still recorded in the activity log for auditability, but `assignedActor` is null. Examples:
  `close-project`, `reopen-project`.

Action Types are **user-configurable** — the application user can add, edit, or remove action types
via the UI (see Section 8). The system ships with a set of built-in action types as sensible
defaults, but the registry is not fixed. Examples of built-in action types include:

- `analyze` — Read and understand an issue, assess complexity, identify affected components (actor)
- `auto-tag` — Determine appropriate labels/tags for an issue (actor)
- `implement` — Write code to address the issue (actor)
- `propose` — Draft a proposal or design for addressing the issue, read-only (actor)
- `review` — Review a pull request or code change (actor)
- `respond` — Reply to a comment or review feedback (actor)
- `answer-question` — Answer a question asked by a user on the issue (actor)
- `close-project` — Mark the project as completed (system)
- `reopen-project` — Re-open a completed project (system)

**Referencing action types:** Policies and actor capabilities reference action types by name.
These are soft references, not hard foreign keys:
- If a Policy references an action type that does not exist, the Manager should log a warning and
  skip that policy.
- If an actor's capabilities list includes an action type that no longer exists, it has no effect
  — the actor simply cannot be assigned tasks of that (non-existent) type.
- Capability validation happens at **task assignment time**: the Manager checks that the chosen
  actor's capabilities include the action type before assigning the task. If not, the Manager
  selects a different actor.


## 3. Project Lifecycle

```
 ┌──────────┐         ┌──────────────┐         ┌──────┐         ┌─────────────┐
 │ Created  │────────▶│ In Progress  │────────▶│ Idle │────────▶│  Completed  │
 └──────────┘         └──────────────┘         └──────┘         └─────────────┘
                            ▲                     │                    │
                            │                     │                    │
                            └─────────────────────┘                    │
                              (new event/task)                         │
                            ▲                                          │
                            │                                          │
                            └──────────────────────────────────────────┘
                              (user re-opens via UI, or Manager
                               re-opens due to new event)
```

- **Created**: A new Project has just been created (either automatically by the Manager or manually
  by a user). This is the initial state before any work has begun. A project is only in this state
  once — immediately after creation.
- **In Progress**: An Actor is actively working on a Task for this Project. The Project transitions
  to In Progress when a Task begins.
- **Idle**: No Actor is currently working on the Project, but the Project is not yet complete. The
  Project moves to Idle when a Task completes and no further Tasks are pending. It returns to In
  Progress when a new event triggers a Task or a user manually creates one. A Project may move
  between Idle and In Progress many times over its lifetime as events arrive and are processed.
- **Completed**: The Project is done. A project is completed when the Manager executes a
  `close-project` action — typically in response to the linked issue being closed, but the Manager
  has discretion. A completed Project can be re-opened by the application user via the UI, or by
  the Manager if a new event arrives for the linked issue and the Manager judges that further work
  is warranted (e.g. the issue was re-opened, or a new comment requires attention).


## 4. Actor Model

### 4.1 Actor Interface

```
Actor
├── assignTask(task: Task): TaskHandle
├── getStatus(taskHandle: TaskHandle): TaskStatus
├── cancelTask(taskHandle: TaskHandle): void
├── askQuestion(taskHandle: TaskHandle, question: Question): Answer
└── onTaskComplete(taskHandle: TaskHandle, callback): void
```

### 4.2 Human Actor Implementation

A Human Actor receives task assignments and sends responses through a configurable **notification
channel**:
- **Application UI** — task appears in the user's task queue within the app
- **Slack** — bot sends a message with task details; human replies in thread
- **Telegram** — similar to Slack

The Human Actor implementation must:
- Format the task context into a human-readable notification
- Deliver it via the configured channel
- Listen for and collect the human's response
- Translate the response back into a structured Task result

### 4.3 AI Agent Actor Implementation

An AI Agent Actor dispatches tasks to an AI agent process. The first supported agent type is **Claude
Code**.

The AI Agent implementation must:
- Construct the appropriate prompt/context from the Task input
- Configure the agent's available tools based on safety constraints (see Section 7)
- Launch or communicate with the agent process
- Stream or collect the agent's output
- Handle clarifying questions by routing them to the user (see Section 4.4)
- Return structured results

### 4.4 Clarifying Questions

When an AI Agent needs more information to complete a task, it can ask a clarifying question. The
question is routed to the **application user** through a configurable channel:
- Application UI (question appears in the project's conversation thread)
- Slack
- Telegram

The question-answer flow:
1. AI Agent signals it has a question (via the Actor SPI)
2. System records the question in the project's conversation thread
3. User is notified via their preferred channel
4. User provides an answer
5. Answer is delivered back to the AI Agent, which resumes work

While waiting for an answer, the Task status is **Awaiting Input** and the Project remains **In
Progress**.


## 5. Event Processing Pipeline

```
External Event (GitHub/Jira webhook or poll)
        │                                          ┌──────────────────┐
        │                                          │ Internal Event   │
        │                                          │ (task-completed, │
        │                                          │  task-failed)    │
        │                                          └────────┬─────────┘
        │                                                   │
        └──────────────────┬────────────────────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Event Ingestion │──── Normalize event into internal format
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Project Lookup  │──── Find existing Project for this issue (if any)
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │    Manager       │──── Evaluate event against policies
                  │                  │     Decide: create task? ignore?
                  └────────┬─────────┘
                           │
                      ┌────┴────────────────┐
                      ▼                     ▼
                  ┌──────────┐      ┌──────────────┐
                  │  Ignore  │      │ Create Task  │──── (auto-creates Project if none exists)
                  └──────────┘      └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ Assign Actor │──── Based on action type, capabilities, policies
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ Execute Task │──── Actor performs work, may ask questions
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ Record Result│──── Update task, activity log, project status
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────────┐
                                    │ Emit Internal    │──── (optional, based on action type
                                    │ Event?           │      and configuration)
                                    └──────┬───────────┘
                                           │
                                           └──── loops back to Event Ingestion
```

All steps are recorded in the activity log, including events that were ignored (with the reason).

> **Note on internal events and infinite loops:** Because internal events feed back into the Manager
> pipeline, there is a risk of infinite loops (e.g. task-completed → new task → task-completed → ...).
> This is mitigated by: (1) internal event emission is opt-in per action type, (2) the Manager's
> policies and judgment should prevent unbounded chaining, and (3) a configurable maximum chain depth
> acts as a hard safety limit.

### 5.1 User-Initiated Actions

In addition to event-driven tasks, the application user can manually trigger actions on a Project
through the UI. User-initiated actions **bypass the Manager** — the user is explicitly choosing what
to do, so the Manager's triage role is not needed.

The flow for user-initiated actions:
1. User navigates to a Project in the UI
2. User selects an action type from the list of available actions (filtered to those marked as
   `userTriggerable` in the Action Type registry)
3. If the action type defines an `inputSchema`, the UI presents a form for the user to provide
   required input (e.g. additional instructions, target branch, scope constraints)
4. The system creates a Task directly, assigns it to an Actor (either user-selected or
   automatically chosen based on capabilities), and enters the normal task execution flow

User-initiated actions are recorded in the activity log and the project's conversation thread just
like event-driven tasks. The only difference is that the triggering source is the user rather than
an event processed by the Manager.

**Examples of user-initiated actions:**
- Asking an AI agent to implement a feature after reading its analysis
- Requesting a new analysis after the issue description has been updated
- Manually triggering a code review on a draft PR
- Asking an AI agent to propose a design before implementation


## 6. Manager Policies

Policies are **natural-language decision guidelines** that the AI Manager uses when evaluating events.
They are not rigid trigger-condition-action rules — they describe the *intent* behind a decision,
giving the Manager the context it needs to apply judgment. The Manager reads all applicable policies,
considers the event and its context, and decides what action (if any) to take.

### 6.1 Policy Structure

A policy consists of:
- **Name:** A short identifier for the policy
- **Guideline:** A natural-language description of when and why this policy applies, and what action
  the Manager should take
- **Action type:** The action type to create a Task for (e.g. `analyze`, `answer-question`,
  `auto-tag`, `implement`, `review`, `respond`)
- **Actor hint:** (Optional) A preferred actor for tasks created under this policy; the Manager may
  override based on availability and capability

### 6.2 Policy Examples

```yaml
policies:
  - name: "Answer user questions"
    guideline: >
      If the event represents a question asked by a GitHub or Jira user — for example,
      a new comment on the issue asking a clarifying question — then perform the
      "Answer Question" action. Look for question marks, phrases like "how do I",
      "can you explain", "what does X mean", or similar indicators that the user is
      seeking information.
    actionType: answer-question

  - name: "Auto-tag new issues"
    guideline: >
      If the event represents a new issue being created, perform the "Auto-tag Issue"
      action. The actor should analyze the issue title, body, and any existing labels
      to determine appropriate tags (e.g. bug, feature, documentation, good-first-issue).
    actionType: auto-tag

  - name: "Analyze new issues"
    guideline: >
      If the event represents a new issue being created, perform the "Analyze Issue"
      action. The actor should read the issue, understand the problem or request,
      assess complexity, identify affected components, and produce a summary with
      recommendations for next steps.
    actionType: analyze

  - name: "Address PR review feedback"
    guideline: >
      If the event represents review comments or feedback on a pull request that is
      linked to a tracked issue, perform the "Respond to Review" action. The actor
      should read the review comments, determine what changes are requested, and
      either make the changes or explain why they should not be made.
    actionType: respond

  - name: "Ignore bot activity"
    guideline: >
      If the event was generated by a bot account (e.g. dependabot, renovate, CI
      systems), ignore it. Do not create a task or a project for bot-generated events.
    actionType: ignore

  - name: "Close project when issue is closed"
    guideline: >
      If the event indicates that the linked GitHub or Jira issue has been closed,
      perform the "Close Project" action. The close-project task will be enqueued
      in the project's task queue and will execute after any currently pending or
      in-progress tasks complete.
    actionType: close-project

  - name: "Re-open project for activity on closed issues"
    guideline: >
      If the event is associated with an issue that is linked to a Completed project
      — for example, a new comment or the issue being re-opened — evaluate whether
      the activity warrants re-opening the project. If the comment is substantive
      (e.g. a bug report, a question, a request for changes), perform the
      "Reopen Project" action and then create an appropriate follow-up task (e.g.
      analyze, respond). If the comment is trivial (e.g. "thanks"), ignore it.
    actionType: reopen-project
```

### 6.3 How the Manager Uses Policies

- The Manager receives the full set of policies as context along with each event.
- Multiple policies may apply to a single event (e.g. a new issue triggers both "Auto-tag" and
  "Analyze"). The Manager may create multiple Tasks for a single event.
- Policies are guidelines, not commands. The Manager uses judgment to interpret edge cases —
  for example, deciding whether a comment is genuinely a question or just a statement. When the
  Manager deviates from what a policy suggests, the reasoning is logged.
- If no policy seems applicable, the Manager may still act based on its own judgment or escalate
  to the application user for guidance.
- Policies can be added, edited, or removed via the UI (see Section 8.4).


## 7. Safety & Permissions

Safety constraints are enforced at three levels, each narrowing the scope of what an actor can do.

### 7.1 Actor-Level Constraints

Defined as part of the Actor configuration. These specify the broadest set of tools and capabilities
an actor has access to.

```yaml
actors:
  - name: claude-code-agent
    type: ai-agent
    capabilities: [analyze, propose, implement, review, respond]
    permissions:
      tools: [read-file, write-file, create-branch, open-pr, run-tests, add-comment]
      restrictions:
        - no-merge
        - no-deploy
        - max-files-changed: 20
```

### 7.2 Action-Level Constraints

Each action type can further restrict the available tools. For example:

| Action Type  | Allowed Tools                                          |
|-------------|--------------------------------------------------------|
| `analyze`   | read-file, search, add-comment                         |
| `propose`   | read-file, search, add-comment (no write tools)        |
| `implement` | read-file, write-file, create-branch, open-pr          |
| `review`    | read-file, search, add-comment                         |
| `label`     | add-label, remove-label                                |

The effective tool set for a Task is the **intersection** of actor permissions and action-level
permissions.

### 7.3 Project-Level Constraints

Actions performed within a Project are scoped to that project's repository and issue. An actor working
on Project A must not be able to read or modify files belonging to Project B. This is enforced by:
- Providing the actor with a working directory scoped to the project's repository
- Restricting file system access to the relevant repository checkout
- Ensuring git operations are limited to the correct repository and branch


## 8. User Interface

The UI is the primary way users interact with the system. Key views:

### 8.1 Dashboard
- Overview of all active Projects with status indicators
- Summary of recent activity across all projects
- Alerts and notifications (clarifying questions, failed tasks, escalations)
- **Create Project**: a form allowing the user to manually create a Project by providing the
  required fields (name, description, type, issue source, issue reference, repository). The
  system validates the issue link and populates metadata from the external issue tracker.

### 8.2 Project Detail View
- Project metadata (name, description, type, status, linked issue)
- **Activity Timeline**: chronological log of all events, tasks, and decisions for this project
- **Conversation Thread**: chat-like view where actors and users communicate, including clarifying
  questions and answers
- **Task History**: list of all tasks with status, assigned actor, and results
- Active task status with real-time progress (if an actor is currently working)
- Controls: re-open project, manually trigger an action (see Section 5.1)

### 8.3 Actor Management
- List of configured actors with their type, capabilities, and permissions
- Actor health/status (is the AI agent process running?)
- Configuration editing

### 8.4 Policy Management
- List of configured policies
- Policy editor
- Policy testing (simulate an event and see what the Manager would decide)

### 8.5 Action Type Management
- List of registered action types with descriptions and configuration
- Add, edit, or remove action types
- Configure which action types are user-triggerable and what input they require
- Configure tool constraints per action type

### 8.6 Global Activity Log
- All events received by the system, including those not associated with any project
- Manager decisions (with reasoning), including events that were ignored and why
- System-level events (actor started/stopped, configuration changes)

### 8.7 Repository Management
- List of monitored repositories
- Configuration for each repository (event types to watch, polling interval, webhook setup)


## 9. Conversation Thread

Each Project has a conversation thread that serves as the communication hub for all participants
(human users, AI agents, the Manager).

Thread entries can include:
- **Manager decisions**: "Created task: analyze issue. Assigned to Claude Code Agent."
- **Actor updates**: "Starting analysis of issue #42..."
- **Clarifying questions**: "The issue mentions a 'config file' — which configuration file is being
  referred to?"
- **User responses**: answers to clarifying questions, additional context
- **Task results**: summaries of completed work
- **System messages**: status changes, errors, notifications

The thread is displayed in the Project Detail View and is the mechanism through which clarifying
questions are surfaced to users.


## 10. Notification System

Notifications alert users to events that require their attention. Supported channels:

| Channel         | Use Case                                                    |
|----------------|-------------------------------------------------------------|
| Application UI | In-app notification badge and notification center            |
| Slack          | Bot messages to a configured channel or DM                   |
| Telegram       | Bot messages to a configured chat                            |

Notification triggers (configurable by the user):
- Clarifying question from an AI agent
- Task completed or failed
- Manager escalation (low confidence decision)
- Project completed
- New project created

The user configures their preferred notification channel(s) in the application settings.


## 11. Design Decisions

Resolved questions that shaped the design.

### 11.1 Persistence

A single SQL database is sufficient for all entities (projects, tasks, actors, events, activity log).
The expected event volume is low enough that a standard relational database can handle it without
requiring a separate event store or document database. Old data can be purged periodically if storage
becomes a concern.

### 11.2 Real-Time Updates

The UI will use **Server-Sent Events (SSE)** to push live updates to the browser — task progress,
new activity log entries, project status changes, and notifications.

### 11.3 Deployment Model

The application is designed as a **locally installed, single-user application**. There is no
multi-tenancy, user authentication, or access control in the initial version. Multi-user support
can be added later if needed.

### 11.4 AI Agent Execution Model

Each Project maintains its own **independent git clone** of its associated repository as a working
directory. Even if multiple Projects are linked to issues in the same repository, each gets a
separate clone. This prevents PR pollution and working directory conflicts across Projects.

Key constraints:

- **Tasks within a Project are serialized** — they cannot execute in parallel. This means Tasks
  for the same Project share the cloned working directory safely.
- **Tasks across different Projects may execute in parallel**, provided there are enough available
  AI Agent instances.
- **Task ordering within a single event:** When the Manager creates multiple Tasks from one event
  (e.g. both "Auto-tag" and "Analyze" for a new issue), the execution order is not guaranteed.
  These tasks are enqueued and executed serially within the project, but in arbitrary order.
- The execution model (long-lived agent subprocess vs. launched per-task) is a technical
  architecture decision to be resolved separately.

### 11.5 Event Processing Order

The Manager processes events **one at a time, sequentially**. An event queue ensures that events
are handled in order and that the Manager is not overwhelmed by bursts of activity. This eliminates
the risk of the Manager creating duplicate or conflicting tasks for the same project from
near-simultaneous events.

### 11.6 Rate Limiting

**Open question.** AI agents operating autonomously need guardrails to prevent runaway resource
consumption. Possible approaches include:
- Maximum task duration (kill an agent that runs longer than a configurable timeout)
- Maximum number of concurrent agent instances
- Per-project task budget (e.g. no more than N tasks per hour for a single project)
- Cost tracking if the AI provider charges per-token

This will be refined during technical architecture.

### 11.7 Technology Stack

Out of scope for this functional design document. A separate technical architecture document will
cover framework choices, deployment topology, and infrastructure decisions.
