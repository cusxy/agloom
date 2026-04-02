# agloom

> **⚠️ Warning:** This project is in active development and experimentation. Its API is unstable and may introduce breaking changes at any time. Use at your own risk.

Transpile canonical agent configurations across AI coding assistants.

Write your instructions, skills, and agent definitions once — agloom generates the correct config files for each target (Claude Code, OpenCode, Agents.md, and more).

## Problem

AI coding assistants each expect their own config format: Claude Code reads `CLAUDE.md` and `.claude/`, OpenCode reads `AGENTS.md` and `.opencode/`, Agents.md-compatible tools read `AGENTS.md`, etc. Maintaining configs for multiple agents by hand is tedious and error-prone.

## Solution

agloom introduces a **canonical format** (Markdown files under `.agloom/`) and **transpiles** them into agent-specific files. One source of truth, multiple outputs.

```
.agloom/
  config.yml            # project configuration
  instructions/         # project-wide instructions
  skills/               # reusable skill definitions
  agents/               # sub-agent definitions
  overlays/<adapter>/   # per-adapter overrides
```

## Installation

```bash
npm install -g agloom
```

## Usage

### Transpile configs for an adapter

```bash
agloom transpile --adapter claude
agloom transpile --adapter opencode
agloom transpile --adapter agentsmd
```

Use `--verbose` for detailed output.

### Clean generated files

```bash
agloom clean --adapter claude
agloom clean --all              # clean all adapters
```

### Import existing configs

```bash
agloom init --adapter claude
```

### List available adapters

```bash
agloom adapters
```

## Supported adapters

| Adapter    | Description                        |
|------------|------------------------------------|
| `claude`   | Claude Code (`CLAUDE.md`, `.claude/`) |
| `opencode` | OpenCode (`AGENTS.md`, `.opencode/`)  |
| `agentsmd` | Agents.md (`AGENTS.md`)               |

## How it works

agloom has five transpiler modules that run in sequence:

1. **Instructions Transpiler** — converts `.agloom/instructions/*.md` into the agent's instruction file format
2. **Skills Transpiler** — converts `.agloom/skills/` into agent-specific skill configs
3. **Agents Transpiler** — converts `.agloom/agents/` into sub-agent definitions
4. **Docs Transpiler** — copies `.agloom/docs/` to agent-specific documentation directories
5. **Schemas Transpiler** — copies `.agloom/schemas/` to agent-specific schema directories

Each module uses an **adapter** that knows how to write output for its target agent. The adapter system is extensible — you can add support for new agents by implementing the adapter interface.

Instructions support **agent-specific blocks** — sections that are only included when transpiling for a particular adapter.

### Plugins

agloom supports **plugins** — reusable packages of agents, skills, docs, and schemas that can be shared across projects. Plugins are loaded from local paths or git repositories.

```yaml
# .agloom/config.yml
plugins:
  - git@github.com:user/my-plugin
  - ../local-plugin
```

Plugins go through the same transpilation pipeline as local `.agloom/` content and are merged into the project's output.

### Configuration

Project-level settings live in `.agloom/config.yml`. See [config spec](docs/specs/config.md) for details.

### Overlays

After transpiling, agloom applies **overlays** from `.agloom/overlays/<adapter>/`. These are raw files copied directly to the adapter's output directory, letting you add adapter-specific config that doesn't fit the canonical format.

## License

[Apache 2.0](LICENSE)
