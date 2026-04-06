# AI CLI Tools: Permission Systems ComparisonП

Research comparing permission/policy engines across seven AI-powered CLI tools: Claude Code, Codex CLI, Gemini CLI,
OpenCode, Kilo Code, Cursor CLI, and GitHub Copilot CLI.

## Reference example

The following Claude Code permission config is used as a baseline for comparison:

```json
{
  "permissions": {
    "allow": ["Bash(npm run *)", "Bash(git commit *)", "Bash(git * main)", "Bash(* --version)", "Bash(* --help *)"],
    "deny": ["Bash(git push *)"]
  }
}
```

## Equivalent configs per tool

### Claude Code

File: `.claude/settings.json`

```json
{
  "permissions": {
    "allow": ["Bash(npm run *)", "Bash(git commit *)", "Bash(git * main)", "Bash(* --version)", "Bash(* --help *)"],
    "deny": ["Bash(git push *)"]
  }
}
```

### Codex CLI

File: `~/.codex/rules/default.rules` (Starlark syntax)

```python
prefix_rule(
    pattern = ["git", "push"],
    decision = "forbidden",
    justification = "Pushing to remote is not allowed",
)

prefix_rule(
    pattern = ["npm", "run"],
    decision = "allow",
)

prefix_rule(
    pattern = ["git", "commit"],
    decision = "allow",
)

# git * main — cannot be expressed as a single rule;
# each subcommand must be listed explicitly
prefix_rule(pattern = ["git", "checkout", "main"], decision = "allow")
prefix_rule(pattern = ["git", "merge", "main"],    decision = "allow")
prefix_rule(pattern = ["git", "rebase", "main"],    decision = "allow")

# * --version and * --help * — impossible (prefix-only matching)
```

Limitations: `prefix_rule` matches only the leading tokens of a command. Wildcard in the first position or in the middle
of a command is not supported.

### Gemini CLI

File: `~/.gemini/policies/permissions.toml`

```toml
[[rule]]
toolName = "run_shell_command"
commandPrefix = "npm run"
decision = "allow"
priority = 100

[[rule]]
toolName = "run_shell_command"
commandPrefix = "git commit"
decision = "allow"
priority = 100

[[rule]]
toolName = "run_shell_command"
commandRegex = "git \\w+ main"
decision = "allow"
priority = 100

[[rule]]
toolName = "run_shell_command"
commandRegex = ".+ --version$"
decision = "allow"
priority = 100

[[rule]]
toolName = "run_shell_command"
commandRegex = ".+ --help"
decision = "allow"
priority = 100

[[rule]]
toolName = "run_shell_command"
commandPrefix = "git push"
decision = "deny"
priority = 200
denyMessage = "Pushing to remote is not allowed"
```

Note: `git push` has higher priority (200) to override the `git * main` allow rule.

### OpenCode

File: `opencode.json`

```json
{
  "permission": {
    "bash": {
      "*": "ask",
      "npm run *": "allow",
      "git commit *": "allow",
      "git * main": "allow",
      "* --version": "allow",
      "* --help *": "allow",
      "git push *": "deny"
    }
  }
}
```

Note: last matching pattern wins, so `git push *: deny` must appear after `git * main: allow`.

### Kilo Code

File: `kilo.jsonc`

```jsonc
{
  "permission": {
    "bash": {
      "*": "ask",
      "npm run *": "allow",
      "git commit *": "allow",
      "git * main": "allow",
      "* --version": "allow",
      "* --help *": "allow",
      "git push *": "deny",
    },
  },
}
```

Note: same semantics as OpenCode — last matching pattern wins.

### Cursor CLI

File: `~/.cursor/cli-config.json` (global) or `<project>/.cursor/cli.json` (project)

```json
{
  "permissions": {
    "allow": ["Shell(npm:run *)", "Shell(git:commit *)", "Shell(git:* main)"],
    "deny": ["Shell(git:push *)"]
  }
}
```

