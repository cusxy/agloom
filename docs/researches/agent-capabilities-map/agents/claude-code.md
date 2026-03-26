---
type: research
summary: Возможности Claude Code для Agent SDS
description: >
  Детальный анализ project-level конфигурации Claude Code (Anthropic)
  по критериям C1–C8. Часть исследования agent-capabilities-map.
relates:
  - docs/researches/agent-capabilities-map/RESEARCH.md
  - docs/specs/instructions-transpiler.md
---

# Claude Code (Anthropic)

Критерии оценки — см. `docs/researches/agent-capabilities-map/RESEARCH.md` § Критерии оценки.

## Общая характеристика

Claude Code — CLI-агент от Anthropic, устанавливаемый через `npm install -g @anthropic-ai/claude-code`.
Использует модели Claude (Sonnet, Opus, Haiku). По состоянию на март 2026 занимает
лидирующую позицию на SWE-bench Verified (80.8% с Opus 4.6).

## C1. Конфигурационная модель

Project-level каталог `.claude/` содержит полную структуру конфигурации:

```text
project-root/
├── CLAUDE.md                    # Shared project instructions (git-tracked)
├── CLAUDE.local.md              # Personal instructions (.gitignore)
├── .mcp.json                    # Shared MCP config (git-tracked)
└── .claude/
    ├── settings.json            # Project shared settings (git-tracked)
    ├── settings.local.json      # Project personal settings (.gitignore)
    ├── rules/                   # Modular rules (git-tracked)
    │   └── *.md
    ├── commands/                # Custom slash commands (git-tracked)
    │   └── *.md
    ├── skills/                  # Reusable skills (git-tracked)
    │   └── <name>/SKILL.md
    └── agents/                  # Sub-agent definitions (git-tracked)
        └── *.md
```

Формат конфигурации: JSON для `settings.json` и `.mcp.json`, Markdown для всех
остальных компонентов. Разделение на shared (git-tracked) и local (.gitignore)
файлы встроено в архитектуру.

## C2. Инструкции агенту

Основной файл — `CLAUDE.md` в корне проекта. При отсутствии `CLAUDE.md`
читается `AGENTS.md` как fallback. Иерархия загрузки:

1. `~/.claude/CLAUDE.md` — глобальные инструкции.
2. `CLAUDE.md` (или `.claude/CLAUDE.md`) — project-level инструкции.
3. Directory-level `CLAUDE.md` — загружаются on demand при работе с файлами
   в соответствующих каталогах (lazy loading).

Модульность реализована через `.claude/rules/*.md`. Правила поддерживают
path-scoping через frontmatter:

```yaml
---
paths:
  - "src/api/**/*.ts"
---
# API-specific rules loaded only when working with matching files
```

Поддержка импорта через `@path/to/file` синтаксис (максимальная глубина — 5 уровней).
Личные инструкции — `CLAUDE.local.md`.

## C3. Команды

Пользовательские slash-команды определяются как Markdown-файлы:

- **Project-level**: `.claude/commands/*.md` → `/project:<name>`.
- **Personal**: `~/.claude/commands/*.md` → `/user:<name>`.

Команды поддерживают параметры: `$ARGUMENTS` (все аргументы), `$ARGUMENTS[N]`
или `$N` (позиционные, 0-based). Динамическая инъекция через `` !`command` ``
(выполнение shell-команды). Официально commands объединены со Skills — файл в
`.claude/commands/deploy.md` и skill в `.claude/skills/deploy/SKILL.md` оба создают
`/deploy` (skill имеет приоритет при совпадении имён).

## C4. Навыки (Skills)

Skills определяются в `.claude/skills/<name>/SKILL.md` с YAML frontmatter:

```yaml
---
name: skill-name
description: When to trigger this skill
context: fork # optional: isolated execution
agent: general-purpose # optional: specific subagent type
---
Instructions for the skill...
```

Ключевые особенности:

- Автоматическая активация на основе описания (description matching).
- Поддержка `context: fork` для выполнения в изолированном контексте.
- Skills — это пакеты с поддержкой вложенных файлов (через `@reference` синтаксис).
- Унификация с commands: `.claude/commands/deploy.md` и `.claude/skills/deploy/SKILL.md`
  оба создают команду `/deploy`.

## C5. Суб-агенты

Определяются в `.claude/agents/*.md` с YAML frontmatter:

```yaml
---
name: code-reviewer
model: sonnet
description: Reviews code for best practices
tools:
  - Read
  - Grep
  - Glob
---
System prompt for the agent...
```

Каждый агент работает в изолированном контексте. Ключевые поля frontmatter:

| Поле              | Описание                                          |
| ----------------- | ------------------------------------------------- |
| `name`            | Уникальный идентификатор                          |
| `description`     | Когда делегировать задачу этому агенту            |
| `model`           | `sonnet`, `opus`, `haiku` или полный ID модели    |
| `tools`           | Allowlist инструментов (по умолчанию — все)       |
| `disallowedTools` | Denylist (удаляет из inherited/specified)         |
| `permissionMode`  | `default`, `acceptEdits`, `dontAsk`, `plan`       |
| `maxTurns`        | Лимит агентных итераций                           |
| `mcpServers`      | Inline MCP-серверы, доступные только этому агенту |
| `skills`          | Предзагруженные skills                            |
| `memory`          | Persistent memory: `user`, `project`, `local`     |
| `isolation`       | `worktree` — выполнение в отдельном git worktree  |

## C6. MCP-интеграция

Конфигурируется в `.mcp.json` в корне проекта (git-tracked):

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

Поддерживает stdio и HTTP транспорты (SSE — deprecated). Environment variable
expansion: `${VAR}` или `${VAR:-default}`. Inline MCP-серверы могут быть
определены в frontmatter суб-агентов.

## C7. Расширяемость

Встроенная система правил (`.claude/rules/`), поддержка множественных skills и agents.
Нет формального понятия extensions или plugins. Расширение происходит через
добавление файлов в соответствующие каталоги.

## C8. Зрелость экосистемы

Высокая зрелость: обширная документация, стабильный API конфигурации,
многомиллионная пользовательская база. Формат SKILL.md стал де-факто стандартом,
принятым другими агентами. Подписочная модель обеспечивает предсказуемые расходы.

## Плюсы

- Наиболее полная и структурированная система project-level конфигурации.
- Чёткое разделение shared/local файлов на уровне архитектуры.
- Формат SKILL.md стал отраслевым стандартом (принят Codex CLI, Gemini CLI, OpenCode).
- Богатая система суб-агентов с изоляцией контекста и ограничением инструментов.

## Минусы

- Основной файл инструкций — `CLAUDE.md` (проприетарное имя); `AGENTS.md`
  поддерживается только как fallback при отсутствии `CLAUDE.md`.
- MCP-конфигурация вынесена в отдельный файл (`.mcp.json`), а не интегрирована
  в общий settings.
- Отсутствие формального extension/plugin механизма — расширение только через
  файловую систему.
- Привязка к экосистеме Anthropic (модели Claude).

## Источники

- [Claude Code — Skills](https://code.claude.com/docs/en/skills)
- [Claude Code — Memory (CLAUDE.md)](https://code.claude.com/docs/en/memory)
- [Claude Code — Sub-agents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code — MCP](https://code.claude.com/docs/en/mcp)
- [Claude Code — Settings](https://code.claude.com/docs/en/settings)
- [Claude Code — .claude directory guide](https://computingforgeeks.com/claude-code-dot-claude-directory-guide/)
- [Claude Code Customization Guide — alexop.dev](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
