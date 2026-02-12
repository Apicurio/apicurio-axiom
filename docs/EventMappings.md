# Event Mappings

Event mappings define how the bot responds to GitHub events. Each mapping connects a GitHub event type to one
or more actions that should be executed when that event occurs.

## Configuration Structure

Event mappings are configured in `config.yaml` under the `eventMappings` section:

```yaml
eventMappings:
  - event: issue.opened
    filters:  # Optional
      - label: bug
      - state: open
      - author: username
      - draft: false  # For PRs only
    repository: owner/repo  # Optional - filter by specific repo
    actions:
      - action-name-1
      - action-name-2
```

### Fields

- **event** (required): The event type to match. Supports exact matches and wildcard patterns.
- **filters** (optional): Array of filter objects for fine-grained event filtering.
- **repository** (optional): Limit this mapping to a specific repository (format: `owner/repo`).
- **actions** (required): Array of action names to execute when the event matches.

## Event Types

The following table lists all available event types supported by the bot:

| Event Type | Description |
|------------|-------------|
| `issue.opened` | A new issue was created |
| `issue.closed` | An issue was closed |
| `issue.reopened` | A closed issue was reopened |
| `issue.labeled` | A label was added to an issue |
| `issue.unlabeled` | A label was removed from an issue |
| `issue.assigned` | An issue was assigned to someone |
| `issue.unassigned` | An issue was unassigned from someone |
| `issue.edited` | An issue's title or body was edited |
| `issue.deleted` | An issue was deleted |
| `issue.transferred` | An issue was transferred to another repository |
| `issue.pinned` | An issue was pinned |
| `issue.unpinned` | An issue was unpinned |
| `issue.locked` | An issue was locked |
| `issue.unlocked` | An issue was unlocked |
| `pull_request.opened` | A new pull request was created |
| `pull_request.closed` | A pull request was closed (merged or not) |
| `pull_request.reopened` | A closed pull request was reopened |
| `pull_request.synchronize` | New commits were pushed to a pull request |
| `pull_request.labeled` | A label was added to a pull request |
| `pull_request.unlabeled` | A label was removed from a pull request |
| `pull_request.assigned` | A pull request was assigned to someone |
| `pull_request.unassigned` | A pull request was unassigned from someone |
| `pull_request.edited` | A pull request's title or body was edited |
| `pull_request.ready_for_review` | A draft pull request was marked as ready |
| `pull_request.converted_to_draft` | A pull request was converted to draft |
| `pull_request.review_requested` | A review was requested on a pull request |
| `pull_request.review_request_removed` | A review request was removed |
| `issue_comment.created` | A comment was added to an issue or pull request |
| `issue_comment.edited` | A comment was edited |
| `issue_comment.deleted` | A comment was deleted |
| `pull_request_review.submitted` | A pull request review was submitted |
| `pull_request_review.edited` | A pull request review was edited |
| `pull_request_review.dismissed` | A pull request review was dismissed |
| `pull_request_review_comment.created` | A comment was added to a pull request review |
| `pull_request_review_comment.edited` | A review comment was edited |
| `pull_request_review_comment.deleted` | A review comment was deleted |
| `discussion.created` | A new discussion was created |
| `discussion.edited` | A discussion was edited |
| `discussion.deleted` | A discussion was deleted |
| `discussion.answered` | A discussion was marked as answered |
| `discussion.unanswered` | A discussion was marked as unanswered |
| `discussion.labeled` | A label was added to a discussion |
| `discussion.unlabeled` | A label was removed from a discussion |
| `discussion.locked` | A discussion was locked |
| `discussion.unlocked` | A discussion was unlocked |
| `discussion.pinned` | A discussion was pinned |
| `discussion.unpinned` | A discussion was unpinned |
| `discussion.transferred` | A discussion was transferred to another repository |
| `discussion.category_changed` | A discussion's category was changed |
| `discussion_comment.created` | A comment was added to a discussion |
| `discussion_comment.edited` | A discussion comment was edited |
| `discussion_comment.deleted` | A discussion comment was deleted |
| `push` | Commits were pushed to a repository |
| `release.published` | A release was published |
| `release.created` | A release was created |
| `release.edited` | A release was edited |
| `release.deleted` | A release was deleted |
| `release.prereleased` | A pre-release was created |
| `release.released` | A release was released |
| `create` | A branch or tag was created |
| `fork` | A repository was forked |

## Wildcard Patterns

Event types support wildcard patterns for matching multiple events:

- **`*`** - Matches all events
- **`issue.*`** - Matches all issue events (opened, closed, labeled, etc.)
- **`pull_request.*`** - Matches all pull request events
- **`discussion.*`** - Matches all discussion events (created, edited, answered, etc.)
- **`discussion_comment.*`** - Matches all discussion comment events
- **`issue_comment.*`** - Matches all issue comment events
- **`pull_request_review.*`** - Matches all pull request review events
- **`release.*`** - Matches all release events

