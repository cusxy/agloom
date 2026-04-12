---
title: Transpilers
description: Reference for all transpiler modules, pipeline order, and overlay step
prev: patch-operations
sidebar_position: 7
---

# Transpilers

Agloom uses a pipeline of transpiler modules to convert canonical files into agent-specific output. Each module handles a specific content type.

## Pipeline Overview

Transpiler modules execute in this fixed order for each adapter:

1. **Instructions** — transforms `AGLOOM.md` into agent-specific instruction files.
2. **Commands** — transforms slash-command definitions from `.agloom/commands/` to agent-specific directories.
3. **Skills** — copies skill packages from `.agloom/skills/` to agent-specific directories.
4. **Agents** — transforms agent definitions from `.agloom/agents/` to agent-specific directories.
5. **Docs** — copies documentation files from `.agloom/docs/` to agent-specific directories.
6. **Schemas** — copies schema files from `.agloom/schemas/` to agent-specific directories.
7. **Overlay step** — applies overlay files, MCP configuration, and permissions.

Steps 1-6 run independently for each adapter. Step 7 (overlay) applies after all transpiler modules and handles cross-cutting concerns like file merging and adapter-specific overrides.

Commands runs before Skills to ensure correct priority for the Codex adapter: commands are converted to skill packages first, and skills from the Skills transpiler overwrite them when names conflict.

## Instructions Transpiler

**Source:** `AGLOOM.md` in the project root and `**/AGLOOM.md` in subdirectories

**Operation:** Transforms content — parses YAML frontmatter, applies per-agent override fields, filters agent-specific sections in the Markdown body.

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

| Agent ID   | Valid? | Reason                          |
| ---------- | ------ | ------------------------------- |
| `claude`   | Yes    | Has `CLAUDE.md`                 |
| `agentsmd` | Yes    | Has `AGENTS.md`                 |
| `gemini`   | Yes    | Has `GEMINI.md`                 |
| `opencode` | No     | Uses `AGENTS.md` via `agentsmd` |
| `kilocode` | No     | Uses `AGENTS.md` via `agentsmd` |
| `codex`    | No     | Uses `AGENTS.md` via `agentsmd` |

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

| Adapter    | Input       | Output                               |
| ---------- | ----------- | ------------------------------------ |
| `claude`   | `AGLOOM.md` | `CLAUDE.md` (same relative location) |
| `agentsmd` | `AGLOOM.md` | `AGENTS.md` (same relative location) |
| `gemini`   | `AGLOOM.md` | `GEMINI.md` (same relative location) |
| `opencode` | _(no-op)_   | _(no output)_                        |
| `kilocode` | _(no-op)_   | _(no output)_                        |
| `codex`    | _(no-op)_   | _(no output)_                        |

---

## Commands Transpiler

**Source:** `.agloom/commands/` directory (recursive, including subdirectories)

**Operation:** Transforms command definitions — parses YAML frontmatter, applies per-agent override fields, filters agent-specific sections in the Markdown body. Same transformation mechanism as the agents transpiler.

### Canonical Format

A command is a single `.md` file in `.agloom/commands/` with YAML frontmatter and a Markdown body. Files may be organized into subdirectories of arbitrary depth (e.g., `.agloom/commands/git/commit.md`).

The command name is derived from the file path relative to the commands directory, without the `.md` extension:

- `commands/deploy.md` — name: `deploy`
- `commands/git/commit.md` — name: `git/commit`

### Frontmatter Override

Same mechanism as the agents transpiler:

```yaml
---
description: Deploy to production
override:
  gemini:
    description: Deploy the app to production
  claude:
    argument-hint: "[environment]"
---
```

The `override` key is removed from the output. Keys from `override[agentId]` replace top-level keys in the frontmatter.

### Subdirectory Handling

Adapters use one of two modes for subdirectory structure:

| Mode         | Behavior                                                 | Adapters                        |
| ------------ | -------------------------------------------------------- | ------------------------------- |
| **Preserve** | Subdirectory structure is maintained in the output       | `claude`, `gemini`              |
| **Flatten**  | All files are placed in the root of the target directory | `opencode`, `kilocode`, `codex` |

When flattening, if files from different subdirectories have the same filename, transpilation fails with a name conflict error.

### Output Per Adapter

| Adapter    | Output Directory                 | Format                      | Subdirs               |
| ---------- | -------------------------------- | --------------------------- | --------------------- |
| `claude`   | `.claude/commands/`              | Markdown                    | Preserve              |
| `opencode` | `.opencode/commands/`            | Markdown                    | Flatten               |
| `kilocode` | `.kilo/commands/`                | Markdown                    | Flatten               |
| `gemini`   | `.gemini/commands/`              | TOML (`.toml` extension)    | Preserve              |
| `codex`    | `.agents/skills/<name>/SKILL.md` | Markdown (as skill package) | Flatten (hyphen-join) |
| `agentsmd` | _(no output)_                    | --                          | --                    |

