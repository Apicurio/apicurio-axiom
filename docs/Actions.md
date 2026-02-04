# Actions

Actions define the automated tasks that are executed when GitHub events occur. Each action specifies how and
what should be executed in response to matched events.

## Configuration Structure

Actions are configured in `config.yaml` under the `actions` section:

```yaml
actions:
  # Shell action
  action-name-1:
    type: shell
    command: ./scripts/my-script.sh

  # JavaScript action
  action-name-2:
    type: javascript
    code: ./actions/my-action.js
```

### Fields

- **Action Name** (key): Unique identifier for the action, referenced in event mappings.
- **type** (required): The action type - `shell`, `javascript`, or `ai-agent`.
- **command** (required for shell): The shell command or script to execute.
- **code** (required for javascript): Path to the JavaScript module to execute.
- **prompt** (required for ai-agent): Name of the prompt to use (corresponds to file in `src/agent/prompts/`).
- **tools** (required for ai-agent): Array of tool names the agent can use.
- **model** (optional for ai-agent): Override the default Claude model.

## Action Types

### 1. Shell Actions

Shell actions execute bash commands or scripts in an isolated work directory with access to event data via
environment variables.

#### Configuration

```yaml
actions:
  my-shell-action:
    type: shell
    command: ./scripts/process-event.sh
```

#### Features

- **Work Directory**: Each action execution gets a dedicated work directory under `workDirectory.basePath`.
- **Environment Variables**: Event data is automatically injected as environment variables.
- **PTY Support**: Runs in a pseudo-terminal for interactive script support.
- **Streaming Output**: Output is streamed in real-time to log files.
- **GitHub CLI**: Use the `gh` CLI tool for GitHub API operations.

#### Environment Variables

The following environment variables are automatically provided to shell actions:

**Always Available:**
- `EVENT_ID` - Unique identifier for the event
- `EVENT_TYPE` - Event type (e.g., `issue.opened`)
- `EVENT_REPOSITORY` - Full repository name (`owner/repo`)
- `EVENT_REPOSITORY_OWNER` - Repository owner
- `EVENT_REPOSITORY_NAME` - Repository name
- `EVENT_ACTOR` - User who triggered the event
- `EVENT_CREATED_AT` - Event timestamp
- `WORK_DIR` - Current work directory path
- `GITHUB_TOKEN` - GitHub API token (from config)

**Issue Events:**
- `EVENT_ISSUE_NUMBER` - Issue number
- `EVENT_ISSUE_TITLE` - Issue title
- `EVENT_ISSUE_STATE` - Issue state (`open` or `closed`)
- `EVENT_ISSUE_LABELS` - Comma-separated list of labels
- `EVENT_ISSUE_AUTHOR` - Issue author username
- `EVENT_ISSUE_URL` - Issue URL

**Pull Request Events:**
- `EVENT_PR_NUMBER` - Pull request number
- `EVENT_PR_TITLE` - Pull request title
- `EVENT_PR_STATE` - Pull request state (`open` or `closed`)
- `EVENT_PR_LABELS` - Comma-separated list of labels
- `EVENT_PR_AUTHOR` - Pull request author username
- `EVENT_PR_URL` - Pull request URL
- `EVENT_PR_DRAFT` - Draft status (`true` or `false`)

**Discussion Events:**
- `EVENT_DISCUSSION_NUMBER` - Discussion number
- `EVENT_DISCUSSION_TITLE` - Discussion title
- `EVENT_DISCUSSION_CATEGORY` - Discussion category name
- `EVENT_DISCUSSION_AUTHOR` - Discussion author username
- `EVENT_DISCUSSION_URL` - Discussion URL

**Comment Events:**
- `EVENT_COMMENT_AUTHOR` - Comment author username
- `EVENT_COMMENT_URL` - Comment URL
- `EVENT_COMMENT_BODY` - Comment text content

**Label Events:**
- `EVENT_LABEL` - Label name that was added/removed

#### Example Shell Action

```bash
#!/bin/bash
# scripts/label-issue.sh

echo "Processing issue #$EVENT_ISSUE_NUMBER: $EVENT_ISSUE_TITLE"
echo "Repository: $EVENT_REPOSITORY"
echo "Author: $EVENT_ISSUE_AUTHOR"

# Add labels using GitHub CLI
gh issue edit "$EVENT_ISSUE_NUMBER" \
    --repo "$EVENT_REPOSITORY" \
    --add-label "automated"

if [ $? -eq 0 ]; then
    echo "Successfully labeled issue"
else
    echo "Failed to add label"
    exit 1
fi
```

