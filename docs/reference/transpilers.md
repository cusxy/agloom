---
title: Transpilers
description: Reference for all transpiler modules, pipeline order, and overlay step
order: 7
---

# Transpilers

Agloom uses a pipeline of transpiler modules to convert canonical files into agent-specific output. Each module handles a specific content type.

## Pipeline Overview

Transpiler modules execute in this fixed order for each adapter:

1. **Instructions** -- transforms `AGLOOM.md` into agent-specific instruction files.
2. **Skills** -- copies skill packages from `.agloom/skills/` to agent-specific directories.
3. **Agents** -- transforms agent definitions from `.agloom/agents/` to agent-specific directories.
4. **Docs** -- copies documentation files from `.agloom/docs/` to agent-specific directories.
5. **Schemas** -- copies schema files from `.agloom/schemas/` to agent-specific directories.
6. **Overlay step** -- applies overlay files, MCP configuration, and permissions.

Steps 1--5 run independently for each adapter. Step 6 (overlay) applies after all transpiler modules and handles cross-cutting concerns like file merging and adapter-specific overrides.

## Instructions Transpiler

**Source:** `.agloom/instructions/AGLOOM.md` (root) and `**/AGLOOM.md` (directory-level)

**Operation:** Transforms content -- parses YAML frontmatter, applies per-agent override fields, filters agent-specific sections in the Markdown body.

### Agent-Specific Sections

The body may contain agent-specific sections delimited by HTML comments:

```markdown
<!-- agent:claude -->
This content only appears in CLAUDE.md output.
<!-- /agent:claude -->

<!-- agent:agentsmd -->
This content only appears in AGENTS.md output.
<!-- /agent:agentsmd -->
```

Content outside sections appears in all outputs. Sections matching the target agent are unwrapped (tags removed, content kept). Non-matching sections are removed entirely.

### Valid Agent IDs for Instructions

Only agents with their own instruction file format are valid in `<!-- agent:id -->` tags:

| Agent ID | Valid? | Reason |
|----------|--------|--------|
| `claude` | Yes | Has `CLAUDE.md` |
| `agentsmd` | Yes | Has `AGENTS.md` |
| `gemini` | Yes | Has `GEMINI.md` |
| `opencode` | No | Uses `AGENTS.md` via `agentsmd` |
| `kilocode` | No | Uses `AGENTS.md` via `agentsmd` |
| `codex` | No | Uses `AGENTS.md` via `agentsmd` |

### Frontmatter Override

The canonical frontmatter may contain an `override` block with per-agent key overrides (shallow merge):

```yaml
---
override:
  claude:
    someKey: value
---
```

The `override` key is removed from the output. Keys from `override[agentId]` replace top-level keys in the frontmatter.

### Output Per Adapter

| Adapter | Input | Output |
|---------|-------|--------|
| `claude` | `AGLOOM.md` | `CLAUDE.md` (same relative location) |
| `agentsmd` | `AGLOOM.md` | `AGENTS.md` (same relative location) |
| `gemini` | `AGLOOM.md` | `GEMINI.md` (same relative location) |
| `opencode` | _(no-op)_ | _(no output)_ |
| `kilocode` | _(no-op)_ | _(no output)_ |
| `codex` | _(no-op)_ | _(no output)_ |

---

## Skills Transpiler

**Source:** `.agloom/skills/<name>/` directories

**Operation:** Copies skill packages (directory with `SKILL.md` and supporting files) into agent-specific skill directories. No content transformation -- files are copied as-is, except `.md` files undergo interpolation when variables are provided.

### Canonical Format

A skill is a directory in `.agloom/skills/<name>/` containing a `SKILL.md` file (YAML frontmatter + Markdown body) and optional supporting files. The transpiler does not validate or transform skill content.

### Output Per Adapter

Skills are copied to the adapter's `paths.skills` directory:

| Adapter | Output Directory |
|---------|-----------------|
| `claude` | `.claude/skills/<name>/` |
| `opencode` | `.opencode/skills/<name>/` |
| `kilocode` | `.kilo/skills/<name>/` |
| `codex` | `.agents/skills/<name>/` |
| `gemini` | `.gemini/skills/<name>/` |
| `agentsmd` | _(no output -- empty paths)_ |

---

## Agents Transpiler

**Source:** `.agloom/agents/<name>.md` files

**Operation:** Transforms agent definitions -- parses YAML frontmatter, applies per-agent override fields, filters agent-specific sections in the Markdown body. Same transformation mechanism as instructions transpiler (but without `allowedAgentIds` validation on agent-specific sections).

### Frontmatter Override

Same mechanism as instructions transpiler. Example:

```yaml
---
name: code-reviewer
model: sonnet
override:
  opencode:
    model: anthropic/claude-sonnet-4-5
  claude:
    permissionMode: plan
---
```

### Output Per Adapter

Agents are copied to the adapter's `paths.agents` directory:

| Adapter | Output Directory |
|---------|-----------------|
| `claude` | `.claude/agents/<name>.md` |
| `opencode` | `.opencode/agents/<name>.md` |
| `kilocode` | `.kilo/agents/<name>.md` |
| `codex` | `.codex/agents/<name>.md` |
| `gemini` | `.gemini/agents/<name>.md` |
| `agentsmd` | _(no output -- empty paths)_ |