**Gemini adapter:** After standard content transformation, the adapter converts the result from Markdown to TOML. Frontmatter fields become top-level TOML keys. The Markdown body (if non-empty) becomes the `prompt` key. The output file extension changes from `.md` to `.toml`.

**Codex adapter:** Since Codex does not support project-level commands, each command is converted into a skill package at `.agents/skills/<name>/SKILL.md`. Subdirectory separators in the command name are replaced with hyphens (e.g., `git/commit` becomes `git-commit`). If a skill with the same name exists in `.agloom/skills/`, the skill takes priority (it overwrites the command-generated file because Skills runs after Commands).

---

## Skills Transpiler

**Source:** `.agloom/skills/<name>/` directories

**Operation:** Copies skill packages (directory with `SKILL.md` and supporting files) into agent-specific skill directories. No content transformation — files are copied as-is, except `.md` files undergo interpolation when variables are provided.

### Canonical Format

A skill is a directory in `.agloom/skills/<name>/` containing a `SKILL.md` file (YAML frontmatter + Markdown body) and optional supporting files. The transpiler does not validate or transform skill content.

### Output Per Adapter

Skills are copied to the adapter's `paths.skills` directory:

| Adapter    | Output Directory            |
| ---------- | --------------------------- |
| `claude`   | `.claude/skills/<name>/`    |
| `opencode` | `.opencode/skills/<name>/`  |
| `kilocode` | `.kilo/skills/<name>/`      |
| `codex`    | `.agents/skills/<name>/`    |
| `gemini`   | `.gemini/skills/<name>/`    |
| `agentsmd` | _(no output — empty paths)_ |

---

## Agents Transpiler

**Source:** `.agloom/agents/<name>.md` files

**Operation:** Transforms agent definitions — parses YAML frontmatter, applies per-agent override fields, filters agent-specific sections in the Markdown body. Same transformation mechanism as instructions transpiler (but without `allowedAgentIds` validation on agent-specific sections).

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

| Adapter    | Output Directory             |
| ---------- | ---------------------------- |
| `claude`   | `.claude/agents/<name>.md`   |
| `opencode` | `.opencode/agents/<name>.md` |
| `kilocode` | `.kilo/agents/<name>.md`     |
| `codex`    | `.codex/agents/<name>.md`    |
| `gemini`   | `.gemini/agents/<name>.md`   |
| `agentsmd` | _(no output — empty paths)_  |

---

## Docs Transpiler

**Source:** `.agloom/docs/` directory

**Operation:** Copies documentation files to agent-specific docs directories. Markdown and other text files undergo interpolation when variables are provided.

### Output Per Adapter

| Adapter    | Output Directory  |
| ---------- | ----------------- |
| `claude`   | `.claude/docs/`   |
| `opencode` | `.opencode/docs/` |
| `kilocode` | `.kilo/docs/`     |
| `codex`    | `.codex/docs/`    |
| `gemini`   | `.gemini/docs/`   |
| `agentsmd` | _(no output)_     |

---

## Schemas Transpiler

**Source:** `.agloom/schemas/` directory

**Operation:** Copies schema files (JSON Schema, OpenAPI, etc.) to agent-specific schemas directories. Text files undergo interpolation when variables are provided.

### Output Per Adapter

| Adapter    | Output Directory     |
| ---------- | -------------------- |
| `claude`   | `.claude/schemas/`   |
| `opencode` | `.opencode/schemas/` |
| `kilocode` | `.kilo/schemas/`     |
| `codex`    | `.codex/schemas/`    |
| `gemini`   | `.gemini/schemas/`   |
| `agentsmd` | _(no output)_        |

---

## MCP Transpiler

**Source:** `.agloom/mcp.yml` or `.agloom/mcp.json`

**Operation:** Transforms the canonical MCP server configuration into adapter-specific formats. Supports three transport types: stdio (local process), HTTP (streamable HTTP), and SSE (Server-Sent Events).

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
  figma:
    type: http
    url: https://mcp.figma.com/mcp
    headers:
      X-Figma-Region: us-east-1
  asana:
    type: sse
    url: https://mcp.asana.com/sse
    headers:
      Authorization: "Bearer ${env:ASANA_TOKEN}"
