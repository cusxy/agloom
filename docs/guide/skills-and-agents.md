---
title: Skills and Agents
description: How to create reusable skills and sub-agent definitions
order: 5
---

# Skills and Agents

This guide teaches you how to create skills (reusable actions) and agents
(sub-agent definitions) in Agloom.

## What Are Skills

Skills are reusable action definitions stored in `.agloom/skills/`. Each skill
is a directory containing a `SKILL.md` file and any number of supporting files
(helpers, templates, data).

During transpilation, skill directories are copied to each adapter's skill
directory (e.g., `.claude/skills/`, `.opencode/skills/`).

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

1. Correctness -- does the code do what it claims?
2. Style -- does it follow project conventions?
3. Tests -- are new features covered by tests?
4. Security -- are there any obvious vulnerabilities?

Provide feedback as a numbered list of findings.
```

The frontmatter fields (`name`, `description`, etc.) are passed through to each
adapter without modification. Agloom does not validate or transform skill
content -- it copies files as-is (with interpolation for `.md` files; see
[Variables](variables.md)).

Step 3: Optionally add supporting files:

```
.agloom/skills/code-review/
├── SKILL.md
├── checklist.md
└── examples/
    └── good-review.md
```

All files in the skill directory are copied to the output.

Step 4: Run `agloom transpile`. The skill appears in each adapter's directory:

```
.claude/skills/code-review/SKILL.md
.claude/skills/code-review/checklist.md
.claude/skills/code-review/examples/good-review.md
.opencode/skills/code-review/SKILL.md
...
```

## What Are Agents

Agents are sub-agent definitions stored in `.agloom/agents/`. Each agent is a
single `.md` file with YAML frontmatter describing the agent's role, model, and
available tools.

During transpilation, agent files are transformed (frontmatter overrides are
applied, agent-specific blocks are filtered) and written to each adapter's
agents directory.

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

The `override` block lets you customize frontmatter fields per adapter. In this
example, when transpiling for OpenCode, the `model` field is replaced with
`anthropic/claude-sonnet-4-5` and `temperature: 0.1` is added. The `override`
key itself is removed from the output.

Step 2: Run `agloom transpile`. The agent file appears in each adapter's
directory:

```
.claude/agents/reviewer.md
.opencode/agents/reviewer.md
```

Each output file has adapter-specific frontmatter applied.

## Adapter Support

Not all adapters support skills and agents:

| Adapter    | Skills | Agents |
| ---------- | ------ | ------ |
| `claude`   | Yes    | Yes    |
| `opencode` | Yes    | Yes    |
| `kilocode` | Yes    | Yes    |
| `codex`    | Yes    | Yes    |
| `gemini`   | Yes    | Yes    |
| `agentsmd` | No     | No     |

The `agentsmd` adapter only handles instruction files (`AGENTS.md`). It does
not have its own skills or agents directories.

## Example

Here is a realistic skill and agent working together.

**Skill** -- `.agloom/skills/spec-review/SKILL.md`:

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

**Agent** -- `.agloom/agents/spec-reviewer.md`:

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