---

## Docs Transpiler

**Source:** `.agloom/docs/` directory

**Operation:** Copies documentation files to agent-specific docs directories. Markdown and other text files undergo interpolation when variables are provided.

### Output Per Adapter

| Adapter | Output Directory |
|---------|-----------------|
| `claude` | `.claude/docs/` |
| `opencode` | `.opencode/docs/` |
| `kilocode` | `.kilo/docs/` |
| `gemini` | `.gemini/docs/` |
| `agentsmd` | _(no output)_ |

---

## Schemas Transpiler

**Source:** `.agloom/schemas/` directory

**Operation:** Copies schema files (JSON Schema, OpenAPI, etc.) to agent-specific schemas directories. Text files undergo interpolation when variables are provided.

### Output Per Adapter

| Adapter | Output Directory |
|---------|-----------------|
| `claude` | `.claude/schemas/` |
| `opencode` | `.opencode/schemas/` |
| `kilocode` | `.kilo/schemas/` |
| `gemini` | `.gemini/schemas/` |
| `agentsmd` | _(no output)_ |

---

## MCP Transpiler

**Source:** `.agloom/mcp.yml` or `.agloom/mcp.json`

**Operation:** Transforms the canonical MCP server configuration into adapter-specific formats.

### Canonical Format

```yaml
mcpServers:
  context7:
    command: npx
    args: ["-y", "@upstash/context7-mcp@latest"]
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env:
      ROOT_DIR: "${env:PROJECT_ROOT}"
    includeTools:
      - read_file
      - list_directory
```

Each server entry supports:

| Field | Type | Description |
|-------|------|-------------|
| `command` | string | Command to start the MCP server. |
| `args` | array\<string> | Command arguments. |
| `env` | object | Environment variables for the server process. |
| `includeTools` | array\<string> | Whitelist of tools (mutually exclusive with `excludeTools`). |
| `excludeTools` | array\<string> | Blacklist of tools (mutually exclusive with `includeTools`). |

### Output Per Adapter

| Adapter | Output File | Format |
|---------|-------------|--------|
| `claude` | `.mcp.json` | `{ mcpServers: { ... } }` with tool filtering via `autoApprove`/`disabled` fields. |
| `opencode` | `opencode.json` | MCP servers in the `mcp` section. Tool filtering fields are stripped (not supported). |

Only `.agloom/mcp.yml` or `.agloom/mcp.json` may exist -- not both simultaneously.

---

## Permissions Transpiler

**Source:** `.agloom/permissions.yml` or `.agloom/permissions.json`

**Operation:** Transforms the canonical permissions configuration into adapter-specific formats.

### Canonical Format

The canonical format uses **first-match-wins** semantics: the first matching rule in the array determines the action. Each section is an ordered array of `{ pattern: action }` objects.

```yaml
shell:
  - "git status *": allow
  - "git push *": ask
  - "*": deny
mcp:
  - "bitbucket:*": allow
  - "*:*": ask
file:
  - "src/**": write
  - "**": read
```

| Section | Pattern Format | Actions |
|---------|---------------|---------|
| `shell` | Glob matched against full command string | `allow`, `ask`, `deny` |
| `mcp` | `<server>:<tool>` format | `allow`, `ask`, `deny` |
| `file` | Glob matched against file path | `deny`, `read`, `write` |

All sections are optional.

### Output Per Adapter

| Adapter | Output | Notes |
|---------|--------|-------|
| `claude` | `.claude/settings.json` (permissions section) | First-match-wins semantics preserved. |
| `opencode` | `opencode.json` (permission section) | Rule order **inverted** (OpenCode uses last-match-wins). |

Only `.agloom/permissions.yml` or `.agloom/permissions.json` may exist -- not both simultaneously.

---

## Overlay Step

The overlay step runs **after** all transpiler modules. It applies per-adapter overlay files from `.agloom/overlays/<adapterId>/` to the project root.

### File Merge Strategies

The strategy for each file is determined by its extension and naming:

| Condition | Strategy |
|-----------|----------|
| Has `.override` suffix (e.g., `settings.override.json`) | **Override** -- full replacement. |
| Has `.patch` suffix + merge-eligible extension | **Patch** -- declarative operations. |
| Merge-eligible extension (`.json`, `.jsonc`, `.yaml`, `.yml`, `.toml`) | **Overlay** -- deep merge. |
| All other extensions | **Override** -- full replacement. |

### Interpolation in Overlays

Text files with supported extensions (`.md`, `.txt`, `.json`, `.jsonc`, `.jsonl`, `.xml`, `.html`, `.svg`, `.toml`, `.yml`, `.yaml`) undergo variable interpolation before merging or copying.

### Plugin Merge

When plugins are configured, the overlay step processes files from multiple **layers** in order:

1. Plugin layers (in order of declaration in `config.yml`)
2. Local project layer (`.agloom/overlays/<adapterId>/`)

Later layers have higher priority. Each layer's files are interpolated with the layer's own resolved values (per-plugin isolation), then merged with the accumulated state.

### Deep Merge Rules

For merge-eligible files:

- Object keys are merged recursively.
- Arrays are replaced entirely (use patch operations for fine-grained array control).
- Scalar values are replaced by the later layer.
