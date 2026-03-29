# Transpile

Transpile canonical Agloom configurations into agent-specific files.

## Usage

```
agloom transpile [--adapter <adapterId> | --all] [--clean] [--verbose]
```

## Options

- `--adapter <adapterId>` — transpile for a specific adapter from the registry.
- `--all` — transpile for all supported adapters.
- `--clean` — remove generated files before transpiling.
- `--verbose` — show all steps including those with 0 files.

## Examples

Transpile for a specific adapter:

```
agloom transpile --adapter claude
```

Transpile for all adapters:

```
agloom transpile --all
```

Clean and transpile:

```
agloom transpile --adapter claude --clean
```
