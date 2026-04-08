# 08 — Formatting (compact before → after)

<!--
Второй маленький статичный блок. Формат как у Plugins, только содержимое простое: ugly markdown → pretty markdown.

Layout desktop: 2 колонки одинаковой ширины.
  - Left: "Before" raw markdown
  - Right: "After" formatted markdown
Под колонками — одна командная строка и caption.

Mobile: одна колонка.

Высота секции ~520px на desktop.
-->

## Content

**Eyebrow:** `FORMATTING`

**H2:** Ship canonical files that look canonical.

**Body (short):**

> Agloom ships with `agloom format` — a pre-configured wrapper around prettier and markdownlint. It targets `.agloom/**/*` and `**/AGLOOM.md` by default. No config to install, no linter plugins to wire up. A `--check` flag for CI. Run it as a pre-commit hook or manually before `agloom transpile`.

---

### Before → After

**Left — before:**

```markdown
#   My Project


## Stack

- TypeScript ,React,PostgreSQL
-   Next.js 14

## Conventions
*  Use server components by default.
*   All DB queries go through Prisma
- never write raw SQL
## Boundaries
- Never  modify   files in `generated/`.
-  Never skip TypeScript strict mode
```

**Right — after:**

```markdown
# My Project

## Stack

- TypeScript, React, PostgreSQL
- Next.js 14

## Conventions

- Use server components by default.
- All DB queries go through Prisma — never write raw SQL.

## Boundaries

- Never modify files in `generated/`.
- Never skip TypeScript strict mode.
```

**Command (centered below both panels, macOS-terminal chip styling):**

```bash
$ agloom format          # write mode (default)
$ agloom format --check  # CI mode, exits non-zero if unformatted
```

**Caption:**

> Supports `.md`, `.json`, `.yaml`, `.toml`. Configurable via `.prettierrc.*`, `.markdownlint.*`, or a `prettier` / `markdownlint` section in `.agloom/config.yml`. [Full formatting guide →](/docs/formatting)