### 2. JavaScript Actions

JavaScript actions execute Node.js code with full access to the Node.js API and event data passed as a
parameter.

#### Configuration

```yaml
actions:
  my-js-action:
    type: javascript
    code: ./actions/my-action.js
```

#### Features

- **Node.js Support**: Full access to Node.js APIs and npm packages.
- **Event Object**: Event data passed as parameter to the action function.
- **Console Capture**: Console output is captured and logged.
- **Async/Await**: Supports asynchronous operations.
- **Module Format**: Uses ES6 module syntax (export default).

#### Event Object Structure

JavaScript actions receive an event object with the following structure:

```javascript
{
  id: string,
  type: string,              // e.g., "issue.opened"
  repository: string,        // e.g., "owner/repo"
  repositoryOwner: string,
  repositoryName: string,
  actor: string,             // User who triggered event
  createdAt: string,
  payload: object,           // Raw GitHub payload
  rawEvent: object,

  // Issue-specific (for issue events)
  issue: {
    number: number,
    title: string,
    state: string,
    labels: string[],
    author: string,
    url: string
  },

  // PR-specific (for pull_request events)
  pullRequest: {
    number: number,
    title: string,
    state: string,
    labels: string[],
    author: string,
    url: string,
    draft: boolean
  },

  // Discussion-specific (for discussion events)
  discussion: {
    number: number,
    title: string,
    category: string,
    author: string,
    url: string
  },

  // Comment-specific (for comment events)
  comment: {
    body: string,
    author: string,
    url: string
  },

  // Label-specific (for label events)
  label: string
}
```

#### Example JavaScript Action

```javascript
// actions/welcome-contributor.js

export default async function welcomeContributor(event) {
    console.log('=== Welcome Contributor Action ===');
    console.log(`PR: ${event.pullRequest.title}`);
    console.log(`Author: ${event.pullRequest.author}`);
    console.log(`Repository: ${event.repository}`);

    // Example: Post a welcome comment using Octokit
    // const { Octokit } = await import('@octokit/rest');
    // const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    //
    // await octokit.issues.createComment({
    //     owner: event.repositoryOwner,
    //     repo: event.repositoryName,
    //     issue_number: event.pullRequest.number,
    //     body: `Thanks for your contribution, @${event.pullRequest.author}! 🎉`
    // });

    console.log('Welcome message would be posted here');
}
```

#### Alternative Export Format

JavaScript actions can also export a `run` function:

```javascript
// actions/my-action.js

export async function run(event) {
    console.log('Processing event:', event.type);
    // Action logic here
}
```

### 3. AI Agent Actions

AI Agent actions use Claude AI (via Google Cloud Vertex AI) with a custom tool system to perform intelligent
analysis and automation. This AI Agent action type provides full control over the agent loop, transparent and
constrained tool execution, and comprehensive logging.

#### Configuration

```yaml
vertexAI:
  projectId: ${ANTHROPIC_VERTEX_PROJECT_ID}
  region: us-east5
  model: claude-sonnet-4-5@20250929
  safety:
    maxSteps: 20
    maxToolCalls: 50
    maxTokens: 100000

actions:
  label-issue-ai:
    type: ai-agent
    prompt: label-issue
    tools:
      - github-get_issue_details
      - github-get_repository_labels
      - github-add_labels
```

#### Features

- **Custom AI Agent Runtime**: Full control over the agent execution loop
- **Tool-Based Workflow**: Agent uses explicit tools for reading data and taking actions
- **Safety Limits**: Configurable limits on steps, tool calls, and token usage
- **Dry-Run Mode**: Test agent behavior without making actual changes
- **Comprehensive Logging**: Detailed logs of agent reasoning, tool calls, and results
- **Task-Specific Prompts**: Reusable prompts for common workflows
- **Vertex AI Integration**: Enterprise-grade infrastructure via Google Cloud

#### How It Works

1. **Event triggers** the ai-agent action
2. **Task prompt** is loaded from `src/agent/prompts/{task}.ts`
3. **Tool registry** is built with the specified tools
4. **Agent runtime** executes the agent loop:
   - Sends message to Claude (via Vertex AI)
   - Claude decides which tools to use
   - Tools are executed and results returned to Claude
   - Claude continues until task is complete
5. **Results logged** with full execution details

#### Available Tools

Tools are organized by namespace using dashes for separation. You can use wildcard patterns to match multiple tools (e.g., `github-*`, `git-*`, `repository-*`).

