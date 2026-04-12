---
title: Project Structure
description: Anatomy of the .agloom/ directory and generated output files
prev: getting-started
next: instructions
sidebar_position: 3
---

# Project Structure

This guide explains the layout of the `.agloom/` directory and how it maps to generated output files.

## Canonical Directory

The `.agloom/` directory is the single source of truth for your project's AI agent configuration. Here is the full structure:

```text
.agloom/
├── agents/                 # Sub-agent definitions
│   └── reviewer.md
├── commands/               # Slash-command definitions
│   ├── deploy.md
│   └── git/
│       └── commit.md
├── docs/                   # Documentation files for agents
├── schemas/                # JSON/OpenAPI schemas for other files
├── skills/                 # Reusable skill definitions
│   └── my-skill/
│       ├── SKILL.md
│       └── helpers.ts
├── config.yml              # Project configuration (adapters, plugins, variables)
├── mcp.yml                 # MCP server configuration
├── permissions.yml         # Agent permissions
├── overlays/               # Per-adapter overrides
│   ├── claude/
│   └── opencode/
└── AGLOOM.md               # Instructions for AI agents
```

### What Each Part Does

**`config.yml`** — project configuration. Lists which adapters to use, which plugins to load, and project-level variables.

**`AGLOOM.md`** — top-level `AGLOOM.md` file, the canonical instructions file. This is where you write project conventions, stack descriptions, and coding guidelines that AI agents should follow.

**`skills/`** — reusable action definitions. Each skill is a directory containing a `SKILL.md` file and any supporting files. Skills are copied to each agent's skill directory during transpilation.

**`agents/`** — sub-agent definitions. Each agent is a single `.md` file with YAML frontmatter describing the agent's role, model, and tools.

**`commands/`** — slash-command definitions. Each command is a single `.md` file with YAML frontmatter and a Markdown body. Commands may be organized into subdirectories (e.g., `commands/git/commit.md`). During transpilation, commands are transformed and written to each agent's commands directory. See [Skills and Agents](skills-and-agents.md) for details on creating commands.

**`docs/`** — documentation files that agents can reference. Copied to each agent's docs directory.

**`schemas/`** — JSON or OpenAPI schema files. Copied to each agent's schemas directory.

**`mcp.yml`** — MCP (Model Context Protocol) server configuration. Transpiled into agent-specific formats for all adapters with MCP support (`.mcp.json` for Claude, `opencode.json` for OpenCode, etc.). See [reference/transpilers](../reference/transpilers.md) for details.

**`permissions.yml`** — agent permissions configuration. Transpiled into agent-specific formats. See [reference/transpilers](../reference/transpilers.md) for details.

**`overlays/`** — per-agent override files. Files placed here are copied directly to the project root after transpilation. Use overlays for agent-specific config that does not fit the canonical format. See [Overlays](overlays.md) for details.

## Generated Files

Each adapter generates different output files. Here is what you get:

| Adapter    | Generated files                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude`   | `CLAUDE.md`, `.claude/agents/`, `.claude/commands/`, `.claude/docs/`, `.claude/schemas/`, `.claude/skills/`, `.claude/settings.json`, `.mcp.json`                    |
| `codex`    | `AGENTS.md`, `.agents/skills/`, `.codex/agents/`, `.codex/docs/`, `.codex/rules/agloom.rules`, `.codex/schemas/`, `.codex/config.toml`                               |
| `gemini`   | `GEMINI.md`, `.gemini/agents/`, `.gemini/commands/`, `.gemini/docs/`, `.gemini/policies/agloom.toml`, `.gemini/schemas/`, `.gemini/skills/`, `.gemini/settings.json` |
| `opencode` | `AGENTS.md`, `.opencode/agents/`, `.opencode/commands/`, `.opencode/docs/`, `.opencode/schemas/`, `.opencode/skills/`, `opencode.json`                               |
| `kilocode` | `AGENTS.md`, `.kilo/agents/`, `.kilo/commands/`, `.kilo/docs/`, `.kilo/schemas/`, `.kilo/skills/`, `kilo.jsonc`                                                      |
| `agentsmd` | `AGENTS.md` (generated automatically as a dependency)                                                                                                                |

Note that `agentsmd` is a hidden adapter — you do not configure it directly. It is included automatically when you use `opencode`, `kilocode`, or `codex` (which depend on it for `AGENTS.md` generation).

## Important Rule

**Never edit generated files directly.** Always edit the canonical files in `.agloom/` and run `agloom transpile`. Generated files are overwritten on every transpile run.

## .gitignore

It is recommended to **commit** the `.agloom/` directory to version control and **add generated files** to `.gitignore`:

```gitignore
# Agloom (local instructions)
AGLOOM.override.md

# AGENTS.md generated
AGENTS.md
AGENTS.override.md
!.agloom/**/AGENTS

# Claude Code generated
.claude/
.mcp.json
CLAUDE.md
!.agloom/**/.claude
!.agloom/**/.mcp.json
!.agloom/**/CLAUDE.md

# Codex generated
.agents/
.codex/
!.agloom/**/.agents
!.agloom/**/.codex

# Gemini generated
.gemini/
GEMINI.md
!.agloom/**/.gemini
!.agloom/**/GEMINI.md

# OpenCode generated
.opencode/
opencode.json
opencode.jsonc
!.agloom/**/.opencode
!.agloom/**/opencode.json
!.agloom/**/opencode.jsonc

# KiloCode generated
.kilo/
kilo.json
kilo.jsonc
!.agloom/**/.kilo
!.agloom/**/kilo.json
!.agloom/**/kilo.jsonc
```

This way, your team shares the canonical source and each developer generates output locally.