```

#### Common Fields

| Field          | Type                             | Default   | Description                                                  |
| -------------- | -------------------------------- | --------- | ------------------------------------------------------------ |
| `type`         | `"stdio"` \| `"http"` \| `"sse"` | `"stdio"` | Transport type.                                              |
| `includeTools` | array\<string>                   | -         | Whitelist of tools (mutually exclusive with `excludeTools`). |
| `excludeTools` | array\<string>                   | -         | Blacklist of tools (mutually exclusive with `includeTools`). |

#### Stdio Fields (when `type` is `"stdio"` or omitted)

| Field     | Type           | Description                                |
| --------- | -------------- | ------------------------------------------ |
| `command` | string         | **Required.** Command to start the server. |
| `args`    | array\<string> | Command arguments.                         |
| `env`     | object         | Environment variables for the process.     |

Fields `url` and `headers` are forbidden for stdio.

#### HTTP/SSE Fields (when `type` is `"http"` or `"sse"`)

| Field     | Type   | Description                                 |
| --------- | ------ | ------------------------------------------- |
| `url`     | string | **Required.** URL of the remote MCP server. |
| `headers` | object | HTTP headers sent when connecting.          |

Fields `command`, `args`, and `env` are forbidden for http/sse.

### Discovery-Level Tool Filtering

The `includeTools`/`excludeTools` fields control which tools an MCP client advertises to the model. This is **not** the same as runtime permission gating (which is handled by `.agloom/permissions.yml`).

Only adapters whose target format has native filtering fields apply these canonically:

| Adapter    | Native support | Mechanism                                                  |
| ---------- | -------------- | ---------------------------------------------------------- |
| `codex`    | Yes            | `enabled_tools` / `disabled_tools` in `.codex/config.toml` |
| `gemini`   | Yes            | `includeTools` / `excludeTools` in `.gemini/settings.json` |
| `claude`   | No             | Ignored with warning. Use `permissions.yml` instead.       |
| `opencode` | No             | Ignored with warning. Use `permissions.yml` instead.       |
| `kilocode` | No             | Ignored with warning. Use `permissions.yml` instead.       |

### Output Per Adapter

| Adapter    | Output File             | Transport Support | Notes                                                                         |
| ---------- | ----------------------- | ----------------- | ----------------------------------------------------------------------------- |
| `claude`   | `.mcp.json`             | stdio, http, sse  | All transports passed through with explicit `type` field.                     |
| `opencode` | `opencode.json`         | stdio, http       | SSE servers skipped with warning. HTTP mapped to `type: "remote"`.            |
| `codex`    | `.codex/config.toml`    | stdio, http       | SSE servers skipped with warning. Headers in `http_headers` sub-table.        |
| `gemini`   | `.gemini/settings.json` | stdio, http, sse  | HTTP mapped to `httpUrl` key, SSE to `url` key. No `type` field in output.    |
| `kilocode` | `kilo.jsonc`            | stdio, http, sse  | HTTP mapped to `type: "streamable-http"`. Stdio entries have no `type` field. |

Only `.agloom/mcp.yml` or `.agloom/mcp.json` may exist — not both simultaneously.

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

| Section | Pattern Format                           | Actions                 |
| ------- | ---------------------------------------- | ----------------------- |
| `shell` | Glob matched against full command string | `allow`, `ask`, `deny`  |
| `mcp`   | `<server>:<tool>` format                 | `allow`, `ask`, `deny`  |
| `file`  | Glob matched against file path           | `deny`, `read`, `write` |

All sections are optional.

### Output Per Adapter

| Adapter    | Output File                    | Supported Sections | Notes                                                                                     |
| ---------- | ------------------------------ | ------------------ | ----------------------------------------------------------------------------------------- |
| `claude`   | `.claude/settings.json`        | shell, mcp         | First-match-wins preserved via preprocessing. `file` and `ask` action not supported.      |
| `opencode` | `opencode.json`                | shell, mcp, file   | Rule order **inverted** (OpenCode uses last-match-wins).                                  |
| `codex`    | `.codex/rules/agloom.rules`    | shell              | Starlark-like `prefix_rule` format. `mcp` and `file` sections skipped with warning.       |
| `gemini`   | `.gemini/policies/agloom.toml` | shell, mcp         | TOML `[[rule]]` format with priority-based ordering. `file` section skipped with warning. |
| `kilocode` | `kilo.jsonc`                   | shell, mcp, file   | Rule order **inverted** (last-match-wins). Deep-merged with MCP output in the same file.  |

Only `.agloom/permissions.yml` or `.agloom/permissions.json` may exist — not both simultaneously.

---

## Overlay Step

The overlay step runs **after** all transpiler modules. It applies per-adapter overlay files from `.agloom/overlays/<adapterId>/` to the project root.

### File Merge Strategies

The strategy for each file is determined by its extension and naming:

| Condition                                                              | Strategy                            |
| ---------------------------------------------------------------------- | ----------------------------------- |
| Has `.override` suffix (e.g., `settings.override.json`)                | **Override** — full replacement.    |
| Has `.patch` suffix + merge-eligible extension                         | **Patch** — declarative operations. |
| Merge-eligible extension (`.json`, `.jsonc`, `.yaml`, `.yml`, `.toml`) | **Overlay** — deep merge.           |
| All other extensions                                                   | **Override** — full replacement.    |

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
- A `null` value in the incoming layer removes the key from the result.

### Error Handling

If an existing base file (targeted by deep merge) cannot be parsed, the overlay step fails with a `LayerMergeError` instead of silently overwriting the file. The error includes the file path, format, and the parser's error message with position details. You must fix or remove the invalid file before retrying transpilation.

JSONC files (`.jsonc`) are parsed by stripping comments first, then running `JSON.parse`. Comments in base files are **not** preserved on round-trip — the merged output is always clean JSON. TOML files are parsed and serialized with `smol-toml`, which maintains stable key order.
