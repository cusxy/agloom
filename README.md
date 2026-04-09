# Agloom

> **Warning:** This project is in active development. Its API may introduce breaking changes between minor versions. Use at your own risk.

Transpile canonical agent configurations across AI coding assistants.

Write your instructions, skills, agents, MCP servers, and permissions once in a single `.agloom/` directory — agloom generates the correct config files for each target tool.

## The problem

AI coding assistants each expect their own config format: Claude Code reads `CLAUDE.md` and `.claude/`, OpenCode reads `AGENTS.md` and `.opencode/`, Gemini CLI reads `GEMINI.md` and `.gemini/`, KiloCode reads `.kilo/`, and so on. Maintaining these by hand is tedious and error-prone.

## The solution

agloom introduces a **canonical format** — Markdown and YAML files under `.agloom/` — and **transpiles** them into agent-specific outputs. One source of truth, multiple outputs. Think Sass → CSS, or TypeScript → JavaScript.

## Quick start

```bash
npm install -g agloom

mkdir -p .agloom/instructions
echo "adapters:\n  - claude" > .agloom/config.yml
echo "# My Project\n\nInstructions for AI assistants." > .agloom/instructions/AGLOOM.md

agloom transpile
```

This generates `CLAUDE.md` and `.claude/` from your canonical config. See the [Getting Started](https://docs.agloom.sh/guide/getting-started) guide for a full walkthrough.

## Supported adapters

| Adapter    | Description                          | Key outputs                     |
| ---------- | ------------------------------------ | ------------------------------- |
| `claude`   | Claude Code                          | `CLAUDE.md`, `.claude/`         |
| `opencode` | OpenCode                             | `AGENTS.md`, `.opencode/`       |
| `gemini`   | Gemini CLI                           | `GEMINI.md`, `.gemini/`         |
| `kilocode` | KiloCode                             | `AGENTS.md`, `.kilo/`           |
| `codex`    | Codex CLI                            | `AGENTS.md`, `.codex/`          |
| `agentsmd` | Any AGENTS.md-compatible tool        | `AGENTS.md`                     |

## Transpilers

agloom processes six types of canonical config:

| Transpiler       | Source                        | Description                         |
| ---------------- | ----------------------------- | ----------------------------------- |
| Instructions     | `.agloom/instructions/`       | System instructions per agent       |
| Skills           | `.agloom/skills/`             | Reusable slash commands             |
| Agents           | `.agloom/agents/`             | Sub-agent definitions               |
| Commands         | `.agloom/commands/`           | Custom CLI commands                 |
| MCP              | `.agloom/mcp.yml`             | MCP server configuration            |
| Permissions      | `.agloom/permissions.yml`     | Tool permission rules               |

## Documentation

Full documentation is available at [docs.agloom.sh](https://docs.agloom.sh).

### Guide

Step-by-step tutorials for learning agloom:

- [Introduction](https://docs.agloom.sh/guide/introduction) — The problem, the solution, and core principles
- [Getting Started](https://docs.agloom.sh/guide/getting-started) — From zero to first transpile in 5 minutes
- [Project Structure](https://docs.agloom.sh/guide/project-structure) — Anatomy of the `.agloom/` directory
- [Instructions](https://docs.agloom.sh/guide/instructions) — Writing instructions with agent-specific blocks
- [Skills & Agents](https://docs.agloom.sh/guide/skills-and-agents) — Creating reusable skills and sub-agents
- [Plugins](https://docs.agloom.sh/guide/plugins) — Using and creating plugins
- [Overlays](https://docs.agloom.sh/guide/overlays) — Per-adapter customization with merge, override, and patch
- [Variables](https://docs.agloom.sh/guide/variables) — Interpolation and the values system

### Reference

Complete specifications for every feature:

- [CLI Commands](https://docs.agloom.sh/reference/cli) — All commands, flags, and exit codes
- [Configuration](https://docs.agloom.sh/reference/config) — Full `.agloom/config.yml` schema
- [Plugin Manifest](https://docs.agloom.sh/reference/plugin-manifest) — Full `plugin.yml` schema
- [Adapters](https://docs.agloom.sh/reference/adapters) — Adapter capabilities and output paths
- [Interpolation](https://docs.agloom.sh/reference/interpolation) — Variable namespaces, syntax, and resolution
- [Patch Operations](https://docs.agloom.sh/reference/patch-operations) — `$set`, `$merge`, `$append`, and more
- [Transpilers](https://docs.agloom.sh/reference/transpilers) — Pipeline modules and processing order

## License

[Apache 2.0](LICENSE)
