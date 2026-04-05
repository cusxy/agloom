# agloom

> **Warning:** This project is in active development and experimentation. Its API is unstable and may introduce breaking changes at any time. Use at your own risk.

Transpile canonical agent configurations across AI coding assistants.

Write your instructions, skills, and agent definitions once in a single `.agloom/` directory — agloom generates the correct config files for each target tool.

## The problem

AI coding assistants each expect their own config format: Claude Code reads `CLAUDE.md` and `.claude/`, OpenCode reads `AGENTS.md` and `.opencode/`, Agents.md-compatible tools read `AGENTS.md`. Maintaining these by hand is tedious and error-prone.

## The solution

agloom introduces a **canonical format** — Markdown files under `.agloom/` — and **transpiles** them into agent-specific outputs. One source of truth, multiple outputs. Think Sass to CSS, or TypeScript to JavaScript.

## Quick start

```bash
npm install -g agloom

mkdir -p .agloom/instructions
echo "adapters:\n  - claude" > .agloom/config.yml
echo "# My Project\n\nInstructions for AI assistants." > .agloom/instructions/AGLOOM.md

agloom transpile
```

This generates `CLAUDE.md` and `.claude/` from your canonical config. See the [Getting Started](docs/guide/getting-started.md) guide for a full walkthrough.

## Supported adapters

| Adapter    | Description                             | Key outputs                     |
| ---------- | --------------------------------------- | ------------------------------- |
| `claude`   | Claude Code                             | `CLAUDE.md`, `.claude/`         |
| `opencode` | OpenCode                                | `AGENTS.md`, `.opencode/`       |
| `agentsmd` | Agents.md (Codex, KiloCode, Goose, ...) | `AGENTS.md`                     |

## Documentation

### Guide

Step-by-step tutorials for learning agloom:

- [Introduction](docs/guide/introduction.md) — The problem, the solution, and core principles
- [Getting Started](docs/guide/getting-started.md) — From zero to first transpile in 5 minutes
- [Project Structure](docs/guide/project-structure.md) — Anatomy of the `.agloom/` directory
- [Instructions](docs/guide/instructions.md) — Writing instructions with agent-specific blocks
- [Skills & Agents](docs/guide/skills-and-agents.md) — Creating reusable skills and sub-agents
- [Plugins](docs/guide/plugins.md) — Using and creating plugins
- [Overlays](docs/guide/overlays.md) — Per-adapter customization with merge, override, and patch
- [Variables](docs/guide/variables.md) — Interpolation and the values system

### Reference

Complete specifications for every feature:

- [CLI Commands](docs/reference/cli.md) — All commands, flags, and exit codes
- [Configuration](docs/reference/config.md) — Full `.agloom/config.yml` schema
- [Plugin Manifest](docs/reference/plugin-manifest.md) — Full `plugin.yml` schema
- [Adapters](docs/reference/adapters.md) — Adapter capabilities and output paths
- [Interpolation](docs/reference/interpolation.md) — Variable namespaces, syntax, and resolution
- [Patch Operations](docs/reference/patch-operations.md) — `$set`, `$merge`, `$append`, and more
- [Transpilers](docs/reference/transpilers.md) — Pipeline modules and processing order

## License

[Apache 2.0](LICENSE)