Limitations: `Shell(commandBase)` matches the first token only. The `command:args` syntax (e.g. `git:commit *`) enables
glob matching on arguments. Wildcard in the command position (`*:--version`) is not explicitly documented.

### GitHub Copilot CLI

CLI flags only (no declarative config file for command rules):

```bash
copilot \
  --allow-tool='shell(npm run)' \
  --allow-tool='shell(git commit)' \
  --deny-tool='shell(git push)' \
  "$PROMPT"
```

Limitations: prefix-based matching only, no globs or regex. Rules `git * main`, `* --version`, and `* --help *` cannot
be expressed.

## Comparison: command pattern expressiveness

Which rules from the reference example can each tool reproduce?

| Rule              | Claude Code | Codex CLI  | Gemini CLI | OpenCode | Kilo Code | Cursor CLI     | Copilot CLI |
| ----------------- | ----------- | ---------- | ---------- | -------- | --------- | -------------- | ----------- |
| `npm run *`       | glob        | prefix     | prefix     | glob     | glob      | `npm:run *`    | prefix      |
| `git commit *`    | glob        | prefix     | prefix     | glob     | glob      | `git:commit *` | prefix      |
| `git * main`      | glob        | enumerate  | regex      | glob     | glob      | `git:* main`   | impossible  |
| `* --version`     | glob        | impossible | regex      | glob     | glob      | undocumented   | impossible  |
| `* --help *`      | glob        | impossible | regex      | glob     | glob      | undocumented   | impossible  |
| `git push *` deny | glob        | prefix     | prefix     | glob     | glob      | `git:push *`   | prefix      |
| **Score**         | **6/6**     | **3/6**    | **6/6**    | **6/6**  | **6/6**   | **4/6**        | **3/6**     |

## Comparison: feature matrix

| Feature           | Claude Code             | Codex CLI                  | Gemini CLI                  | OpenCode         | Kilo Code        | Cursor CLI                  | Copilot CLI              |
| ----------------- | ----------------------- | -------------------------- | --------------------------- | ---------------- | ---------------- | --------------------------- | ------------------------ |
| Config format     | JSON                    | Starlark                   | TOML                        | JSON             | JSONC            | JSON                        | CLI flags                |
| Config file       | `.claude/settings.json` | `.codex/rules/*.rules`     | `~/.gemini/policies/*.toml` | `opencode.json`  | `kilo.jsonc`     | `~/.cursor/cli-config.json` | `~/.copilot/config.json` |
| Pattern type      | Glob                    | Prefix only                | Prefix + Regex              | Glob             | Glob             | Glob (cmd:args)             | Prefix only              |
| Regex support     | No                      | No                         | Yes                         | No               | No               | No                          | No                       |
| Decisions         | allow, deny             | allow, prompt, forbidden   | allow, ask_user, deny       | allow, ask, deny | allow, ask, deny | allow, deny                 | allow, deny, session     |
| Priority model    | deny > allow            | forbidden > prompt > allow | Numeric + tier              | Last match wins  | Last match wins  | deny > allow                | deny > allow             |
| Sandbox           | No                      | 3 levels                   | No                          | No               | No               | No                          | No                       |
| MCP tool rules    | Yes                     | No                         | Yes (mcpName)               | Yes              | Yes              | Yes `Mcp(s:t)`              | Yes `MCP_SERVER(tool)`   |
| File path rules   | No                      | No                         | No                          | Yes (read/edit)  | Yes (read)       | Yes (Read/Write)            | Yes (path perms)         |
| URL rules         | No                      | No                         | No                          | Yes (webfetch)   | Yes (webfetch)   | Yes (WebFetch)              | Yes (--allow-url)        |
| Per-agent rules   | No                      | No                         | No                          | Yes              | Yes              | No                          | No                       |
| Admin policies    | No                      | Yes (requirements.toml)    | Yes (system-wide)           | No               | No               | No                          | No                       |
| YOLO mode         | No                      | full-auto                  | yolo                        | No               | Yes              | No                          | Yes (--yolo)             |
| Env var filtering | No                      | Yes (glob patterns)        | No                          | No               | No               | No                          | No                       |
| Network sandbox   | No                      | Yes (network_access)       | No                          | No               | No               | No                          | No                       |

