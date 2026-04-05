---
title: Interpolation
description: Complete reference for variable interpolation syntax, namespaces, and resolution
prev: adapters
next: patch-operations
sidebar_position: 5
---

# Interpolation

Agloom supports variable interpolation in canonical files during transpilation. Variables are substituted with adapter-specific paths, environment values, or plugin/project values.

## Syntax

```
${type:key}
```

- `type` -- the variable namespace (`agloom`, `env`, or `values`).
- `key` -- the variable name. One or more characters not containing `}`.

### Escaping

Prefix with a backslash to produce the literal text:

```
\${agloom:VAR}  -->  ${agloom:VAR}
\${env:VAR}     -->  ${env:VAR}
\${values:VAR}  -->  ${values:VAR}
```

The backslash is consumed during interpolation.

### Unrecognized Namespaces

Patterns with namespaces other than `agloom`, `env`, or `values` (e.g., `${foo:bar}`) are preserved as literal text without processing.

## Variable Namespaces

### agloom

Adapter-dependent variables built by `buildVariables()`. Divided into three groups:

#### Canonical (fixed) Variables

Values are fixed regardless of the current adapter.

| Variable | Value |
|----------|-------|
| `PROJECT_DIR` | Absolute path to the project root |
| `AGLOOM_DIR` | `.agloom` |
| `AGLOOM_SKILLS_DIR` | `.agloom/skills` |
| `AGLOOM_AGENTS_DIR` | `.agloom/agents` |
| `AGLOOM_DOCS_DIR` | `.agloom/docs` |
| `AGLOOM_SCHEMAS_DIR` | `.agloom/schemas` |

`PROJECT_DIR` is the only canonical variable containing an absolute path. All others are relative. Compose them for absolute paths: `${agloom:PROJECT_DIR}/${agloom:AGLOOM_DIR}`.

#### Dynamic (per-current-adapter) Variables

Values depend on the adapter currently being transpiled. Sourced from the adapter's `paths` field.

| Variable | Source |
|----------|--------|
| `SKILLS_DIR` | `currentAdapter.paths.skills` |
| `AGENTS_DIR` | `currentAdapter.paths.agents` |
| `DOCS_DIR` | `currentAdapter.paths.docs` |
| `SCHEMAS_DIR` | `currentAdapter.paths.schemas` |

A dynamic variable is only present if the corresponding `paths` field is defined for the current adapter. For example, the `agentsmd` adapter has empty `paths`, so none of these variables exist when transpiling for `agentsmd`.

#### Static (per-all-adapters) Variables

Generated for every adapter in the registry that has at least one defined `paths` field. The prefix is the adapter ID in uppercase.

| Pattern | Source |
|---------|--------|
| `{PREFIX}_SKILLS_DIR` | `adapter.paths.skills` |
| `{PREFIX}_AGENTS_DIR` | `adapter.paths.agents` |
| `{PREFIX}_DOCS_DIR` | `adapter.paths.docs` |
| `{PREFIX}_SCHEMAS_DIR` | `adapter.paths.schemas` |

Where `{PREFIX}` = `adapter.id.toUpperCase()`.

**Example values:**

| Variable | Value |
|----------|-------|
| `CLAUDE_SKILLS_DIR` | `.claude/skills` |
| `CLAUDE_AGENTS_DIR` | `.claude/agents` |
| `CLAUDE_DOCS_DIR` | `.claude/docs` |
| `CLAUDE_SCHEMAS_DIR` | `.claude/schemas` |
| `OPENCODE_SKILLS_DIR` | `.opencode/skills` |
| `OPENCODE_AGENTS_DIR` | `.opencode/agents` |
| `OPENCODE_DOCS_DIR` | `.opencode/docs` |
| `OPENCODE_SCHEMAS_DIR` | `.opencode/schemas` |

Adapters with empty `paths` (e.g., `agentsmd`) do not generate static variables.

### env

Environment variables from `process.env`.

```
${env:HOME}
${env:PROJECT_NAME}
```

The `.env` file in the project root is automatically loaded before transpilation using `dotenv`. Variables already set in `process.env` take priority over `.env` values.

#### Error on Missing Variable

If the referenced environment variable is not defined, interpolation fails with:

```
InterpolationError("Undefined environment variable: <NAME>")
```

### values

Plugin or project values resolved from `variables` declarations. See [config.md](config.md) for project variables and [plugin-manifest.md](plugin-manifest.md) for plugin variables.

```
${values:team_name}
${values:api_token}
```

#### Resolution Order

**For plugin values** (priority high to low):

1. `values` from plugin entry in `config.yml` (user-provided).
2. `default` from `variables` in `plugin.yml`.

**For project variables:**

1. `default` from `variables` in `config.yml`.

Values containing `${env:VAR}` are resolved using `process.env` during the resolution step.

#### Isolation

Each plugin receives only its own resolved values. Plugin A cannot access values from Plugin B. The local project receives its own resolved local values.

#### Error on Missing Variable

```
InterpolationError("Unknown values variable: <NAME>")
```

## Sensitive Variables

Variables declared with `sensitive: true` must not be set inline in `values`. The value must contain at least one `${env:VAR}` reference.

- `api_token: "my-secret"` -- **rejected** (inline value for sensitive variable).
- `api_token: "${env:API_TOKEN}"` -- **accepted**.
- `api_token: "prefix-${env:API_TOKEN}"` -- **accepted** (contains `${env:`).

## Supported File Extensions

Interpolation is performed on files with the following extensions (case-insensitive comparison):

```
.md  .txt  .json  .jsonc  .jsonl  .xml  .html  .svg  .toml  .yml  .yaml
```

Files with other extensions are copied byte-for-byte without interpolation.

## Where Interpolation Applies

- **Instructions transpiler:** `transformContent` applies interpolation to the full transformed content.
- **Agents transpiler:** `transformContent` applies interpolation to the full transformed content.
- **Skills transpiler:** `writeResults` applies interpolation to `.md` files only.
- **Docs transpiler:** `writeResults` applies interpolation to supported extensions.
- **Schemas transpiler:** `writeResults` applies interpolation to supported extensions.
- **Overlay step:** applies interpolation to files with supported extensions before merge/override/patch.

## Error Handling

| Condition | Error |
|-----------|-------|
| Unknown `${agloom:NAME}` | `InterpolationError("Unknown agloom variable: <NAME>")` |
| Undefined `${env:NAME}` | `InterpolationError("Undefined environment variable: <NAME>")` |
| Unknown `${values:NAME}` | `InterpolationError("Unknown values variable: <NAME>")` |

In the instructions and agents transpilers, interpolation errors are wrapped as `TransformError` or `AgentTransformError`. In the skills transpiler, they are wrapped as `SkillWriteError`.

## Example

Canonical content:

```markdown
Skills are at `${agloom:SKILLS_DIR}`.
Claude skills: `${agloom:CLAUDE_SKILLS_DIR}`.
Project: ${env:PROJECT_NAME}
Team: ${values:team_name}
Escaped: \${env:HOME}
```

After interpolation for the `claude` adapter (with `PROJECT_NAME=myapp`, `team_name=platform`):

```markdown
Skills are at `.claude/skills`.
Claude skills: `.claude/skills`.
Project: myapp
Team: platform
Escaped: ${env:HOME}
```

After interpolation for the `opencode` adapter:

```markdown
Skills are at `.opencode/skills`.
Claude skills: `.claude/skills`.
Project: myapp
Team: platform
Escaped: ${env:HOME}
```
