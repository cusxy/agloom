---
title: Getting Started
description: From zero to your first transpile in 5 minutes
prev: introduction
next: project-structure
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Getting Started

This guide walks you through installing Agloom and running your first transpilation. By the end, you will have a working `.agloom/` directory and generated config files for your AI coding tool.

## Prerequisites

- **Node.js 20+** (check with `node -v`)
- **npm** or **pnpm** package manager

## Installation

Install Agloom globally:

```bash
npm install -g agloom
```

Verify the installation:

```bash
agloom --version
```

## Step 1: Initialize

Create a `.agloom/config.yml` file in your project root. You can do this manually or use the `init` command.

Using `init`:

<Tabs groupId="agent">
<TabItem value="claude" label="Claude Code">

```bash
agloom init --adapter claude
```

This creates a `config.yml` and copies any existing Claude Code files (`CLAUDE.md`, `.claude/`, `.mcp.json`) into `.agloom/overlays/claude/` so they are preserved as overlays.

</TabItem>
<TabItem value="codex" label="Codex">

```bash
agloom init --adapter codex
```

This creates a `config.yml` and copies any existing Codex files (`AGENTS.md`, `.codex/`, `.agents/`) into `.agloom/overlays/`.

</TabItem>
<TabItem value="gemini" label="Gemini">

```bash
agloom init --adapter gemini
```

This creates a `config.yml` and copies any existing Gemini files (`GEMINI.md`, `.gemini/`) into `.agloom/overlays/gemini/`.

</TabItem>
<TabItem value="opencode" label="OpenCode">

```bash
agloom init --adapter opencode
```

This creates a `config.yml` and copies any existing OpenCode files (`AGENTS.md`, `.opencode/`, `opencode.json`) into `.agloom/overlays/`.

</TabItem>
<TabItem value="kilocode" label="KiloCode">

```bash
agloom init --adapter kilocode
```

This creates a `config.yml` and copies any existing KiloCode files (`AGENTS.md`, `.kilo/`) into `.agloom/overlays/`.

</TabItem>
</Tabs>

Or create it manually:

<Tabs groupId="agent">
<TabItem value="claude" label="Claude Code">

```yaml
# .agloom/config.yml
adapters:
  - claude
```

</TabItem>
<TabItem value="codex" label="Codex">

```yaml
# .agloom/config.yml
adapters:
  - codex
```

</TabItem>
<TabItem value="gemini" label="Gemini">

```yaml
# .agloom/config.yml
adapters:
  - gemini
```

</TabItem>
<TabItem value="opencode" label="OpenCode">

```yaml
# .agloom/config.yml
adapters:
  - opencode
```

</TabItem>
<TabItem value="kilocode" label="KiloCode">

```yaml
# .agloom/config.yml
adapters:
  - kilocode
```

</TabItem>
</Tabs>

The `adapters` field tells Agloom which target tools to generate files for. You can list multiple adapters to generate files for several tools at once.

## Step 2: Write Instructions

Create an `AGLOOM.md` file in your project root with your project instructions:

```markdown
# My Project

## Stack

TypeScript, Node.js, React.

## Conventions

- Use functional components.
- Write tests for all new features.
- Keep functions pure when possible.
```

Agloom discovers `AGLOOM.md` files in the project root and any subdirectories (excluding `node_modules`, hidden directories, and `.gitignore` entries). Each file is transpiled into the corresponding instruction file for every adapter listed in your config.

## Step 3: Transpile

Run the transpile command:

```bash
agloom transpile
```

Agloom reads your `.agloom/` directory and generates config files for each adapter:

<Tabs groupId="agent">
<TabItem value="claude" label="Claude Code">

Produces a `CLAUDE.md` in your project root.

Add `--verbose` to see all steps:

```bash
agloom transpile --verbose
```

```
✓ Transpiling for claude...
  ✓ Instructions         1 file
  ✓ Skills               0 files
  ✓ Agents               0 files
  ✓ Docs                 0 files
  ✓ Schemas              0 files
  ✓ MCP                  0 files
  ✓ Permissions          0 files
  ✓ Overlay              0 files
Done. 1 file written.
```

</TabItem>
<TabItem value="codex" label="Codex">

Produces an `AGENTS.md` in your project root (the shared instruction format used by Codex).

Add `--verbose` to see all steps:

```bash
agloom transpile --verbose
```

```
✓ Transpiling for agentsmd...
  ✓ Instructions         1 file
✓ Transpiling for codex...
  ✓ Instructions         0 files
  ✓ Skills               0 files
  ✓ Agents               0 files
  ✓ Overlay              0 files
Done. 1 file written.
```

</TabItem>
<TabItem value="gemini" label="Gemini">

Produces a `GEMINI.md` in your project root.

Add `--verbose` to see all steps:

```bash
agloom transpile --verbose
```

```
✓ Transpiling for gemini...
  ✓ Instructions         1 file
  ✓ Skills               0 files
  ✓ Agents               0 files
  ✓ Docs                 0 files
  ✓ Schemas              0 files
  ✓ Overlay              0 files
Done. 1 file written.
```

</TabItem>
<TabItem value="opencode" label="OpenCode">

Produces an `AGENTS.md` in your project root (the shared instruction format used by OpenCode).

Add `--verbose` to see all steps:

```bash
agloom transpile --verbose
```

```
✓ Transpiling for agentsmd...
  ✓ Instructions         1 file
✓ Transpiling for opencode...
  ✓ Instructions         0 files
  ✓ Skills               0 files
  ✓ Agents               0 files
  ✓ MCP                  0 files
  ✓ Permissions          0 files
  ✓ Overlay              0 files
Done. 1 file written.
```

</TabItem>
<TabItem value="kilocode" label="KiloCode">

Produces an `AGENTS.md` in your project root (the shared instruction format used by KiloCode).

Add `--verbose` to see all steps:

```bash
agloom transpile --verbose
```

```
✓ Transpiling for agentsmd...
  ✓ Instructions         1 file
✓ Transpiling for kilocode...
  ✓ Instructions         0 files
  ✓ Skills               0 files
  ✓ Agents               0 files
  ✓ Overlay              0 files
Done. 1 file written.
```

</TabItem>
</Tabs>

## Step 4: Verify

<Tabs groupId="agent">
<TabItem value="claude" label="Claude Code">

Open the generated `CLAUDE.md` and confirm it contains your instructions.

</TabItem>
<TabItem value="codex" label="Codex">

Open the generated `AGENTS.md` and confirm it contains your instructions.

</TabItem>
<TabItem value="gemini" label="Gemini">

Open the generated `GEMINI.md` and confirm it contains your instructions.

</TabItem>
<TabItem value="opencode" label="OpenCode">

Open the generated `AGENTS.md` and confirm it contains your instructions.

</TabItem>
<TabItem value="kilocode" label="KiloCode">

Open the generated `AGENTS.md` and confirm it contains your instructions.

</TabItem>
</Tabs>

## Formatting

Agloom includes a `format` command to format canonical files (Markdown, JSON, YAML, TOML). By default, it targets `.agloom/**/*` and `**/AGLOOM.md`:

```bash
agloom format
```

You can pass specific paths or globs, or use `--all` to format all supported files in the project:

```bash
agloom format "docs/**/*.md"
agloom format --all
```

Use `--check` to verify formatting without modifying files. See [reference/cli](../reference/cli.md) for full details.

## What's Next

- Learn about the [project structure](project-structure.md) to understand what goes where in `.agloom/`.
- Add [agent-specific instructions](instructions.md) for different tools.
- Create reusable [skills and agents](skills-and-agents.md).
- Share configurations with [plugins](plugins.md).
