---
title: Variables and Interpolation
description: How to use variables and interpolation in canonical files
prev: overlays
next: formatting
sidebar_position: 8
---

# Variables and Interpolation

This guide teaches you how to use variables for dynamic content in your canonical files.

## What Is Interpolation

Interpolation is the substitution of variable references with their values during transpilation. When Agloom encounters a pattern like `${agloom:VAR}` in your files, it replaces it with the actual value before writing the output.

## Variable Namespaces

Agloom supports three variable namespaces:

### `${agloom:VAR}` — Agloom Variables

These are adapter-dependent path variables. They resolve to different values depending on which adapter is being transpiled.

**Dynamic variables** resolve to directories of the adapter currently
being transpiled:

| Variable       | Example (Claude)   |
| -------------- | ------------------ |
| `SKILLS_DIR`   | `.claude/skills`   |
| `AGENTS_DIR`   | `.claude/agents`   |
| `COMMANDS_DIR` | `.claude/commands` |
| `DOCS_DIR`     | `.claude/docs`     |
| `SCHEMAS_DIR`  | `.claude/schemas`  |

Each adapter owns a different set of directories, so a dynamic variable
is only available when the current adapter defines it. For instance,
`${agloom:COMMANDS_DIR}` is undefined when transpiling for Codex,
because Codex has no project-level commands directory. Referencing an
undefined variable fails transpilation.

<!-- TODO: Maybe COMMANDS_DIR for the Codex have to refer to the skills/ dir? -->

**Canonical variables** (fixed, do not change per adapter):

| Variable             | Value                         |
| -------------------- | ----------------------------- |
| `PROJECT_DIR`        | Absolute path to project root |
| `AGLOOM_DIR`         | `.agloom`                     |
| `AGLOOM_SKILLS_DIR`  | `.agloom/skills`              |
| `AGLOOM_AGENTS_DIR`  | `.agloom/agents`              |
| `AGLOOM_DOCS_DIR`    | `.agloom/docs`                |
| `AGLOOM_SCHEMAS_DIR` | `.agloom/schemas`             |

`PROJECT_DIR` is the only canonical variable that contains an absolute
path. All other canonical variables contain paths relative to the
project root. You can compose absolute paths by concatenating
`${agloom:PROJECT_DIR}` with any relative variable, for example
`${agloom:PROJECT_DIR}/${agloom:AGLOOM_DIR}` expands to
`<projectRoot>/.agloom`.

**Per-adapter variables** address another adapter's directories
regardless of which adapter is currently being transpiled. Their names
follow the pattern `{ADAPTER}_<KIND>_DIR`, where `{ADAPTER}` is the
uppercased adapter id:

```markdown
${agloom:CLAUDE_SKILLS_DIR}    → .claude/skills
${agloom:OPENCODE_AGENTS_DIR} → .opencode/agents
${agloom:GEMINI_COMMANDS_DIR} → .gemini/commands
```

Each adapter generates the prefixed variables only for the directories
it owns. Two exceptions are worth remembering: `CODEX_COMMANDS_DIR` does
not exist (Codex has no commands directory), and the `agentsmd` adapter
generates no per-adapter variables at all because it owns no directory
of its own — it only emits an `AGENTS.md` file. For the complete list
of paths per adapter, see [reference/adapters](../reference/adapters.md).

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

### `${env:VAR}` — Environment Variables

Reference environment variables from `process.env`:

```markdown
Project: ${env:PROJECT_NAME}
API endpoint: ${env:API_URL}
```

Agloom automatically loads a `.env` file from your project root (if it exists) before transpilation. Variables defined in `process.env` take precedence over `.env` values.

If the referenced variable is not defined, transpilation fails with an error.

### `${values:VAR}` — Plugin and Project Values

Reference resolved values from plugins or project variables:

```markdown
Team: ${values:team_name}
Base URL: ${values:base_url}
```

These values come from two sources:

1. **Plugin values** — resolved from plugin variable declarations and the
   `values` field in your config (see [Plugins](plugins.md)).
2. **Project variables** — resolved from the `variables` section of
   `config.yml` (see below).

Each plugin receives only its own resolved values — plugins cannot access each other's values.

## Project Variables

Declare project-level variables in the `variables` section of `config.yml`:

```yaml title=".agloom/config.yml"
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

- `description` — human-readable description (optional in config, required in
  plugin manifests).
- `default` — default value. Can contain `${env:VAR}` references.
- `required` — if `true`, the variable must have a value (from default or
  environment). Defaults to `false`.
- `sensitive` — if `true`, the value must reference an environment variable
  (`${env:VAR}`). Inline values are rejected. Defaults to `false`.

## .env File

Agloom loads a `.env` file from the project root before transpilation. This file follows the standard `dotenv` format:

```bash title=".env"
PROJECT_NAME=my-app
API_KEY=secret-key-123
```

Variables from `.env` are available through `${env:VAR}` in instructions, skills, agents, overlays, and variable defaults.

If `.env` does not exist, Agloom silently continues without it.

## Where Interpolation Applies

Interpolation runs in the following contexts:

- **Instructions** — `AGLOOM.md` files (`.md`)
- **Skills** — `.md` files within skill directories
- **Agents** — `.md` agent definition files
- **Docs** — `.md` files in the docs directory
- **Schemas** — `.md` files in the schemas directory
- **Overlays** — files with interpolatable extensions: `.md`, `.txt`, `.json`,
  `.jsonc`, `.jsonl`, `.xml`, `.html`, `.svg`, `.toml`, `.yml`, `.yaml`

Binary files and non-interpolatable extensions are always copied as-is.

## Escaping

To include a literal `${agloom:VAR}` in your output (without interpolation), prefix with a backslash:

```markdown
Use \${agloom:SKILLS_DIR} to reference the skills directory.
```

This outputs the literal text `${agloom:SKILLS_DIR}`.

## Example

Here is an end-to-end example: declaring a variable in config, using it in a skill, and seeing the result after transpile.

**Step 1:** Declare the variable in `config.yml`:

```yaml title=".agloom/config.yml"
adapters:
  - claude
variables:
  team_name: "platform"
```

**Step 2:** Use it in a skill:

```markdown title=".agloom/skills/deploy/SKILL.md"
---
name: deploy
description: Deploy the application
---

# Deploy

Deploy the application for the ${values:team_name} team.

Artifacts are stored in `${agloom:DOCS_DIR}/deployments/`.
```

**Step 3:** Run `agloom transpile`. The output in `.claude/skills/deploy/SKILL.md`:

```markdown title=".claude/skills/deploy/SKILL.md"
---
name: deploy
description: Deploy the application
---

# Deploy

Deploy the application for the platform team.

Artifacts are stored in `.claude/docs/deployments/`.
```

The `${values:team_name}` was replaced with `"platform"` and `${agloom:DOCS_DIR}` was replaced with `.claude/docs`.
