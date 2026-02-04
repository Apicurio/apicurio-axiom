# Event Validation

The application uses JSON Schema validation to ensure all events conform to the expected structure before processing.

## How It Works

1. **Schema Definition**: The Event schema is defined in `schemas/event.schema.json`
2. **Automatic Validation**: When the poller receives a GitHub event:
   - The event is normalized into our internal Event format
   - The EventValidator validates it against the JSON schema
   - If validation passes, the event is processed normally
   - If validation fails, the event is rejected and logged

3. **Rejection Handling**:
   - Invalid events are logged with detailed error information
   - The event is marked as processed to avoid reprocessing
   - The event does NOT proceed to event matching or action execution

## Benefits

- **Data Integrity**: Ensures all events have required fields and correct types
- **Early Detection**: Catches malformed events before they can cause errors
- **Debugging**: Validation errors provide clear information about what's wrong
- **Type Safety**: Complements TypeScript compile-time checking with runtime validation

## Validation Rules

The schema enforces:

- **Required Fields**: id, type, repository, repositoryOwner, repositoryName, actor, createdAt
- **Type Checking**: String, integer, boolean, array types
- **Format Validation**: date-time for timestamps, uri for URLs
- **Enum Constraints**: State must be "open" or "closed"
- **Value Constraints**: Issue/PR numbers must be >= 1
- **Structure Validation**: Nested objects like IssueEvent, PullRequestEvent, etc.

## Example Error Log

When an event fails validation, you'll see a log entry like:

```
ERROR: Event validation failed - rejecting event
  eventId: 12345678
  eventType: issue.opened
  repository: owner/repo
  errors:
    /issue/number: must be integer ({"type":"integer"})
```

## Testing

```bash
# Test the validation system
npm run test:validation

# Validate stored events
npm run validate:events
```

## Implementation

Key files:
- `schemas/event.schema.json` - JSON Schema definition
- `src/validation/event-validator.ts` - Validation logic
- `src/github/poller.ts` - Integration point (validates before processing)
- `scripts/test-event-validation.ts` - Test suite
- `scripts/validate-events.js` - Validate stored event files

## Troubleshooting

If events are being rejected unexpectedly:

1. Check the error logs for validation details
2. Verify the event structure matches the schema
3. Run `npm run validate:events` to test stored events
4. Review the schema definition in `schemas/event.schema.json`

## Schema Updates

When updating the Event TypeScript types:

1. Update the JSON schema to match (`schemas/event.schema.json`)
2. Run validation tests to ensure compatibility
3. Update example events if needed (`schemas/examples/`)
