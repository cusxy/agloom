---
title: Configuration File
description: Complete reference for .agloom/config.yml format, fields, and validation
order: 2
---

# Configuration File

The file `.agloom/config.yml` is the project-level configuration for Agloom. It defines which adapters to use by default and optionally configures plugins, variables, and formatting tools.

## File Location

```
<projectRoot>/.agloom/config.yml
```

The file is loaded by the commands `transpile`, `clean`, `init`, and `adapters` when neither `--adapter` nor `--all` is specified.

## Schema

### adapters

- **Type:** `array<string>`
- **Required:** Yes
- **Constraints:** Must not be empty. Each element must be a known, non-hidden adapter ID from the registry.

List of adapter identifiers to use by default.

```yaml
adapters:
  - claude
  - opencode
```

Hidden adapters (e.g., `agentsmd`) cannot be specified in `adapters`. They are included automatically when a dependent adapter (e.g., `opencode`) is resolved.

### plugins

- **Type:** `array<string | object>`
- **Required:** No

List of plugins to load. Each entry can be:

**String form (git shorthand):**

```yaml
plugins:
  - git@github.com:user/plugin
  - https://github.com/user/plugin
```

**Object form (local plugin):**

```yaml
plugins:
  - path: ../my-local-plugin
```

**Object form (git plugin with options):**

```yaml
plugins:
  - git: git@github.com:user/plugin
    ref: v1.0.0
    path: packages/my-plugin
    values:
      team_name: platform
      api_token: "${env:API_TOKEN}"
```

| Field | Type | Description |
|-------|------|-------------|
| `git` | string | Git URL (SSH or HTTPS). |
| `path` | string | Local path (for local plugins) or subpath within git repo (for git plugins). |
| `ref` | string | Git ref (tag, branch, commit SHA). Optional for git plugins. |
| `values` | object | Key-value pairs passed to the plugin. All values must be strings. |

### variables

- **Type:** `object`
- **Required:** No

Declares project-level variables accessible via `${values:NAME}` interpolation.

**Shorthand form** (string value treated as default):

```yaml
variables:
  project_name: "${env:PROJECT_NAME}"
```

**Full form:**

```yaml
variables:
  team:
    description: "Team name"
    default: "platform"
  api_key:
    description: "API key"
    default: "${env:API_KEY}"
    sensitive: true
    required: true
```

Each variable declaration supports:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | `""` | Description of the variable. Optional in config (required in plugin manifests). |
| `required` | boolean | `false` | If `true`, variable must have a resolved value. |
| `default` | string | - | Default value. May contain `${env:VAR}` for environment variable substitution. |
| `sensitive` | boolean | `false` | If `true`, the value must reference an environment variable (cannot be set inline). |

### prettier

- **Type:** `object`
- **Required:** No

Prettier configuration overrides. Values are passed to prettier as-is and shallow-merged on top of native config files and built-in defaults.

```yaml
prettier:
  proseWrap: always
  tabWidth: 4
```

### markdownlint

- **Type:** `object`
- **Required:** No

Markdownlint configuration overrides. Values are passed to markdownlint as-is.

```yaml
markdownlint:
  MD013:
    line_length: 80
```

## Validation Rules

The following conditions produce errors during config loading:

| Condition | Error Message |
|-----------|---------------|
| `adapters` field missing | `Invalid config: 'adapters' field is required.` |
| `adapters` is not an array of strings | `Invalid config: 'adapters' must be an array of strings.` |
| `adapters` is empty | `Invalid config: 'adapters' must not be empty.` |
| Unknown adapter ID | `Invalid config: unknown adapter '<id>'.` |
| Hidden adapter specified | `Invalid config: adapter '<id>' cannot be specified in config.` |
| `variables` is not an object | `Invalid config: 'variables' must be an object.` |
| Variable value is neither string nor object | `Invalid config: variable '<key>' must be a string or an object.` |
| Plugin `values` is not an object | `Invalid config: plugin 'values' must be an object.` |
| Plugin `values` entry is not a string | `Invalid config: plugin 'values' entry '<key>' must be a string.` |

## Complete Example

```yaml
# Agloom configuration
adapters:
  - claude
  - opencode

plugins:
  - git@github.com:cusxy/skill-cycling
  - git: git@github.com:cusxy/shared-agents
    ref: v2.0.0
    values:
      team_name: "platform"
      api_token: "${env:CYCLING_API_TOKEN}"
  - path: ../local-plugin

variables:
  project_name: "${env:PROJECT_NAME}"
  team:
    description: "Team name"
    default: "platform"
  api_key:
    description: "API key"
    default: "${env:API_KEY}"
    sensitive: true

prettier:
  proseWrap: always

markdownlint:
  MD013:
    line_length: 80
```
