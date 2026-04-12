---
title: CLI Commands
description: Complete reference for all Agloom CLI commands, options, and exit codes
next: config
sidebar_position: 1
---

# CLI Commands

Agloom provides a command-line interface built on React + Ink for transpiling canonical configurations into agent-specific files.

## Global Options

### --help

```text
agloom --help
```

Displays the general help message with a list of available commands and global options. Calling `agloom` without any command also displays this help.

Exit code: `0`.

### --version

```text
agloom --version
```

Displays the version of the installed Agloom package (read from `package.json`).

Also available as `agloom version`.

Exit code: `0`.

### Unknown Command

If an unknown command is provided, Agloom displays:

```text
Unknown command: <cmd>. Run 'agloom --help' to see available commands.
```

Exit code: `1`.

The `--help` flag does **not** suppress this error. Unknown command detection takes priority over global `--help`.

## Global Flags

Three flags are available on **every** command. They override where Agloom reads resources, writes output, and loads configuration.

| Flag                   | Type   | Default                   | Description                                         |
| ---------------------- | ------ | ------------------------- | --------------------------------------------------- |
| `--project-dir <path>` | string | Current working directory | Root directory for writing generated files.         |
| `--agloom-dir <path>`  | string | `<project-dir>/.agloom`   | Directory containing canonical Agloom resources.    |
| `--config <path\|->`   | string | `<agloom-dir>/config.yml` | Path to the config file, or `-` to read from stdin. |

Overriding a higher flag cascades into the defaults of lower flags. For example, `--project-dir /x` sets the default `--agloom-dir` to `/x/.agloom` and default `--config` to `/x/.agloom/config.yml`. Explicitly set flags are not affected by the cascade.

When a flag is set explicitly, the path **must** exist (error otherwise). Default paths may be absent without error.

### Examples

```sh
# Transpile with resources and output in a different project
agloom transpile --project-dir /other/project

# Use external resources, write output locally
agloom transpile --agloom-dir /shared/.agloom

# Try a one-off config without modifying files
agloom transpile --config /tmp/try.yml
```

## Commands

### transpile

Runs the transpilation pipeline for all registered transpiler modules.

```text
agloom transpile [--adapter <adapterId> | --all] [--clean] [--verbose] [--refresh]
```

#### Options

