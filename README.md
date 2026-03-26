# agloom

Transpile canonical agent configurations across AI coding assistants.

Write your instructions, skills, and agent definitions once — agloom generates the correct config files for each target (Claude Code, OpenCode, and more).

## Problem

AI coding assistants each expect their own config format: Claude Code reads `CLAUDE.md` and `.claude/`, OpenCode reads `AGENTS.md` and `.opencode/`, etc. Maintaining configs for multiple agents by hand is tedious and error-prone.

## Solution

agloom introduces a **canonical format** (Markdown files under `.agloom/`) and **transpiles** them into agent-specific files. One source of truth, multiple outputs.

```
.agloom/
  instructions/       # project-wide instructions
  skills/             # reusable skill definitions
  agents/             # sub-agent definitions
  overlays/<agent>/   # per-agent overrides
```

## Installation

```bash
npm install -g agloom
```

## Usage

### Transpile configs for an agent

```bash
agloom transpile --adapter claude
agloom transpile --adapter opencode
```

### Clean generated files

```bash
agloom clean --adapter claude
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

| Adapter    | Description |
|------------|-------------|
| `claude`   | Claude Code |
| `opencode` | OpenCode    |

## How it works

agloom has three transpiler modules that run in sequence:

1. **Instructions Transpiler** — converts `.agloom/instructions/*.md` into the agent's instruction file format
2. **Skills Transpiler** — converts `.agloom/skills/*.md` into agent-specific skill configs
3. **Agents Transpiler** — converts `.agloom/agents/*.md` into sub-agent definitions

Each module uses an **adapter** that knows how to write output for its target agent. The adapter system is extensible — you can add support for new agents by implementing the adapter interface.

### Overlays

After transpiling, agloom applies **overlays** from `.agloom/overlays/<agent>/`. These are raw files copied directly to the agent's output directory, letting you add agent-specific config that doesn't fit the canonical format.

## License

[Apache 2.0](LICENSE)
