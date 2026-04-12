# Agloom

> **Warning:** This project is in active development. Its API may introduce breaking changes between minor versions. Use at your own risk.

Write once. Ship to every agent.

Maintain instructions, skills, sub-agents, slash commands, MCP servers, and permissions in a single `.agloom/` directory — agloom transpiles them into the native config format of each AI coding assistant.

## The problem

AI coding assistants each expect their own config format: Claude Code reads `CLAUDE.md` and `.claude/`, Codex reads `AGENTS.md` and `.codex/`, Gemini CLI reads `GEMINI.md` and `.gemini/`, OpenCode reads `AGENTS.md` and `.opencode/`, and so on. Maintaining these by hand is tedious and error-prone — they drift apart over time.

## The solution

agloom introduces a **canonical format** — Markdown and YAML files under `.agloom/` — and **transpiles** them into agent-specific outputs. One source of truth, multiple outputs. Think Sass → CSS, or TypeScript → JavaScript.

## Quick start

```bash
npm install -g agloom

agloom init --adapter claude
echo "# My Project\n\nInstructions for AI assistants." > AGLOOM.md

agloom transpile
```

This generates `CLAUDE.md` and `.claude/` from your canonical config. See the [Getting Started](https://docs.agloom.sh/guide/getting-started) guide for a full walkthrough, or browse the [sample project](https://github.com/cusxy/agloom-sample) for a complete working example.

## Supported adapters

| Adapter    | Generated files                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude`   | `CLAUDE.md`, `.claude/agents/`, `.claude/commands/`, `.claude/docs/`, `.claude/schemas/`, `.claude/skills/`, `.claude/settings.json`, `.mcp.json`                    |
| `codex`    | `AGENTS.md`, `.agents/skills/`, `.codex/agents/`, `.codex/docs/`, `.codex/rules/agloom.rules`, `.codex/schemas/`, `.codex/config.toml`                               |
| `gemini`   | `GEMINI.md`, `.gemini/agents/`, `.gemini/commands/`, `.gemini/docs/`, `.gemini/policies/agloom.toml`, `.gemini/schemas/`, `.gemini/skills/`, `.gemini/settings.json` |
| `opencode` | `AGENTS.md`, `.opencode/agents/`, `.opencode/commands/`, `.opencode/docs/`, `.opencode/schemas/`, `.opencode/skills/`, `opencode.json`                               |
| `kilocode` | `AGENTS.md`, `.kilo/agents/`, `.kilo/commands/`, `.kilo/docs/`, `.kilo/schemas/`, `.kilo/skills/`, `kilo.jsonc`                                                      |
| `agentsmd` | `AGENTS.md` (generated automatically as a dependency)                                                                                                                |

## What gets transpiled

| Source                    | Description              |
| ------------------------ | ------------------------ |
| `AGLOOM.md`              | System instructions      |
| `.agloom/skills/`        | Reusable slash commands  |
| `.agloom/agents/`        | Sub-agent definitions    |
| `.agloom/commands/`      | Custom CLI commands      |
| `.agloom/mcp.yml`        | MCP server configuration |
| `.agloom/permissions.yml`| Tool permission rules    |

## Key features

### Variables and interpolation

Canonical files support three variable namespaces resolved at transpile time:

- `${env:VAR}` — from `.env` and process environment
- `${agloom:VAR}` — agent-aware paths (e.g. `SKILLS_DIR` resolves to `.claude/skills/` for Claude, `.opencode/skills/` for OpenCode)
- `${values:VAR}` — project and plugin variables declared in `config.yml`

### Plugins

Package team conventions, review checklists, and deployment skills as reusable plugins. Reference by git URL, pin a version, pass typed variables:

```yaml
# .agloom/config.yml
plugins:
  - url: https://github.com/acme/agloom-conventions.git
    ref: v1.2.0
    values:
      team: mobile
```

Plugins stack in declaration order with deep-merge semantics. Patch operations (`$set`, `$merge`, `$append`, and more) give fine-grained control over how layers combine.

### Overlays

Per-adapter customization without forking canonical files. Three modes: **merge** (deep-merge into output), **override** (replace entirely), and **patch** (targeted operations on specific keys).

### Formatting

`agloom format` — a pre-configured wrapper around Prettier and markdownlint targeting `.agloom/` files. No config to install, no plugins to wire up. Use as a pre-commit hook or run with `--check` in CI.

## For teams

- **One canonical source per repo** — every developer sees the same instructions regardless of which assistant they use. Drift between config files becomes structurally impossible.
- **Fleet-wide plugins** — publish a plugin, reference it from project configs, roll updates with a new tag. Pin versions for stability.
- **Project-scoped, never machine-scoped** — agloom only reads and writes inside the project directory. It never touches `~/` config. Reproducible across developer machines, CI runners, and contractor laptops.

## Documentation

Full documentation at [docs.agloom.sh](https://docs.agloom.sh).

**Guide** — step-by-step tutorials:
[Introduction](https://docs.agloom.sh/guide/introduction) ·
[Getting Started](https://docs.agloom.sh/guide/getting-started) ·
[Project Structure](https://docs.agloom.sh/guide/project-structure) ·
[Instructions](https://docs.agloom.sh/guide/instructions) ·
[Skills & Agents](https://docs.agloom.sh/guide/skills-and-agents) ·
[Plugins](https://docs.agloom.sh/guide/plugins) ·
[Overlays](https://docs.agloom.sh/guide/overlays) ·
[Variables](https://docs.agloom.sh/guide/variables)

**Reference** — complete specifications:
[CLI Commands](https://docs.agloom.sh/reference/cli) ·
[Configuration](https://docs.agloom.sh/reference/config) ·
[Plugin Manifest](https://docs.agloom.sh/reference/plugin-manifest) ·
[Adapters](https://docs.agloom.sh/reference/adapters) ·
[Interpolation](https://docs.agloom.sh/reference/interpolation) ·
[Patch Operations](https://docs.agloom.sh/reference/patch-operations) ·
[Transpilers](https://docs.agloom.sh/reference/transpilers)

## License

[Apache 2.0](LICENSE)
