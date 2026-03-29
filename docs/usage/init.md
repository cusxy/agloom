# Init

Import existing agent configurations into `.agloom/` directory.

## Usage

```
agloom init [--adapter <adapterId> | --all] [--force] [--verbose]
```

## Options

- `--adapter <adapterId>` — initialize for a specific adapter.
- `--all` — initialize for all supported adapters.
- `--force` — overwrite existing files in `.agloom/`.
- `--verbose` — show all steps including those with 0 files.

## Examples

Initialize for a specific adapter:

```
agloom init --adapter claude
```

Initialize for all adapters:

```
agloom init --all
```

Reinitialize with force:

```
agloom init --adapter claude --force
```