## Summary

**By command pattern expressiveness:**

1. **Claude Code, OpenCode, Kilo Code** (6/6) — full glob support in any position; the reference example translates 1:1.
2. **Gemini CLI** (6/6) — regex covers all patterns but requires more verbose syntax.
3. **Cursor CLI** (4/6) — globs in arguments via `command:args`, but wildcard in command position is undocumented.
4. **Codex CLI, Copilot CLI** (3/6) — prefix-only matching; patterns with wildcards at the start or middle are
   impossible.

**By overall security system completeness:**

1. **Gemini CLI** — numeric priorities, tier system, admin policies, multiple approval modes, regex.
2. **OpenCode / Kilo Code** — three-way decisions (allow/ask/deny), per-agent overrides, file and URL rules.
3. **Cursor CLI** — Read/Write/WebFetch/Mcp permissions with globs, but no ask action or per-agent rules.
4. **Copilot CLI** — path and URL permissions, but CLI-flags-only approach limits declarative configuration.
5. **Codex CLI** — weakest patterns but unique OS-level sandbox isolation and env var filtering.
6. **Claude Code** — most concise syntax, but only allow/deny without ask, no file path, URL, or per-agent rules.

---

## Canonical format specification

### Overview

The agloom canonical permission format is an intermediate representation that transpiles into tool-specific configs. It
uses YAML or JSON, supports glob patterns, and follows **first match wins** semantics.

### Format

File: `.agloom/permissions.yml` or `.agloom/permissions.json`

```yaml
shell:
  - "git push *": deny
  - "npm run *": allow
  - "git commit *": allow
  - "git * main": allow
  - "* --version": allow
  - "* --help *": allow
  - "*": allow

mcp:
  - "untrusted-server:*": deny
  - "datadog:*": allow

file:
  - ".env*": deny
  - "**/*.key": read
  - "src/**": write
```

Equivalent JSON:

```json
{
  "shell": [
    {
      "git push *": "deny"
    },
    {
      "npm run *": "allow"
    },
    {
      "git commit *": "allow"
    },
    {
      "git * main": "allow"
    },
    {
      "* --version": "allow"
    },
    {
      "* --help *": "allow"
    },
    {
      "*": "allow"
    }
  ],
  "mcp": [
    {
      "untrusted-server:*": "deny"
    },
    {
      "datadog:*": "allow"
    }
  ],
  "file": [
    {
      ".env*": "deny"
    },
    {
      "**/*.key": "read"
    },
    {
      "src/**": "write"
    }
  ]
}
```

### Sections

#### `shell`

Controls which shell commands the agent can execute.

| Decision | Meaning                      |
| -------- | ---------------------------- |
| `allow`  | Execute without confirmation |
| `deny`   | Block execution              |

Pattern: glob against the full command string. Supports `*` (any characters), `?` (single character).

#### `mcp`

Controls which MCP server tools the agent can use.

| Decision | Meaning                      |
| -------- | ---------------------------- |
| `allow`  | Execute without confirmation |
| `deny`   | Block execution              |

Pattern: `server:tool` with glob support. Examples: `"datadog:*"`, `"*:search"`, `"slack:post_message"`.

#### `file`

Controls file access by path.

| Decision | Meaning                           |
| -------- | --------------------------------- |
| `deny`   | No access (read or write blocked) |
| `read`   | Read-only access                  |
| `write`  | Full access (read + write)        |

Pattern: glob against relative file path from workspace root. Supports `*`, `**`, `?`.

### Evaluation

**First match wins.** Rules are evaluated top-to-bottom; the first rule whose pattern matches the input determines the
decision. Place more specific rules before general ones.