**Repository Tools** (file system operations):
- `repository-read_file` - Read file contents from repository
- `repository-list_files` - List files in directory (with recursive option)
- `repository-search_code` - Search for patterns in code using grep

**Git Tools** (git operations):
- `git-status` - Get git repository status
- `git-diff` - Get git diff output
- `git-log` - Get commit history with filtering
- `git-create_branch` - Create new git branch

**GitHub Read Tools** (read-only GitHub API operations):
- `github-get_issue_details` - Get GitHub issue information
- `github-get_repository_labels` - List available repository labels
- `github-get_discussion_details` - Get GitHub discussion information (requires number)
- `github-get_discussion` - Get current GitHub discussion information
- `github-get_milestones` - List repository milestones

**GitHub Write Tools** (GitHub API operations that make changes):
- `github-add_labels` - Add labels to issue or PR
- `github-add_comment` - Post comment on issue or PR
- `github-add_discussion_response` - Post response to discussion
- `github-create_issue` - Create new GitHub issue
- `github-create_pull_request` - Create pull request (assumes branch pushed)
- `github-close_issue` - Close an issue
- `github-assign_issue` - Assign users to issue
- `github-set_issue_milestone` - Set issue milestone
- `github-open_pull_request` - Complete PR workflow (commit + push + create PR)

**Tool Pattern Matching:**

You can use wildcard patterns to grant access to multiple tools at once:

```yaml
tools:
  - github-*          # All GitHub tools (read and write)
  - git-*             # All git tools
  - repository-*      # All repository tools
  - "*"               # All available tools (use with caution)
  - github-get_*      # All GitHub read tools starting with "get_"
  - "*-add_*"         # All tools with "add_" in the name
```

Patterns can be mixed with specific tool names:

```yaml
tools:
  - git-*                         # All git tools
  - github-get_issue_details      # Specific GitHub tool
  - repository-read_file          # Specific repository tool
```

#### Task Prompts

Task prompts are TypeScript modules in `src/agent/prompts/` that export a system prompt:

**Available Prompts:**

1. **`label-issue`** - Automatic issue labeling
   ```yaml
   actions:
     auto-label:
       type: ai-agent
       prompt: label-issue
       tools:
         - github-get_issue_details
         - github-get_repository_labels
         - github-add_labels
   ```

2. **`analyze-issue`** - In-depth issue analysis
   ```yaml
   actions:
     analyze:
       type: ai-agent
       prompt: analyze-issue
       tools:
         - github-get_issue_details
         - repository-*
         - github-add_comment
         - github-add_labels
   ```

3. **`test-comment`** - Simple test comment on issues
   ```yaml
   actions:
     test-comment:
       type: ai-agent
       prompt: test-comment
       tools:
         - github-get_issue_details
         - github-add_comment
   ```

4. **`discussion`** - Participate in GitHub discussions
   ```yaml
   actions:
     ai-discuss:
       type: ai-agent
       prompt: discussion
       tools:
         - github-get_discussion
         - github-add_discussion_response
         - repository-*  # Access to repository tools if needed
   ```

**Creating Custom Prompts:**

```typescript
// src/agent/prompts/my-custom-task.ts

import { BASE_SYSTEM_PROMPT } from './base.js';

export const MY_CUSTOM_PROMPT = `${BASE_SYSTEM_PROMPT}

# Task: Custom Task Description

Your goal is to...

## Process

1. First step...
2. Second step...
3. Final step...

## Guidelines

- Be specific
- Provide clear instructions
- Explain expected behavior
`;

export default MY_CUSTOM_PROMPT;
```

#### Dry-Run Mode

Test agent behavior without making actual changes:

```bash
# Start in dry-run mode
npm start -- --dry-run
```

In dry-run mode:
- **Read-only tools** execute normally
- **Write tools** return simulated results
- All tool calls are logged with `[DRY-RUN]` prefix
- Safe to test prompts and tool configurations

#### Safety Configuration

Configure safety limits in `config.yaml`:

```yaml
vertexAI:
  safety:
    maxSteps: 20        # Maximum agent loop iterations
    maxToolCalls: 50    # Maximum tool executions
    maxTokens: 100000   # Maximum total tokens
```

Limits prevent:
- Infinite loops
- Excessive API costs
- Runaway automation

#### Model Selection

Override the default model per-action:

