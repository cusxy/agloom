# Configuration

Agloom uses a configuration file `.agloom/config.yml` to define which adapters are active for your project.

## Config File Location

The configuration file is located at `.agloom/config.yml` relative to your project root.

## Format

```yaml
adapters:
  - claude
  - opencode
```

## Fields

- `adapters` — list of adapter identifiers to use during transpilation. Each identifier must correspond to a registered adapter (see `agloom adapters --all`).

## Example

```yaml
adapters:
  - claude
```

This configuration tells Agloom to transpile canonical configs only for the Claude Code adapter.
