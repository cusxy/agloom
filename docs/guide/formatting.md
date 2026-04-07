---
title: Formatting
description: How to format and lint Markdown, JSON, YAML, and TOML files with agloom format
prev: variables
sidebar_position: 9
---

# Formatting

This guide teaches you how to format and lint your project's Markdown, JSON, YAML, and TOML files using the built-in `agloom format` command.

## What `agloom format` Does

`agloom format` is a wrapper around [prettier](https://prettier.io/) and [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) that ships with Agloom. It exists so you do not have to install and wire up those tools yourself just to keep your canonical files tidy.

The command has two modes:

- **Write mode** (default) — formats files in place and applies autofixable lint rules.
- **Check mode** (`--check`) — reports unformatted files and lint violations without modifying anything. Exits with code 1 if any file needs attention. Useful for CI.

## Supported File Types

| Extension       | prettier | markdownlint |
| --------------- | -------- | ------------ |
| `.md`, `.mdx`   | yes      | yes          |
| `.json`         | yes      | no           |
| `.yaml`, `.yml` | yes      | no           |
| `.toml`         | yes      | no           |

Files with any other extension are silently skipped, even if they match the glob.

## Default File Set

When you run `agloom format` with no arguments, it processes:

- `.agloom/**/*.{md,mdx,json,yaml,yml,toml}` — everything inside the canonical directory.
- `**/AGLOOM.md` — canonical instruction files anywhere in the project.

The following directories are always excluded: `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.turbo`, `.cache`. Files and directories listed in `.gitignore` are also excluded.

## Formatting Extra Directories

Positional arguments **replace** the default file set — they do not extend it. To format your `docs/` directory along with the defaults, pass both explicitly:

```bash
agloom format ".agloom/**/*.{md,mdx,json,yaml,yml,toml}" "**/AGLOOM.md" "docs/**/*.{md,mdx,json,yaml,yml,toml}"
```

A common pattern is to wrap this in an npm script:

```json title="package.json"
{
  "scripts": {
    "fmt:md": "agloom format \".agloom/**/*.{md,mdx,json,yaml,yml,toml}\" \"**/AGLOOM.md\" \"docs/**/*.{md,mdx,json,yaml,yml,toml}\"",
    "fmt:md:check": "agloom format --check \".agloom/**/*.{md,mdx,json,yaml,yml,toml}\" \"**/AGLOOM.md\" \"docs/**/*.{md,mdx,json,yaml,yml,toml}\""
  }
}
```

If you want to format **every** supported file under the project root, use `--all`:

```bash
agloom format --all
```

`--all` cannot be combined with positional arguments.

## Configuration

`agloom format` resolves prettier and markdownlint configuration from three layers, in order of increasing priority:

1. **Built-in defaults** — bundled with Agloom, see below.
2. **Native config files** — `.prettierrc.*` and `.markdownlint.*` in the project root. Prettier and markdownlint discover these themselves.
3. **Sections in `.agloom/config.yml`** — `prettier` and `markdownlint` top-level fields. Values are passed to the tools as-is (shallow merge over layers 1 and 2).

### Built-in Defaults

Prettier defaults:

```yaml
proseWrap: preserve
tabWidth: 2
```

Markdownlint defaults:

```yaml
MD007:
  indent: 2
MD013: false
MD024:
  siblings_only: true
MD025: false
MD049:
  style: "underscore"
MD050:
  style: "asterisk"
```

### Overriding via `.agloom/config.yml`

Add `prettier` and `markdownlint` top-level sections to `.agloom/config.yml`:

```yaml title=".agloom/config.yml"
prettier:
  proseWrap: always
  tabWidth: 4
markdownlint:
  MD013:
    line_length: 80
```

Agloom does not validate the contents of these sections — prettier and markdownlint own their own schemas and will report errors directly if a value is invalid.