```yaml
actions:
  simple-labeling:
    type: ai-agent
    prompt: label-issue
    model: claude-sonnet-4-5@20250929  # Fast, cost-effective
    tools: [github-get_issue_details, github-add_labels]

  complex-analysis:
    type: ai-agent
    prompt: analyze-issue
    model: claude-opus-4-5@20251101    # More capable, higher cost
    tools: [github-*, repository-*, git-log]
```

#### Example Configurations

**Example 1: Simple Issue Labeling**

```yaml
actions:
  auto-label-issues:
    type: ai-agent
    prompt: label-issue
    tools:
      - github-get_issue_details
      - github-get_repository_labels
      - github-add_labels

events:
  issue.opened:
    actions:
      - auto-label-issues
```

**Example 2: Comprehensive Issue Analysis**

```yaml
actions:
  analyze-new-issues:
    type: ai-agent
    prompt: analyze-issue
    tools:
      - github-*       # All GitHub tools
      - repository-*   # All repository tools
      - git-log        # Specific git tool
    model: claude-opus-4-5@20251101

events:
  issue.opened:
    actions:
      - analyze-new-issues
    filters:
      - path: payload.issue.labels
        any:
          name: automated
        # Exclude issues already labeled as automated
```

**Example 3: Bug Triage Workflow**

```yaml
actions:
  triage-bugs:
    type: ai-agent
    prompt: label-issue
    tools:
      - github-get_issue_details
      - github-get_repository_labels
      - repository-search_code
      - git-log
      - github-add_labels
      - github-add_comment

events:
  issue.labeled:
    filters:
      - path: payload.label.name
        equals: type/bug
    actions:
      - triage-bugs
```

**Example 4: Discussion Participation**

```yaml
actions:
  participate-in-discussions:
    type: ai-agent
    prompt: discussion
    tools:
      - github-get_discussion
      - github-add_discussion_response
      - repository-*  # Allow repository exploration

events:
  discussion.created:
    actions:
      - participate-in-discussions
```

#### Logging

Agent execution logs include detailed information about each step, including which tools were called and with what arguments:

```
Starting AI agent with prompt: label-issue
Tools: github-get_issue_details, github-get_repository_labels, github-add_labels
Work directory: /path/to/work/dir

Configured 3 tools

Goal: Analyze GitHub issue #123: "Bug in auth flow"

--- Step 1 ---
Stop reason: tool_use
Tokens: 1234 in, 456 out
Tools called: 1
  - Tool: github-get_issue_details
    Input: {}

--- Step 2 ---
Stop reason: tool_use
Tokens: 890 in, 234 out
Tools called: 1
  - Tool: github-add_labels
    Input: {
      "labels": [
        "type/bug",
        "needs-triage"
      ]
    }

--- Step 3 ---
Stop reason: end_turn
Tokens: 567 in, 123 out

=== Agent Execution Complete ===
Status: SUCCESS
Steps taken: 3
Tool calls: 2
Tokens used: 3504 (2691 in, 813 out)

=== Agent Final Response ===
I've analyzed the issue and applied the following labels:
- type/bug
- needs-triage

The issue describes an authentication failure in the login flow...
```

#### Best Practices

1. **Start with dry-run mode**
   - Always test new prompts in dry-run first
   - Verify tool calls are appropriate
   - Check agent reasoning before running live

2. **Use minimal tool sets**
   - Only provide tools the agent needs
   - More tools = more complexity for the agent
   - Start small and add tools as needed

3. **Choose the right model**
   - Use Sonnet for simple, structured tasks
   - Use Opus for complex analysis and reasoning
   - Consider cost vs capability tradeoffs

4. **Monitor token usage**
   - Check logs for token consumption
   - Optimize prompts to reduce tokens
   - Use appropriate safety limits

5. **Create reusable prompts**
   - Write clear, specific instructions
   - Include examples in prompts
   - Test prompts with various inputs

6. **Handle errors gracefully**
   - Agent logs include failure reasons
   - Safety limits prevent runaway execution
   - Tools return structured error messages

7. **Security considerations**
   - Tool allow-lists prevent unauthorized actions
   - Work directory isolation
   - No file system access outside work directory
   - All GitHub operations use authenticated API

## Action Execution

### Work Directories

Each shell action execution gets a dedicated work directory:

```
{workDirectory.basePath}/
  └── {owner}/
      └── {repo}/
          └── {timestamp}_{event-id}_{action-name}/
```

