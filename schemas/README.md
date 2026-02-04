# JSON Schemas

This directory contains JSON Schema definitions for validating data structures used in the application.

## event.schema.json

JSON Schema for validating Event objects processed by the bot.

**Runtime Validation**: All events are automatically validated against this schema when processed by the bot. Invalid events are rejected and logged with detailed error information.

### Usage

#### With a JSON Schema Validator

```javascript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import eventSchema from './schemas/event.schema.json';

const ajv = new Ajv();
addFormats(ajv);

const validate = ajv.compile(eventSchema);

const event = {
    id: "12345",
    type: "issue.opened",
    repository: "owner/repo",
    repositoryOwner: "owner",
    repositoryName: "repo",
    actor: "username",
    createdAt: "2024-01-15T10:30:00Z",
    issue: {
        number: 42,
        title: "Bug report",
        state: "open",
        labels: ["bug", "high-priority"],
        author: "username",
        url: "https://github.com/owner/repo/issues/42"
    }
};

if (validate(event)) {
    console.log('Valid event');
} else {
    console.error('Invalid event:', validate.errors);
}
```

#### In TypeScript

The schema complements the TypeScript types defined in `src/types/events.ts`. Use TypeScript for
compile-time type checking and the JSON schema for runtime validation.

### Schema Structure

The schema defines:

- **Event**: Main event object with required and optional properties
- **IssueEvent**: Issue-specific event data
- **PullRequestEvent**: Pull request-specific event data
- **CommentEvent**: Comment-specific event data
- **DiscussionEvent**: Discussion-specific event data
- **GitHubEventPayload**: Raw GitHub event payload
- **GitHubEvent**: Raw GitHub event object

### Validation Features

- Required field validation
- Type checking (string, integer, boolean, object, array)
- Format validation (date-time, uri)
- Enum validation for state fields (open/closed)
- Minimum value constraints for number fields
- Additional properties control

### Testing

Test the validation system:

```bash
# Run validation tests
npm run test:validation

# Validate stored events
npm run validate:events
```

### Installation

The schema validator is automatically installed as part of the application dependencies (ajv, ajv-formats).

### References

- [JSON Schema Specification](https://json-schema.org/)
- [AJV - Another JSON Schema Validator](https://ajv.js.org/)
