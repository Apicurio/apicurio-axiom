# AI-Assisted Tool Editing

## Overview

Apicurio Axiom includes an AI-assisted editing feature for script tools. Users can
describe what they want a tool to do in natural language, and Claude Code generates
the complete tool definition — name, description, parameters, and script template —
automatically. The feature supports iterative refinement: users can ask for changes
in follow-up messages, and the AI updates the tool definition accordingly.

## User Experience

### Accessing the Feature

From any script tool's detail page, click the **AI Assistant** button (magic wand icon)
in the page header. A chat panel slides in from the right side of the page alongside
the existing tabs.

### Using the Chat Panel

The panel provides a conversational interface:

1. **Describe the tool**: Type a natural language description like "Create a tool that
   lists open pull requests in a GitHub repository"
2. **AI generates the tool**: Claude Code produces the name, description, parameters,
   and script template. These are applied directly to the form — the standard tabs
   (Info, Parameters, Script Template) update live.
3. **Iterate**: Ask for refinements like "Add a filter for the author" or "Change the
   output format to JSON". Each message sends the current tool state as context, so
   the AI understands what exists and what to change.
4. **Review and save**: Switch between tabs to review the generated definition. The
   form is marked as dirty (unsaved) after AI changes. Click **Save Changes** when
   satisfied.

### Layout

The chat panel (380px wide) sits to the right of the tabs in a side-by-side layout.
When the panel is closed, the tabs take the full page width as usual. Both views are
always accessible — there's no mode switch that hides the standard editing experience.

```
┌──────────────────────────────────────────────┐
│ my_tool                    [Save] [AI Asst]  │
│ ┌──────┬────────┬──────┐  ┌───────────────┐  │
│ │ Info │ Params │Script│  │ AI Assistant   │  │
│ ├──────┴────────┴──────┤  ├───────────────┤  │
│ │                      │  │ You: Create   │  │
│ │ (tab content         │  │ a tool that   │  │
│ │  updates live as     │  │ lists PRs...  │  │
│ │  AI makes changes)   │  │               │  │
│ │                      │  │ AI: Done! I   │  │
│ │                      │  │ created...    │  │
│ │                      │  │               │  │
│ │                      │  │ [Message...]  │  │
│ └──────────────────────┘  └───────────────┘  │
└──────────────────────────────────────────────┘
```

## Architecture

### Backend

#### REST Endpoint

```
POST /api/v1/tools/ai-edit
```

**Request body (`ToolAiEditRequest`):**
```json
{
  "message": "Create a tool that lists open pull requests",
  "currentTool": {
    "name": "...",
    "description": "...",
    "parameters": [...],
    "scriptTemplate": "..."
  }
}
```

**Response body (`ToolAiEditResponse`):**
```json
{
  "tool": {
    "name": "list_pull_requests",
    "description": "Lists open pull requests in a GitHub repository",
    "parameters": [
      { "name": "repo", "type": "string", "description": "Repository in owner/name format", "required": true }
    ],
    "scriptTemplate": "gh pr list --repo {{repo}} --state open --json number,title,author"
  },
  "explanation": "I created a tool with 1 parameter (repo) that uses the gh CLI..."
}
```

#### ToolAiService

`app/src/main/java/io/apicurio/axiom/app/ToolAiService.java`

This service follows the same Claude Code invocation pattern used by `ManagerService`:

1. **System prompt**: Defines Claude's role as a tool definition editor, describes the
   tool schema (name, description, parameters with types, scriptTemplate with
   `{{placeholder}}` syntax), and provides guidance on bash scripting patterns.

2. **User prompt**: Includes the current tool definition (if editing an existing tool)
   formatted as a readable summary, followed by the user's message.

3. **Structured output**: Uses `--json-schema` to enforce a response containing `name`,
   `description`, `parameters` (array), `scriptTemplate`, and `explanation`.

4. **Execution**: Invokes `ClaudeCodeSubprocess` with `--max-turns 3` and a 60-second
   timeout. Only `StructuredOutput` tool is allowed (no file system access).

5. **Usage tracking**: Records the invocation in `AiUsageEntity` with
   `invocationType="tool-edit"` and `actionType="tool-ai-edit"`.

### Frontend

#### ToolAiPanel Component

`ui/src/components/ToolAiPanel.tsx`

A self-contained chat panel component with:

- **Props**: `form` (current tool state), `params` (current parameters),
  `onUpdate(form, params)` (callback to apply changes), `onClose()`
- **State**: Chat message history, input text, loading indicator
- **Behavior**: On send, calls `POST /tools/ai-edit` with the message and current
  tool state. On response, adds the AI's explanation to the chat history and calls
  `onUpdate` with the generated tool definition, which updates the parent form state.

Messages are displayed in a scrollable list with user messages right-aligned (blue)
and AI responses left-aligned (grey, rendered as markdown). A "Thinking..." indicator
appears while the AI is processing.

#### ToolDetailPage Integration

`ui/src/pages/ToolDetailPage.tsx`

The detail page wraps the existing tabs and the AI panel in a flex container. The
`aiPanelOpen` state controls visibility. When the AI panel calls `onUpdate`, the
page's `form` and `params` state update, which causes the standard tabs to re-render
with the new values. The `dirty` flag is set to `true`, enabling the Save button.

## Cost Tracking

Every AI-assisted edit invocation is recorded in the `ai_usage` table with:
- `invocation_type`: "tool-edit"
- `action_type`: "tool-ai-edit"
- `cost_usd`, `input_tokens`, `output_tokens`: captured from Claude Code

This data is visible on the AI Usage page alongside task executions and manager
evaluations.

## Limitations and Future Work

- **No session continuity**: Each message is a standalone invocation. Claude Code
  doesn't maintain conversation context across messages — the current tool state
  is sent each time as context instead.
- **Script-only**: The AI Assistant button only appears for script-type tools, not
  MCP server tools.
- **No undo history**: The form supports a single level of undo (revert to the
  last saved state by reloading). Individual AI change steps are not tracked.
- **Future**: Could add session-based multi-turn conversations using Claude Code's
  `--session-id` flag for richer iterative editing.
