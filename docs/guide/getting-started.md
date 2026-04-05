---
title: Getting Started
description: From zero to your first transpile in 5 minutes
prev: introduction
next: project-structure
sidebar_position: 2
---

# Getting Started

This guide walks you through installing Agloom and running your first transpilation. By the end, you will have a working `.agloom/` directory and generated config files for Claude Code.

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

```bash
agloom init --adapter claude
```

This imports any existing Claude Code config files into the `.agloom/` directory and creates a `config.yml` if one does not exist.

Or create it manually:

```yaml
# .agloom/config.yml
adapters:
  - claude
```

The `adapters` field tells Agloom which target tools to generate files for.

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

Agloom reads your `.agloom/` directory and generates config files for each adapter. With the config above, it produces a `CLAUDE.md` in your project root.

By default, only steps that produced files are shown. Add `--verbose` to see all steps:

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

## Step 4: Verify

Open the generated `CLAUDE.md` and confirm it contains your instructions.

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
