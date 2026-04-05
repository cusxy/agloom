---
title: Introduction
description: What Agloom does, why it exists, and when to use it
next: getting-started
sidebar_position: 1
---

# Introduction

## The Problem

AI coding assistants are becoming an essential part of the development workflow. Claude Code, OpenCode, Codex, KiloCode, Gemini, and others each bring unique capabilities to the table. But they also bring unique configuration formats:

- Claude Code reads `CLAUDE.md` and `.claude/`
- OpenCode reads `AGENTS.md` and `.opencode/`
- Codex reads `AGENTS.md` and `.codex/`
- KiloCode reads `AGENTS.md` and `.kilo/`
- Gemini reads `GEMINI.md` and `.gemini/`

Maintaining separate config files for each assistant is tedious and error-prone. Instructions drift apart, skills get duplicated, and there is no single source of truth for how your project should be understood by AI agents.

## The Solution

Agloom introduces a **canonical format** -- a single `.agloom/` directory that holds all your instructions, skills, agent definitions, docs, and schemas. When you run `agloom transpile`, it generates the correct config files for each target assistant.

Think of it like Sass compiling to CSS, or TypeScript compiling to JavaScript. You write once, and Agloom produces the right output for each tool.

```
.agloom/                          Output:
  instructions/AGLOOM.md    -->   CLAUDE.md, AGENTS.md, GEMINI.md
  skills/                   -->   .claude/skills/, .opencode/skills/, ...
  agents/                   -->   .claude/agents/, .opencode/agents/, ...
```

## Core Principles

**Single source of truth.** One `.agloom/` directory, multiple outputs. Edit your instructions in one place and let Agloom keep everything in sync.

**Adapter-driven.** Each target tool is supported by an adapter. Adapters know how to transform canonical files into the format their tool expects. Agloom ships with adapters for Claude Code, OpenCode, Codex, KiloCode, and Gemini.

**Plugin-extensible.** Package your skills, agents, docs, and schemas into plugins and reuse them across projects. Plugins can be loaded from local directories or git repositories.

**Non-intrusive.** Agloom generates files but does not interfere with how target tools work. The generated files are standard config files that each tool reads natively.

## When to Use Agloom

Agloom is a good fit when:

- Your project uses **two or more** AI coding assistants.
- Your team wants to **standardize** instructions and conventions across agents.
- You have **reusable skills or agents** that should be shared between projects.
- You want a **plugin system** to distribute team-wide configurations.

## When NOT to Use Agloom

Agloom may not be worth the overhead when:

- Your project uses **only one** AI coding assistant and you have no plans to add others.
- You have no need for plugins or shared configurations.

In that case, editing the tool's native config files directly is simpler.