### Example

```yaml
eventMappings:
  # Match all issue events
  - event: issue.*
    actions:
      - log-issue-event

  # Match all events for monitoring
  - event: "*"
    actions:
      - monitor-activity
```

## Filters

Filters allow you to narrow down which events trigger actions based on event properties. Multiple filters
are combined with AND logic (all must match).

The bot supports two filter syntaxes:
1. **Legacy syntax** - Simple, backwards-compatible filters for common cases
2. **Path-based syntax** - Powerful, flexible filters for any event property

### Path-Based Filters (Recommended)

Path-based filters allow you to match against any property in the GitHub event JSON using dot notation.

#### Basic Syntax

```yaml
filters:
  - path: property.path.here
    matcher: value
```

**Available Matchers:**

| Matcher | Description | Example |
|---------|-------------|---------|
| `equals` | Exact match | `equals: "bot/enabled"` |
| `contains` | String contains substring | `contains: "WIP"` |
| `matches` | Regex pattern match | `matches: "^v\\d+\\.\\d+\\.\\d+$"` |
| `startsWith` | String starts with | `startsWith: "feat:"` |
| `endsWith` | String ends with | `endsWith: ".md"` |
| `in` | Value is in array | `in: ["open", "reopened"]` |
| `exists` | Property exists | `exists: true` |
| `greaterThan` | Numeric comparison | `greaterThan: 100` |
| `lessThan` | Numeric comparison | `lessThan: 10` |
| `any` | Any array element matches | `any: { name: "bug" }` |
| `all` | All array elements match | `all: { verified: true }` |

#### Common Path Examples

**Check the specific label that was added:**
```yaml
- event: issue.labeled
  filters:
    - path: payload.label.name
      equals: bot/enabled
  actions:
    - auto-label-issue
```

**Check who triggered the event:**
```yaml
- path: actor.login
  equals: dependabot[bot]
```

**Check if issue title contains a keyword:**
```yaml
- path: payload.issue.title
  contains: "[WIP]"
```

**Check if issue has any label matching criteria:**
```yaml
- path: payload.issue.labels
  any:
    name: bug
```

**Check if PR has more than 10 commits:**
```yaml
- path: payload.pull_request.commits
  greaterThan: 10
```

**Match against nested properties:**
```yaml
- path: payload.issue.user.login
  equals: octocat
```

### Legacy Filters (Backwards Compatible)

These simple filters are still supported for common use cases:

#### Label Filter

Match events based on whether a specific label is present in the issue/PR labels list:

```yaml
filters:
  - label: bug
```

**Note:** This checks if "bug" exists in the current labels array. To check the specific label that was
just added/removed, use the path-based filter: `path: payload.label.name`

Works with: `issue.*` and `pull_request.*` events

#### State Filter

Match events based on the current state of the issue or pull request:

```yaml
filters:
  - state: open  # or "closed"
```

Works with: `issue.*` and `pull_request.*` events

#### Author Filter

Match events based on who triggered the event:

```yaml
filters:
  - author: octocat
```

Works with: All events

#### Draft Filter

Match pull requests based on their draft status:

```yaml
filters:
  - draft: false  # true for draft PRs, false for ready PRs
```

Works with: `pull_request.*` events only

### Filter Examples

**Example 1: Check specific label added (path-based)**
```yaml
eventMappings:
  # Only trigger when "bot/enabled" label is specifically added
  - event: issue.labeled
    filters:
      - path: payload.label.name
        equals: bot/enabled
    actions:
      - auto-label-issue
```

**Example 2: Check if issue has any label matching criteria (path-based)**
```yaml
eventMappings:
  # Process issues that have a "bug" label
  - event: issue.opened
    filters:
      - path: payload.issue.labels
        any:
          name: bug
    actions:
      - analyze-bug
```

**Example 3: Complex nested path and string matching**
```yaml
eventMappings:
  # Match PRs from dependabot with title containing "bump"
  - event: pull_request.opened
    filters:
      - path: payload.pull_request.user.login
        equals: dependabot[bot]
      - path: payload.pull_request.title
        contains: bump
    actions:
      - auto-review-dependency
```

**Example 4: Numeric comparisons**
```yaml
eventMappings:
  # Only process large PRs (more than 50 commits)
  - event: pull_request.opened
    filters:
      - path: payload.pull_request.commits
        greaterThan: 50
    actions:
      - request-detailed-review
```

**Example 5: Regex pattern matching**
```yaml
eventMappings:
  # Match release events for semantic version tags
  - event: release.published
    filters:
      - path: payload.release.tag_name
        matches: ^v\d+\.\d+\.\d+$
    actions:
      - publish-release-notes
```