If no rule matches, the decision is left to the target tool's default behavior (typically interactive confirmation).

An explicit catch-all (`"*": allow` or `"*": deny`) at the end of a section overrides this fallback.

### Transpilation mapping

#### shell

| Target      | Strategy                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Claude Code | Split into `allow[]` / `deny[]` lists, wrap as `Bash(pattern)`. Order lost (deny > allow).                 |
| Codex CLI   | Extract prefix from pattern → `prefix_rule`. Glob-in-middle/start rules emit warning or enumerate.         |
| Gemini CLI  | Map to `[[rule]]` entries. Position → descending `priority` (first rule = highest). Glob → `commandRegex`. |
| OpenCode    | Map to `bash: { pattern: decision }` object. Reverse order (last match wins).                              |
| Kilo Code   | Same as OpenCode.                                                                                          |
| Cursor CLI  | Split into `allow[]` / `deny[]`, wrap as `Shell(cmd:args)`. Glob-in-command rules emit warning.            |
| Copilot CLI | Map to `--allow-tool` / `--deny-tool` flags. Glob rules degrade to prefix or emit warning.                 |

#### mcp

| Target      | Strategy                                                  |
| ----------- | --------------------------------------------------------- |
| Claude Code | Wrap as `mcp__server__tool` in `allow[]` / `deny[]`.      |
| Codex CLI   | Not supported — emit warning.                             |
| Gemini CLI  | Map to `[[rule]]` with `mcpName` + `toolName`.            |
| OpenCode    | Map to `mcp: { pattern: decision }`.                      |
| Kilo Code   | Same as OpenCode.                                         |
| Cursor CLI  | Wrap as `Mcp(server:tool)` in `allow[]` / `deny[]`.       |
| Copilot CLI | Map to `--allow-tool='MCP_SERVER(tool)'` / `--deny-tool`. |

#### file

| Target      | Strategy                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | Not supported — emit warning.                                                                                                          |
| Codex CLI   | Not supported — emit warning.                                                                                                          |
| Gemini CLI  | Not supported — emit warning.                                                                                                          |
| OpenCode    | `deny` → `read: { pattern: deny }, edit: { pattern: deny }`. `read` → `edit: { pattern: deny }`. `write` → `edit: { pattern: allow }`. |
| Kilo Code   | Same as OpenCode (read rules only).                                                                                                    |
| Cursor CLI  | `deny` → `Read(pattern)` + `Write(pattern)` in deny. `read` → `Write(pattern)` in deny. `write` → `Write(pattern)` in allow.           |
| Copilot CLI | Limited — path permissions apply to all tools, not per-file read/write. Best effort.                                                   |

### Transpilation coverage

How much of the canonical format each target can faithfully represent:

| Target      | shell         | mcp | file    | Coverage |
| ----------- | ------------- | --- | ------- | -------- |
| Claude Code | full globs    | yes | no      | 67%      |
| Codex CLI   | prefix only   | no  | no      | 33%      |
| Gemini CLI  | via regex     | yes | no      | 67%      |
| OpenCode    | full globs    | yes | yes     | 100%     |
| Kilo Code   | full globs    | yes | partial | 89%      |
| Cursor CLI  | partial globs | yes | yes     | 89%      |
| Copilot CLI | prefix only   | yes | partial | 56%      |

## Sources

- Claude Code: <https://docs.anthropic.com/en/docs/claude-code/settings>
- Codex CLI: <https://developers.openai.com/codex/config-advanced>, <https://developers.openai.com/codex/rules>
- Gemini CLI: <https://geminicli.com/docs/reference/policy-engine/>
- OpenCode: <https://opencode.ai/docs/permissions/>
- Kilo Code: <https://kilo.ai/docs/getting-started/settings/auto-approving-actions>
- Cursor CLI: <https://cursor.com/docs/cli/reference/permissions>
- GitHub Copilot CLI: <https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/configure-copilot-cli>

---

> Research date: 2026-04-04