This directory is:
- Created automatically before action execution
- Available via the `$WORK_DIR` environment variable
- Cleaned up based on `workDirectory.maxSizeGB` and `workDirectory.cleanupThresholdPercent`
- Base path configurable via `workDirectory.basePath` in `config.yaml` (default: `./work/`)

### Logging

All action output is logged to:

```
{logging.basePath}/{owner}/{repo}/{timestamp}_{event-id}_{action-name}.log
```

Log files include:
- Action metadata (event type, repository, timestamp)
- Real-time action output (stdout and stderr)
- Execution status (success or failure)
- Execution duration

Log retention is controlled by `logging.retentionDays` in the configuration. The log directory can be configured via `logging.basePath` in `config.yaml` (default: `./logs/`).

### Job Queue

Actions are executed through a persistent job queue with the following characteristics:

- **Concurrency**: Controlled by `queue.maxConcurrent` (default: 3)
- **Ordering**: FIFO (first-in, first-out)
- **Persistence**: Jobs survive application restarts
- **Polling**: Queue is checked every `queue.pollInterval` seconds
- **Status Tracking**: Jobs are marked as pending → running → completed/failed

Configure the queue in `config.yaml`:

```yaml
queue:
  # Maximum number of concurrent actions to execute
  maxConcurrent: 3

  # How often to check the queue for pending jobs (seconds)
  pollInterval: 5
```

## Complete Examples

### Example 1: Simple Logging Action

```yaml
actions:
  log-all-events:
    type: shell
    command: echo "[$(date)] Event detected - Type=$EVENT_TYPE Repo=$EVENT_REPOSITORY Actor=$EVENT_ACTOR"
```

### Example 2: Issue Labeling Script

```yaml
actions:
  label-bug-issues:
    type: shell
    command: ./scripts/label-bug.sh
```

```bash
#!/bin/bash
# scripts/label-bug.sh

# Get issue body using GitHub CLI
ISSUE_BODY=$(gh issue view "$EVENT_ISSUE_NUMBER" --repo "$EVENT_REPOSITORY" --json body -q .body)

# Check if issue contains "bug" keywords
if echo "$EVENT_ISSUE_TITLE $ISSUE_BODY" | grep -iE "bug|error|crash|broken"; then
    gh issue edit "$EVENT_ISSUE_NUMBER" \
        --repo "$EVENT_REPOSITORY" \
        --add-label "type/bug"
    echo "Added bug label"
fi
```

### Example 3: JavaScript Welcome Action

```yaml
actions:
  welcome-contributor:
    type: javascript
    code: ./actions/welcome-contributor.js
```

```javascript
// actions/welcome-contributor.js

export default async function welcomeContributor(event) {
    console.log(`Welcoming contributor: ${event.pullRequest.author}`);

    // Check if first-time contributor
    // Post welcome comment
    // Notify team

    console.log('Welcome process completed');
}
```

## Best Practices

1. **Choose the right action type**:
   - Use **AI Agent** for intelligent analysis, decision-making, and automation
   - Use **shell** for simple scripts and straightforward GitHub API operations
   - Use **JavaScript** for complex logic, npm package integration, and custom workflows

2. **Handle errors gracefully**:
   - Shell: Exit with non-zero status code on failure
   - JavaScript: Throw errors or reject promises
   - Always log meaningful error messages

3. **Keep actions focused**:
   - Each action should do one thing well
   - Use multiple actions in event mappings for complex workflows

4. **Use the GitHub CLI**:
   - Leverage the `gh` CLI for GitHub API operations
   - Create reusable shell functions for common patterns

5. **Test incrementally**:
   - Test actions individually before adding to event mappings
   - Use manual script execution for initial testing
   - Monitor logs for debugging

6. **Respect rate limits**:
   - Be mindful of GitHub API rate limits
   - Use conditional logic to avoid unnecessary API calls
   - Consider caching when appropriate

7. **Security considerations**:
   - Never log sensitive data (tokens, credentials)
   - Validate input from event data
   - Use least-privilege principles for GitHub permissions
   - Be careful with user-supplied content in commands

8. **Performance optimization**:
   - Keep actions fast to avoid queue buildup
   - Use concurrency settings appropriately
   - Clean up work directories regularly
   - Monitor log retention to avoid disk issues

9. **AI Agent specific**:
   - Always test in dry-run mode first
   - Provide minimal tool sets (only what's needed)
   - Choose appropriate model (Sonnet for simple tasks, Opus for complex)
   - Monitor token usage and adjust limits as needed
   - Create reusable task prompts for common workflows
   - Use safety limits to prevent runaway automation
