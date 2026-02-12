# AI Agent Prompts

This directory contains Handlebars templates for AI agent prompts.

## Structure

- **base.hbs** - Base system prompt included in all agent prompts
- **[prompt-name].hbs** - Specific prompts for different agent tasks

## Template Syntax

Prompts use Handlebars template syntax with access to the `event` object:

```handlebars
{{event.repository}}
{{event.issue.number}}
{{event.issue.title}}
{{event.issue.author}}
{{event.type}}
```

## Adding New Prompts

1. Create a new `.hbs` file in this directory
2. Use Handlebars syntax for variable substitution
3. The base prompt is automatically prepended to all prompts
4. Configure the prompt in your event mappings in `config.yaml`

## Available Prompts

- **label-issue** - Automatic issue labeling
- **discussion** - GitHub discussion responses
- **test-comment** - Test comment creation
- **apply-resolution-label** - Apply resolution labels to closed issues

## Configuration

Configure the prompts directory in `config.yaml`:

```yaml
prompts:
  basePath: ./prompts
```

Default location is `./prompts` if not specified.