| Option                  | Type    | Default | Description                                                                      |
| ----------------------- | ------- | ------- | -------------------------------------------------------------------------------- |
| `--adapter <adapterId>` | string  | -       | Adapter ID from the registry. Mutually exclusive with `--all`.                   |
| `--all`                 | boolean | `false` | Transpile for all adapters in the registry. Mutually exclusive with `--adapter`. |
| `--clean`               | boolean | `false` | Run clean before transpiling (see [clean](#clean)).                              |
| `--verbose`             | boolean | `false` | Show all steps including those with 0 files.                                     |
| `--refresh`             | boolean | `false` | Force re-fetch of cached git plugins.                                            |

When neither `--adapter` nor `--all` is specified, adapters are read from `.agloom/config.yml`.

#### Adapter Resolution

- `--adapter <id>`: resolves the specified adapter and its dependencies (topological order).
- `--all`: uses all adapters from the registry in definition order.
- Neither: loads adapters from `config.yml`, resolves dependencies, deduplicates.

Dependencies are resolved automatically. For example, `--adapter opencode` also transpiles the `agentsmd` adapter first (since `opencode.dependsOn = ["agentsmd"]`).

#### Pipeline

For each resolved adapter entry, the command executes transpiler steps in order:

1. Instructions
2. Skills
3. Agents
4. Docs
5. Schemas
6. Overlay step (MCP + Permissions)

#### Verbose Filtering

Without `--verbose`, steps with 0 written files and no errors are hidden. If all steps for all adapters are hidden and there are no errors, the output is:

```text
Nothing to transpile.
```

#### --clean Behavior

When `--clean` is provided, the clean procedure runs before transpilation for each adapter entry. With `--adapter`, the clean result is displayed before transpilation output. With `--all` or config mode, clean results are not displayed.

#### Examples

```sh
# Transpile using config
agloom transpile

# Transpile for a specific adapter
agloom transpile --adapter claude

# Transpile for all adapters with verbose output
agloom transpile --all --verbose

# Clean then transpile
agloom transpile --clean
```

#### Exit Codes

| Code | Condition                                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`  | All steps completed without errors.                                                                                                                |
| `1`  | Any step had errors, both `--adapter` and `--all` specified, config not found (without `--adapter`/`--all`), config error, unknown/hidden adapter. |

---

### clean

Removes generated agent-specific files.

```text
agloom clean [--adapter <adapterId> | --all] [--verbose]
```

#### Options

| Option                  | Type    | Default | Description                                                    |
| ----------------------- | ------- | ------- | -------------------------------------------------------------- |
| `--adapter <adapterId>` | string  | -       | Adapter ID from the registry. Mutually exclusive with `--all`. |
| `--all`                 | boolean | `false` | Clean for all adapters. Mutually exclusive with `--adapter`.   |
| `--verbose`             | boolean | `false` | Show details even when 0 files removed.                        |

#### Behavior

For each resolved adapter, the clean procedure:

1. Recursively removes directories listed in `entry.paths` (skills, agents, docs, schemas).
2. Deletes files listed in `entry.targetFiles`.

Missing files and directories are silently skipped.

#### Output

Without `--verbose`, adapters with 0 removed files and no errors are hidden. If all adapters have 0 removed files:

```text
Nothing to clean.
```

#### Examples

```sh
agloom clean --adapter claude
agloom clean --all
agloom clean --verbose
```

#### Exit Codes

| Code | Condition                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| `0`  | All clean operations completed without errors.                                                                     |
| `1`  | Both `--adapter` and `--all` specified, config not found, config error, unknown/hidden adapter, or deletion error. |

---

### init

Imports existing agent-specific files into `.agloom/overlays/` and creates the configuration file.

```text
agloom init [--adapter <adapterId> | --all] [--force] [--verbose]
```

#### Options

| Option                  | Type    | Default | Description                                                             |
| ----------------------- | ------- | ------- | ----------------------------------------------------------------------- |
| `--adapter <adapterId>` | string  | -       | Adapter identifier. Mutually exclusive with `--all`.                    |
| `--all`                 | boolean | `false` | Initialize all supported adapters. Mutually exclusive with `--adapter`. |
| `--force`               | boolean | `false` | Overwrite existing files.                                               |
| `--verbose`             | boolean | `false` | Show all steps including 0-file ones.                                   |

#### Behavior

1. Resolves adapters (same rules as `transpile`).
2. Checks if the resources directory is already initialized. Initialization is detected by the presence of `config.yml` or a non-empty `overlays/` directory inside the resources root — not merely by the existence of the `.agloom/` directory itself. Error without `--force`.
3. Creates `config.yml` inside the resources root when `--adapter` or `--all` is specified.
4. For each adapter, copies files from `entry.overlayImportPaths` into `overlays/<adapterId>/` inside the resources root.

The generated `config.yml` includes onboarding comments:

```yaml
# Agloom configuration
# List of adapters to use by default when no --adapter or --all flag is provided.
# Run 'agloom adapters --all' to see all available adapters.
adapters:
  - claude
```

#### Examples

```sh
agloom init --adapter claude
agloom init --all
agloom init --adapter opencode --force
```

#### Exit Codes

| Code | Condition                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | All steps completed without errors (including 0 files).                                                                                                                                                |
| `1`  | Both `--adapter` and `--all` specified, config not found (without flags), project already initialized without `--force`, overlay directory exists without `--force`, copy or directory creation error. |

---

### adapters

Lists available or active adapters.

```text
agloom adapters [--all]
```

#### Options

| Option  | Type    | Default | Description                                                                  |
| ------- | ------- | ------- | ---------------------------------------------------------------------------- |
| `--all` | boolean | `false` | Show all available (non-hidden) adapters instead of active ones from config. |

#### Behavior

- Without `--all`: loads config and shows active adapters. If no config exists, falls back to showing all non-hidden adapters.
- With `--all`: shows all non-hidden adapters from the registry.

Hidden adapters (e.g., `agentsmd`) are never displayed.

#### Output

```text
Active adapters:

  claude       Claude Code
  opencode     OpenCode
```

Exit code: `0`.

---

### format

Formats and lints project files (Markdown, JSON, YAML, TOML).

```text
agloom format [--check] [--all] [<file|glob>...]
```

#### Options

| Option            | Type     | Default | Description                                                                                                                |
| ----------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `--check`         | boolean  | `false` | Check files without modifying. Exit code 1 if unformatted.                                                                 |
| `--all`           | boolean  | `false` | Format all supported files in the project (`**/*.{md,mdx,json,yaml,yml,toml}`). Mutually exclusive with `<file\|glob>...`. |
| `<file\|glob>...` | string[] | -       | Custom glob patterns or file paths. Mutually exclusive with `--all`.                                                       |

#### Default Target Files

When neither `--all` nor file arguments are provided:

- `.agloom/**/*.{md,mdx,json,yaml,yml,toml}`
- `**/AGLOOM.md`

#### Supported Formats

| Extension       | prettier | markdownlint |
| --------------- | -------- | ------------ |
| `.md`, `.mdx`   | Yes      | Yes          |
| `.json`         | Yes      | No           |
| `.yaml`, `.yml` | Yes      | No           |
| `.toml`         | Yes      | No           |

Unsupported extensions are silently skipped.

#### Configuration Priority

1. Built-in defaults (bundled in `@agloom/markdown-tools`).
2. Native config files (`.prettierrc.*`, `.markdownlint.*` in project root).
3. `prettier` and `markdownlint` sections in `.agloom/config.yml` (shallow merge on top).

#### Excluded Directories

Glob expansion always excludes: `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.turbo`, `.cache`, and paths matching `.gitignore`.

#### Examples

```sh
# Format default files
agloom format

# Check without modifying
agloom format --check

# Format all supported files
agloom format --all

# Format specific files
agloom format "src/**/*.md" ".agloom/**/*.yaml"
```

#### Exit Codes

| Code | Condition                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| `0`  | Format completed without errors, or all files pass check.                                                   |
| `1`  | Format errors, files need formatting (check mode), config parse error, or `--all` used with file arguments. |

---

### help

Shows help topics or displays a specific help topic rendered from Markdown.

```text
agloom help [<topic>]
```

#### Arguments

| Argument  | Type   | Description                                                                                                    |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `<topic>` | string | Topic name. Full format: `guide/getting-started`, `reference/cli`. Short format (slug only): `cli`, `plugins`. |

#### Behavior

Without `<topic>`: displays a categorized list of all available help topics (Guide and Reference).

With `<topic>`: resolves the topic name, reads the corresponding Markdown file from `docs/guide/` or `docs/reference/`, strips frontmatter, and renders to the terminal using `marked` + `marked-terminal`.

Short topic names (without category prefix) are searched across all categories. If the slug is ambiguous (exists in multiple categories), an error lists matching topics.

#### Exit Codes

| Code | Condition                                                          |
| ---- | ------------------------------------------------------------------ |
| `0`  | Topic list displayed or topic rendered successfully.               |
| `1`  | Topic not found, ambiguous topic, read error, no topics available. |

---

### cache clean

Clears the plugin cache directory.

```text
agloom cache clean
```

Git plugins are cached in `~/.agloom/cache/plugins/`. This command removes all cached plugins, forcing re-fetch on the next `transpile`.

Exit code: `0`.
