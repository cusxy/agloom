---
title: Plugins
description: How to use and create plugins for sharing configurations
prev: skills-and-agents
next: overlays
sidebar_position: 6
---

# Plugins

This guide teaches you how to use existing plugins and create your own.

## What Are Plugins

Plugins are reusable packages of skills, agents, docs, schemas, instructions, and overlays. They let you share AI agent configurations across projects.

A plugin is a directory containing a `plugin.yml` manifest and an `.agloom/`-like structure. Plugins can be loaded from local paths or git repositories.

## Using a Plugin

Add plugins to the `plugins` section of your `.agloom/config.yml`.

### From a Git Repository

Use a git URL (SSH or HTTPS):

```yaml
# .agloom/config.yml
adapters:
  - claude
plugins:
  - git@github.com:user/my-plugin
  - https://github.com/user/another-plugin
```

You can pin a specific ref (branch, tag, or commit) and point to a subdirectory within the repo:

```yaml
plugins:
  - git@github.com:user/my-plugin#v1.0.0
  - git@github.com:user/monorepo#main//packages/agloom-plugin
```

The `#ref` suffix specifies the git ref. The `//path` suffix specifies a subdirectory within the repository.

### From a Local Path

Use a relative path:

```yaml
plugins:
  - ../shared-plugin
```

### Object Form

For more control, use the object form:

```yaml
plugins:
  - git: git@github.com:user/my-plugin
    ref: v1.0.0
    path: subdir
    values:
      team_name: "platform"
      api_token: "${env:API_TOKEN}"
  - path: ../local-plugin
    values:
      feature_flag: "true"
```

The object form lets you specify `ref`, `path`, and `values` (see below).

## Plugin Values

Plugins can declare variables that consumers must (or may) provide. Values are passed through the `values` field in the plugin entry.

For example, if a plugin declares a `team_name` variable:

```yaml
# In the plugin's plugin.yml
variables:
  team_name:
    description: "Team name for commit messages"
    required: true
```

You provide the value in your config:

```yaml
# .agloom/config.yml
plugins:
  - git: git@github.com:user/team-plugin
    values:
      team_name: "platform"
```

Values can reference environment variables using `${env:VAR}`:

```yaml
plugins:
  - git: git@github.com:user/team-plugin
    values:
      team_name: "platform"
      api_token: "${env:TEAM_API_TOKEN}"
```

Sensitive variables (declared with `sensitive: true` in the plugin manifest) **must** use `${env:VAR}` -- inline values are rejected to prevent accidental commits of secrets.

See [Variables](variables.md) for more on how interpolation works.

## Creating a Plugin

Step 1: Create a directory with a `plugin.yml` manifest:

```yaml
# my-plugin/plugin.yml
name: my-plugin
version: 1.0.0
description: "Shared coding conventions for our team"
author:
  name: "Jane Doe"
  email: "jane@example.com"
```

Step 2: Add content using the same structure as `.agloom/`:

```
my-plugin/
├── plugin.yml
├── skills/
│   └── code-review/
│       └── SKILL.md
├── agents/
│   └── reviewer.md
└── overlays/
    └── claude/
        └── .claude/
            └── settings.json
```

Step 3: Optionally declare variables:

```yaml
# my-plugin/plugin.yml
name: my-plugin
version: 1.0.0
description: "Shared coding conventions"
author:
  name: "Jane Doe"
variables:
  team_name:
    description: "Team name"
    required: true
  slack_channel:
    description: "Slack channel for notifications"
    default: "#engineering"
```

See [reference/plugin-manifest](../reference/plugin-manifest.md) for the full manifest format.

## Plugin Caching

Git plugins are cached locally in `~/.agloom/cache/plugins/`. On subsequent transpile runs, Agloom uses the cached version instead of cloning again.

To force a fresh clone:

```bash
agloom transpile --refresh
```

To clear the entire cache:

```bash
agloom cache clean
```

## How Plugins Merge

Plugins go through the same transpilation pipeline as your local `.agloom/` content. Their instructions, skills, agents, docs, schemas, and overlays are merged into the final output.

The merge order follows the plugin declaration order in `config.yml`. Plugins listed first have lower priority -- later plugins and the local project can override earlier ones. The local project always has the highest priority.
