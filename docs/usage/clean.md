# Clean

Remove generated agent-specific files.

## Usage

```
agloom clean [--adapter <adapterId> | --all] [--verbose]
```

## Options

- `--adapter <adapterId>` — clean files for a specific adapter.
- `--all` — clean files for all supported adapters.
- `--verbose` — show details even when 0 files removed.

## Examples

Clean files for a specific adapter:

```
agloom clean --adapter claude
```

Clean files for all adapters:

```
agloom clean --all
```
