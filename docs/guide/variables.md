---
title: Variables and Interpolation
description: How to use variables and interpolation in canonical files
order: 8
---

# Variables and Interpolation

This guide teaches you how to use variables for dynamic content in your
canonical files.

## What Is Interpolation

Interpolation is the substitution of variable references with their values
during transpilation. When Agloom encounters a pattern like `${agloom:VAR}` in
your files, it replaces it with the actual value before writing the output.

## Variable Namespaces

Agloom supports three variable namespaces:

### `${agloom:VAR}` -- Agloom Variables

These are adapter-dependent path variables. They resolve to different values
depending on which adapter is being transpiled.

**Dynamic variables** (change per adapter):

| Variable       | Claude          | OpenCode          |
| -------------- | --------------- | ----------------- |
| `SKILLS_DIR`   | `.claude/skills`   | `.opencode/skills`   |
| `AGENTS_DIR`   | `.claude/agents`   | `.opencode/agents`   |
| `DOCS_DIR`     | `.claude/docs`     | `.opencode/docs`     |
| `SCHEMAS_DIR`  | `.claude/schemas`  | `.opencode/schemas`  |

**Canonical variables** (fixed, do not change per adapter):

| Variable            | Value              |
| ------------------- | ------------------ |
| `PROJECT_DIR`       | Absolute path to project root |
| `AGLOOM_DIR`        | `.agloom`          |
| `AGLOOM_SKILLS_DIR` | `.agloom/skills`   |
| `AGLOOM_AGENTS_DIR` | `.agloom/agents`   |
| `AGLOOM_DOCS_DIR`   | `.agloom/docs`     |
| `AGLOOM_SCHEMAS_DIR`| `.agloom/schemas`  |

**Per-adapter variables** (always available, prefixed by adapter name):

| Variable              | Value              |
| --------------------- | ------------------ |
| `CLAUDE_SKILLS_DIR`   | `.claude/skills`   |
| `CLAUDE_AGENTS_DIR`   | `.claude/agents`   |
| `OPENCODE_SKILLS_DIR` | `.opencode/skills` |
| ...                   | ...                |

Example usage in an agent file:

```markdown
Read the protocol at `${agloom:DOCS_DIR}/protocol.md`.
Skills are located at `${agloom:SKILLS_DIR}/`.
```

When transpiling for Claude, this becomes:

```markdown
Read the protocol at `.claude/docs/protocol.md`.
Skills are located at `.claude/skills/`.
```

### `${env:VAR}` -- Environment Variables

Reference environment variables from `process.env`:

```markdown
Project: ${env:PROJECT_NAME}
API endpoint: ${env:API_URL}
```

Agloom automatically loads a `.env` file from your project root (if it exists)
before transpilation. Variables defined in `process.env` take precedence over
`.env` values.

If the referenced variable is not defined, transpilation fails with an error.

### `${values:VAR}` -- Plugin and Project Values

Reference resolved values from plugins or project variables:

```markdown
Team: ${values:team_name}
Base URL: ${values:base_url}
```

These values come from two sources:

1. **Plugin values** -- resolved from plugin variable declarations and the
   `values` field in your config (see [Plugins](plugins.md)).
2. **Project variables** -- resolved from the `variables` section of
   `config.yml` (see below).

Each plugin receives only its own resolved values -- plugins cannot access each
other's values.

## Project Variables

Declare project-level variables in the `variables` section of `config.yml`:

```yaml
# .agloom/config.yml
adapters:
  - claude
variables:
  project_name: "${env:PROJECT_NAME}"
  team:
    description: "Team name"
    default: "platform"
  api_key:
    description: "API key for external service"
    default: "${env:API_KEY}"
    sensitive: true
    required: true
```

### Shorthand Form

A string value is shorthand for `{ default: "<value>" }`:

```yaml
variables:
  project_name: "${env:PROJECT_NAME}"
```

This is equivalent to:

```yaml
variables:
  project_name:
    default: "${env:PROJECT_NAME}"
```

### Full Form

The full form supports these fields:

- `description` -- human-readable description (optional in config, required in
  plugin manifests).
- `default` -- default value. Can contain `${env:VAR}` references.
- `required` -- if `true`, the variable must have a value (from default or
  environment). Defaults to `false`.
- `sensitive` -- if `true`, the value must reference an environment variable
  (`${env:VAR}`). Inline values are rejected. Defaults to `false`.

## .env File

Agloom loads a `.env` file from the project root before transpilation. This
file follows the standard `dotenv` format:

```bash
# .env
PROJECT_NAME=my-app
API_KEY=secret-key-123
```

Variables from `.env` are available through `${env:VAR}` in instructions,
skills, agents, overlays, and variable defaults.

If `.env` does not exist, Agloom silently continues without it.

## Where Interpolation Applies

Interpolation runs in the following contexts:

- **Instructions** -- `AGLOOM.md` files (`.md`)
- **Skills** -- `.md` files within skill directories
- **Agents** -- `.md` agent definition files
- **Docs** -- `.md` files in the docs directory
- **Schemas** -- `.md` files in the schemas directory
- **Overlays** -- files with interpolatable extensions: `.md`, `.txt`, `.json`,
  `.jsonc`, `.jsonl`, `.xml`, `.html`, `.svg`, `.toml`, `.yml`, `.yaml`

Binary files and non-interpolatable extensions are always copied as-is.

## Escaping

To include a literal `${agloom:VAR}` in your output (without interpolation),
prefix with a backslash:

```markdown
Use \${agloom:SKILLS_DIR} to reference the skills directory.
```

This outputs the literal text `${agloom:SKILLS_DIR}`.

## Example

Here is an end-to-end example: declaring a variable in config, using it in a
skill, and seeing the result after transpile.

**Step 1:** Declare the variable in `config.yml`:

```yaml
# .agloom/config.yml
adapters:
  - claude
variables:
  team_name: "platform"
```

**Step 2:** Use it in a skill:

```markdown
---
name: deploy
description: Deploy the application
---

# Deploy

Deploy the application for the ${values:team_name} team.

Artifacts are stored in `${agloom:DOCS_DIR}/deployments/`.
```

**Step 3:** Run `agloom transpile`. The output in
`.claude/skills/deploy/SKILL.md`:

```markdown
---
name: deploy
description: Deploy the application
---

# Deploy

Deploy the application for the platform team.

Artifacts are stored in `.claude/docs/deployments/`.
```

The `${values:team_name}` was replaced with `"platform"` and
`${agloom:DOCS_DIR}` was replaced with `.claude/docs`.
