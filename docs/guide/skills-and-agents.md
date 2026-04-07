---
title: Skills and Agents
description: How to create reusable skills and sub-agent definitions
prev: instructions
next: plugins
sidebar_position: 5
---

# Skills and Agents

This guide teaches you how to create skills (reusable actions) and agents (sub-agent definitions) in Agloom.

## What Are Skills

Skills are reusable action definitions stored in `.agloom/skills/`. Each skill is a directory containing a `SKILL.md` file and any number of supporting files (helpers, templates, data).

During transpilation, skill directories are copied to each adapter's skill directory (e.g., `.claude/skills/`, `.opencode/skills/`).

## Creating a Skill

Step 1: Create a skill directory:

```bash
mkdir -p .agloom/skills/code-review
```

Step 2: Create the `SKILL.md` file with YAML frontmatter and a Markdown body:

```markdown
---
name: code-review
description: Reviews code changes for quality and conventions
---

# Code Review

Review the provided code changes for:

1. Correctness — does the code do what it claims?
2. Style — does it follow project conventions?
3. Tests — are new features covered by tests?
4. Security — are there any obvious vulnerabilities?

Provide feedback as a numbered list of findings.
```

Markdown files inside a skill package (`SKILL.md` and any supporting
`.md` files) support variable interpolation, agent-specific blocks, and a
frontmatter `override` block for per-adapter customization.

Step 3: Optionally add supporting files:

```text
.agloom/skills/code-review/
├── SKILL.md
├── checklist.md
└── examples/
    └── good-review.md
```

All files in the skill directory are copied to the output.

Step 4: Run `agloom transpile`. The skill appears in each adapter's directory:

```text
.claude/skills/code-review/SKILL.md
.claude/skills/code-review/checklist.md
.claude/skills/code-review/examples/good-review.md
.opencode/skills/code-review/SKILL.md
...
```

## What Are Agents

Agents are sub-agent definitions stored in `.agloom/agents/`. Each agent is a single `.md` file with YAML frontmatter describing the agent's role, model, and available tools.

During transpilation, agent files are transformed (frontmatter overrides are applied, agent-specific blocks are filtered) and written to each adapter's agents directory.

## Creating an Agent

Step 1: Create an agent file at `.agloom/agents/reviewer.md`:

```markdown
---
name: code-reviewer
description: Reviews code for best practices
model: sonnet
tools:
  - Read
  - Grep
  - Glob
override:
  opencode:
    model: anthropic/claude-sonnet-4-5
    temperature: 0.1
---

You are a code reviewer. Analyze the provided code and report issues related
to correctness, performance, and maintainability.

Focus on actionable feedback. Do not nitpick style issues that a linter
would catch.
```

The `override` block lets you customize frontmatter fields per adapter. In this example, when transpiling for OpenCode, the `model` field is replaced with `anthropic/claude-sonnet-4-5` and `temperature: 0.1` is added. The `override` key itself is removed from the output.

Step 2: Run `agloom transpile`. The agent file appears in each adapter's directory:

```text
.claude/agents/reviewer.md
.opencode/agents/reviewer.md
```

Each output file has adapter-specific frontmatter applied.

## What Are Commands

Commands are slash-command definitions stored in `.agloom/commands/`. Each command is a single `.md` file with YAML frontmatter and a Markdown body. Unlike skills (which are directories), a command is a single file.

Commands may be organized into subdirectories. For example, you can group git-related commands under `commands/git/`.

## Creating a Command

Step 1: Create a command file at `.agloom/commands/deploy.md`:

```markdown
---
description: Deploy to production
---

Deploy the current branch to production environment.
Verify all tests pass before deploying.
```

The frontmatter fields are passed through to each adapter. Agloom does not validate or interpret command-specific fields like `description` — the target agent defines what fields are meaningful.

Step 2: Run `agloom transpile`. The command appears in each adapter's commands directory:

```text
.claude/commands/deploy.md
.gemini/commands/deploy.toml
.kilo/commands/deploy.md
.opencode/commands/deploy.md
```

Note that Gemini receives a `.toml` file (converted automatically) and Codex receives a skill package in `.agents/skills/deploy/SKILL.md` (since Codex does not support commands natively).

### Commands in Subdirectories

You can organize commands into subdirectories:

```text
.agloom/commands/
├── deploy.md
└── git/
    ├── commit.md
    └── push.md
```

Some adapters **preserve** the subdirectory structure (Claude, Gemini), while others **flatten** it (OpenCode, KiloCode, Codex):

- Preserve: `.agloom/commands/git/commit.md` becomes `.claude/commands/git/commit.md`
- Flatten: `.agloom/commands/git/commit.md` becomes `.opencode/commands/commit.md`

When flattening, if two commands from different subdirectories have the same filename, transpilation fails with a name conflict error.

### Frontmatter Override

Like agents, commands support per-adapter frontmatter overrides:

```markdown
---
description: Deploy to production
override:
  gemini:
    description: Deploy the app to production
  claude:
    argument-hint: "[environment]"
---

Deploy the current branch.
```

The `override` block merges adapter-specific fields into the frontmatter for each target. The `override` key itself is removed from the output. See [reference/transpilers](../reference/transpilers.md) for details on the commands transpiler.

### Agent-Specific Sections

The body may contain agent-specific sections, just like agent definitions:

```markdown
---
description: Deploy to production
---

Deploy the current branch to production.

<!-- agent:claude -->

Use the Bash tool to run deployment scripts.

<!-- /agent:claude -->

<!-- agent:gemini -->

Use !{deploy.sh} to deploy.

<!-- /agent:gemini -->
```

Content outside sections appears in all outputs. Matching sections are unwrapped; non-matching sections are removed.

## Adapter Support

Not all adapters support skills, agents, and commands:

| Adapter    | Skills | Agents | Commands        |
| ---------- | ------ | ------ | --------------- |
| `claude`   | Yes    | Yes    | Yes             |
| `codex`    | Yes    | Yes    | Yes (as skills) |
| `gemini`   | Yes    | Yes    | Yes (TOML)      |
| `opencode` | Yes    | Yes    | Yes             |
| `kilocode` | Yes    | Yes    | Yes             |
| `agentsmd` | No     | No     | No              |

The `agentsmd` adapter only handles instruction files (`AGENTS.md`). It does not have its own skills, agents, or commands directories. The `codex` adapter converts commands into skill packages (`.agents/skills/<name>/SKILL.md`) since Codex does not support commands natively. The `gemini` adapter converts commands from Markdown to TOML format.

## Example

Here is a realistic skill and agent working together.

**Skill** — `.agloom/skills/spec-review/SKILL.md`:

```markdown
---
name: spec-review
description: Review a specification document for completeness
---

# Spec Review

Given a specification document, check for:

1. All operations have defined inputs and outputs.
2. Error cases are documented with specific error messages.
3. No ambiguous language (look for "TBD", "TODO", "FIXME").
4. Cross-references to other specs are valid.

Output a checklist with pass/fail for each criterion.
```

**Agent** — `.agloom/agents/spec-reviewer.md`:

```markdown
---
name: spec-reviewer
description: Reviews specification documents
model: sonnet
tools:
  - Read
  - Glob
  - Grep
---

You are a specification reviewer. Use the spec-review skill to analyze
documents in the `docs/specs/` directory.

Read each spec file, apply the review checklist, and produce a summary report.
```
