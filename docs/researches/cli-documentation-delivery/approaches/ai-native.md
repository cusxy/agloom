---
relates:
  - docs/researches/cli-documentation-delivery/RESEARCH.md
---

# A4: AI-Native Documentation Files

## Описание

Пакет содержит файлы, специально предназначенные для AI-инструментов:
AGENTS.md, CLAUDE.md, llms.txt. Вместо полной документации поставляются
компактные инструкции, направляющие AI-агентов к правильному использованию
CLI.

## Форматы и совместимость

### AGENTS.md

- Формат: plain Markdown, без required schema.
- Совместимость: 20+ инструментов (Codex, Jules, Gemini CLI, Cursor,
  Windsurf, Aider, Devin, Junie, Zed, Claude Agent SDK).
- Adoption: 60 000+ GitHub repos. Stewarded by Agentic AI Foundation
  (Linux Foundation).
- Рекомендуемый размер: <= 150 строк.
- Monorepo: nested AGENTS.md в поддиректориях, closest file wins.

### CLAUDE.md

- Формат: plain Markdown, без required schema.
- Совместимость: Claude Code (native), VS Code Copilot, Zed.
- Hierarchy: `~/.claude/CLAUDE.md` (global) -> `./CLAUDE.md` (project)
  -> `.claude/rules/` (scoped). Supports `@path/to/import` syntax.
- Особенность: `/init` command auto-generates starter file.

### llms.txt

- Формат: Markdown file, served at `/llms.txt` URL.
- Companion: `/llms-full.txt` — полный текст документации.
- Adoption: ~193 000 live websites (BuiltWith, March 2026); до 844 000
  по историческим данным (BuiltWith, October 2025). 10% из топ-300K доменов
  (SE Ranking, 2025). Среди adopters: Anthropic, Vercel, Stripe, Cloudflare.
- Tooling: `llmstxt-cli` устанавливает llms.txt как agent skills
  в `.agents/skills/` с symlinks для каждого инструмента.

### Cross-tool compatibility

| Format                          | Claude Code | Cursor | Copilot  | Windsurf | Zed    | Codex    |
| ------------------------------- | ----------- | ------ | -------- | -------- | ------ | -------- |
| AGENTS.md                       | SDK         | Yes    | Yes      | Yes      | Yes    | Yes      |
| CLAUDE.md                       | Native      | No     | Yes      | No       | Yes \* | No       |
| .github/copilot-instructions.md | No          | No     | Native   | No       | No     | No       |
| llms.txt                        | Via MCP     | @Docs  | Indirect | Indirect | No     | Indirect |

\* Zed reads CLAUDE.md at project root, `.claude/` directory
([source](https://zed.dev/docs/ai/rules)).

## Реализация для npm-пакета

```json
{
  "files": ["dist", "AGENTS.md", "docs/usage"]
}
```

AGENTS.md в корне пакета направляет AI-агентов:

```markdown
# agloom: CLI transpiler for AI coding assistant configs

## Quick reference

Before working with agloom, read the relevant doc in docs/usage/.

## Commands

- `agloom transpile` — transpile configs (see docs/usage/transpile.md)
- `agloom clean` — remove generated files
- `agloom init` — initialize canonical config
- `agloom adapters` — list available adapters
```

## Оценка по критериям

### C1: Zero-config доступность — Medium

AGENTS.md доступен в `node_modules/` после install. Однако это инструкции
для AI, не user-facing документация. Человек не получает man pages
или rich `--help`.

### C2: AI-совместимость — High

Максимальная совместимость. AGENTS.md читается 20+ инструментами.
Compact instructions оптимальны для context window (150 lines << full docs).

### C3: Maintenance burden — Low

Один файл (AGENTS.md), 50-150 строк. Обновляется при изменении
CLI interface. Минимальная нагрузка по сравнению с man pages или bundled docs.

### C4: Package size impact — +5-20 KB

AGENTS.md: ~3-5 KB. Опциональные `docs/usage/*.md`: ~10-50 KB.
Ничтожный overhead.

### C5: Discoverability — Medium

AI-инструменты находят AGENTS.md автоматически. Людям нужно знать
о конвенции — не все разработчики знакомы с AGENTS.md.

### C6: Single-source потенциал — No

AI-native файлы — это отдельный артефакт, не source для других форматов.

## Плюсы

- **Максимальный cross-tool coverage** при минимальных затратах.
- **Ничтожный overhead** — 5-20 KB к пакету.
- **Конвенция набирает momentum** — 60k+ repos, Linux Foundation stewardship.
- **Релевантно для целевой аудитории agloom** — пользователи agloom
  по определению используют AI coding assistants.
- **Не конфликтует** с другими подходами — можно комбинировать.

## Минусы

- **Не заменяет user-facing documentation.** Человек, не использующий
  AI-инструменты, не получает пользы от AGENTS.md.
- **Фрагментация форматов**: Claude Code читает CLAUDE.md, Cursor —
  `.cursor/rules/`, Copilot — `.github/copilot-instructions.md`.
  AGENTS.md — наиболее portable, но не native для Claude Code.
- **Молодая конвенция**: стандарт может эволюционировать.
- **Ограниченная глубина**: instructions file не заменяет reference docs.

## Контекст применимости

**Оправдан**, когда: целевая аудитория активно использует AI-инструменты;
CLI небольшой (< 10 commands); требуется максимальный coverage при
минимальных затратах.

**Не оправдан**, когда: пользователи ожидают man pages или rich offline docs;
AI-инструменты не являются частью workflow целевой аудитории.

## Практический пример: agloom AGENTS.md

```markdown
# agloom

CLI transpiler: canonical agent configs -> tool-specific files.

## Commands

- `agloom transpile [-a adapter]` — transpile all or specific adapter
- `agloom clean [-a adapter]` — remove generated files
- `agloom init` — create canonical config scaffold
- `agloom adapters` — list available adapters (claude, opencode, agentsmd)

## Architecture

- Canonical config: `.agloom/` directory with YAML files
- Adapters: claude (CLAUDE.md), opencode, agentsmd (AGENTS.md)
- Each adapter: instructions + skills + agents transpilers + overlay

## Key files

- `src/cli/` — CLI entry point (Ink/React)
- `src/instructions-transpiler/` — instructions processing
- `src/skills-transpiler/` — skills processing
- `src/agents-transpiler/` — agents processing
```
