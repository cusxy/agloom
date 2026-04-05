---
title: Plugin Manifest
description: Complete reference for plugin.yml format, fields, and validation rules
order: 3
---

# Plugin Manifest

The plugin manifest (`plugin.yml`) defines metadata for an Agloom plugin. It must be located at the root of the plugin directory.

## File Location

```
<plugin-root>/plugin.yml
```

## Plugin Directory Structure

```
<plugin-root>/
  plugin.yml          # Manifest (required)
  AGLOOM.md           # Plugin instructions (optional)
  AGLOOM.local.md     # Local plugin instructions (optional)
  overlays/           # Per-adapter overlay files (optional)
    claude/
    opencode/
  skills/             # Plugin skills (optional)
  agents/             # Plugin agents (optional)
  docs/               # Plugin docs (optional)
  schemas/            # Plugin schemas (optional)
```

The plugin directory mirrors the structure of `.agloom/` in a local project. A `config.yml` file must **not** be present in a plugin directory.

## Schema

### Required Fields

#### name

- **Type:** `string`
- **Constraints:** Lowercase letters (`a-z`), digits (`0-9`), and hyphens (`-`). Must start with a letter, end with a letter or digit. No consecutive hyphens (`--`). Length: 1--214 characters.
- **Regex:** `^[a-z]([a-z0-9]|(-(?!-)))*[a-z0-9]$|^[a-z]$`

```yaml
name: my-eslint-config
```

Valid examples: `my-plugin`, `eslint-config`, `a`, `plugin1`.

Invalid examples: `My-Plugin` (uppercase), `-plugin` (starts with hyphen), `plugin-` (ends with hyphen), `my--plugin` (consecutive hyphens), `my_plugin` (underscore).

#### version

- **Type:** `string`
- **Constraints:** Must be a valid Semantic Versioning 2.0.0 string (validated via `semver.valid()`).

```yaml
version: 1.0.0
```

Valid examples: `1.0.0`, `0.1.0`, `1.2.3-beta.1`, `1.0.0+build.123`.

Invalid examples: `1.0` (incomplete), `v1.0.0` (`v` prefix), `1.0.0.0` (extra component).

#### description

- **Type:** `string`
- **Constraints:** Must be a non-empty string.

```yaml
description: "Shared ESLint configuration for agloom projects"
```

#### author

- **Type:** `object`

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | Non-empty string. |
| `email` | string | Yes | Non-empty string. |
| `url` | string | No | Must be a valid URL (parseable by the `URL` constructor). |

```yaml
author:
  name: "John Doe"
  email: "john@example.com"
  url: "https://example.com"
```

### Optional Fields

#### license

- **Type:** `string`
- **Constraints:** Non-empty string. Should be an SPDX identifier (e.g., `MIT`, `Apache-2.0`).

```yaml
license: MIT
```

#### homepage

- **Type:** `string`
- **Constraints:** Must be a valid URL.

```yaml
homepage: "https://github.com/example/my-eslint-config"
```

#### keywords

- **Type:** `array<string>`
- **Default:** `[]`
- **Constraints:** Each element must be a non-empty string.

```yaml
keywords:
  - eslint
  - config
```

#### variables

- **Type:** `object`
- **Default:** `null` (plugin does not accept variables)

Declares variables that consumers can set via `values` in their `config.yml`. Each key is a variable name; each value is a `VariableDeclaration` object.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | **required** | Description of the variable. |
| `required` | boolean | `false` | If `true`, the variable must be provided or have a default. |
| `default` | string | - | Default value. May contain `${env:VAR}`. |
| `sensitive` | boolean | `false` | If `true`, value must reference `${env:VAR}` (no inline secrets). |

```yaml
variables:
  team_name:
    description: "Team name for commit messages"
    required: true
  api_token:
    description: "API token for external service"
    required: true
    sensitive: true
  lint_command:
    description: "Custom lint command"
    default: "pnpm run lint"
  base_url:
    description: "Base URL for API calls"
    default: "${env:BASE_URL}"
```

## Validation Rules

| Condition | Error Message |
|-----------|---------------|
| `plugin.yml` not found | `Plugin manifest not found: <pluginDir>/plugin.yml` |
| Invalid YAML | `Invalid plugin manifest: <parse error>` |
| `name` missing | `Invalid plugin manifest: 'name' is required.` |
| `name` invalid format | `Invalid plugin manifest: 'name' must contain only lowercase letters, digits, and hyphens...` |
| `version` missing | `Invalid plugin manifest: 'version' is required.` |
| `version` invalid semver | `Invalid plugin manifest: 'version' must be a valid semver string.` |
| `description` missing | `Invalid plugin manifest: 'description' is required.` |
| `description` not a non-empty string | `Invalid plugin manifest: 'description' must be a non-empty string.` |
| `author` missing | `Invalid plugin manifest: 'author' is required.` |
| `author` not an object | `Invalid plugin manifest: 'author' must be an object.` |
| `author.name` missing or empty | `Invalid plugin manifest: 'author.name' must be a non-empty string.` |
| `author.email` missing or empty | `Invalid plugin manifest: 'author.email' must be a non-empty string.` |
| `author.url` invalid URL | `Invalid plugin manifest: 'author.url' must be a valid URL.` |
| `license` not a non-empty string | `Invalid plugin manifest: 'license' must be a non-empty string.` |
| `homepage` invalid URL | `Invalid plugin manifest: 'homepage' must be a valid URL.` |
| `keywords` not an array | `Invalid plugin manifest: 'keywords' must be an array of strings.` |
| Keyword not a non-empty string | `Invalid plugin manifest: each keyword must be a non-empty string.` |
| `variables` not an object | `Invalid plugin manifest: 'variables' must be an object.` |
| Variable not an object | `Invalid plugin manifest: variable '<key>' must be an object.` |
| Variable `description` missing/empty | `Invalid plugin manifest: variable '<key>' must have a non-empty 'description'.` |

## Complete Example

```yaml
name: my-eslint-config
version: 1.0.0
description: "Shared ESLint configuration for agloom projects"
license: MIT
author:
  name: "John Doe"
  email: "john@example.com"
  url: "https://example.com"
homepage: "https://github.com/example/my-eslint-config"
keywords:
  - eslint
  - config
variables:
  team_name:
    description: "Team name"
    required: true
  api_token:
    description: "API token"
    required: true
    sensitive: true
  lint_command:
    description: "Custom lint command"
    default: "pnpm run lint"
```