**Example 6: Legacy filter syntax (still supported)**
```yaml
eventMappings:
  # Welcome first-time contributors (non-draft PRs)
  - event: pull_request.opened
    filters:
      - draft: false
    actions:
      - welcome-contributor

  # Monitor specific user's actions
  - event: "*"
    filters:
      - author: dependabot[bot]
    actions:
      - log-bot-activity
```

**Example 7: Combining multiple filters**
```yaml
eventMappings:
  # Only analyze open bug issues from external contributors
  - event: issue.labeled
    filters:
      - path: payload.label.name
        equals: bug
      - path: payload.issue.state
        equals: open
      - path: payload.issue.author_association
        in: [FIRST_TIME_CONTRIBUTOR, CONTRIBUTOR, NONE]
    repository: octocat/important-project
    actions:
      - deep-analysis
      - notify-team
```

**Example 8: Check if all array elements match**
```yaml
eventMappings:
  # Only process PRs where all reviewers have approved
  - event: pull_request_review.submitted
    filters:
      - path: payload.pull_request.reviews
        all:
          state: APPROVED
    actions:
      - auto-merge
```

## Repository Filtering

You can limit an event mapping to a specific repository:

```yaml
eventMappings:
  # Only process events from the main project
  - event: issue.opened
    repository: octocat/Hello-World
    actions:
      - create-detailed-issue-report
```

This is useful when monitoring multiple repositories but wanting different behavior for each.

## Complete Examples

### Example 1: Auto-label New Issues

```yaml
eventMappings:
  - event: issue.opened
    actions:
      - add-issue-labels
```

### Example 2: Respond to Specific Label Being Added

```yaml
eventMappings:
  # Trigger when "bug" label is specifically added (path-based filter)
  - event: issue.labeled
    filters:
      - path: payload.label.name
        equals: bug
    actions:
      - analyze-bug
      - assign-to-team
```

### Example 3: Welcome Contributors

```yaml
eventMappings:
  - event: pull_request.opened
    filters:
      - draft: false
    actions:
      - welcome-contributor
      - run-ci-checks
```

### Example 4: Monitor All Events (Debugging)

```yaml
eventMappings:
  - event: "*"
    actions:
      - log-all-events
```

### Example 5: Complex Multi-filter Example

```yaml
eventMappings:
  # Only analyze when "bug" label is added to open issues (path-based filters)
  - event: issue.labeled
    filters:
      - path: payload.label.name
        equals: bug
      - path: payload.issue.state
        equals: open
    repository: octocat/important-project
    actions:
      - deep-analysis
      - notify-team
```

### Example 6: Discussion Events

```yaml
eventMappings:
  # Participate in discussions when created, edited, or commented on
  - event: discussion.created
    actions:
      - ai-discuss

  - event: discussion.edited
    actions:
      - ai-discuss

  - event: discussion_comment.created
    actions:
      - ai-discuss

  # Monitor discussions in a specific category
  - event: discussion.created
    filters:
      - path: payload.discussion.category.name
        equals: Q&A
    actions:
      - answer-questions

  # Track when discussions are answered
  - event: discussion.answered
    actions:
      - update-metrics
      - thank-contributor
```

## Event Processing Order

Event mappings are processed in the order they appear in the configuration file. If an event matches multiple
mappings, all matching actions will be executed. Actions within a single mapping are also executed in order,
subject to the job queue's concurrency limits (configured via `queue.maxConcurrent`).

## Best Practices

1. **Prefer path-based filters** - Use the new path-based filter syntax (`path` + matcher) for more precise
   and flexible event filtering. Legacy filters are still supported for backwards compatibility.

2. **Use specific event types when possible** - Prefer `issue.opened` over `issue.*` for better performance
   and clarity.

3. **Order matters** - Place more specific mappings before general ones if you want certain actions to run
   first.

4. **Use filters judiciously** - Filters are evaluated after event type matching, so use the most specific
   event type possible to minimize unnecessary filter checks.

5. **Be careful with wildcards** - Using `*` will match every event and can generate significant load.
   Consider using more specific wildcards like `issue.*` or `pull_request.*`.

6. **Check the specific property** - For labeled events, use `path: payload.label.name` to check which
   label was added/removed, not the entire labels array. This distinction is important for label-triggered
   actions.

7. **Test incrementally** - When adding new mappings, test with a single event type before expanding to
   wildcards.

8. **Monitor logs** - Event processing is logged to the console and action logs, making it easy to debug
   mapping issues. Full event JSON is logged to the configured events path (default: `./logs/events/{owner}/{repo}/`)
   for detailed inspection. The events path can be configured in `config.yaml` under `logging.eventsPath`.
   Each event is saved as a separate JSON file with timestamp, event ID, and event type in the filename.
