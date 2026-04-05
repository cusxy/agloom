---
type: research
summary: Анализ Cursor как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации Cursor IDE
  по критериям C1-C10. Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# Cursor (Anysphere)

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

Cursor --- AI-native IDE (форк VS Code). Проприетарный, платные тарифы
(Hobby, Pro, Ultra, Teams, Enterprise). Поддержка нескольких AI-моделей.
Cursor 3 (2026) --- интерфейс, центрированный вокруг агентов: локально,
в worktrees, в облаке, через SSH.

## C1. Instructions

Поддерживает `AGENTS.md` с иерархическим сканированием (project root +
вложенные директории). Инструкции из вложенных файлов комбинируются с
родительскими. Также поддерживает User Rules (глобальные, через Settings)
и Team Rules (через организацию).

## C2. Rules

Каталог `.cursor/rules/` содержит `.mdc`-файлы (Markdown с YAML frontmatter).
Frontmatter: `description`, `globs`, `alwaysApply`. Типы правил:

- **Always** (`alwaysApply: true`) --- всегда в контексте.
- **Auto Attached** (`globs: "src/**/*.ts"`) --- при совпадении паттерна.
- **Agent Requested** (`description` без `globs`/`alwaysApply`) --- агент
  решает по описанию.
- **Manual** (без frontmatter) --- включается вручную.

Приоритет: Team Rules -> Project Rules -> User Rules. Legacy: `.cursorrules`
(deprecated, но поддерживается).

Команда `/Generate Cursor Rules` для генерации из диалога.

## C3. Commands

Нативные project-level slash-команды не документированы как отдельная файловая
система. Agent Requested rules могут выполнять аналогичную роль.

## C4. Skills

Cursor 2.4+ поддерживает Agent Skills (анонсировано вместе с subagents).
Детали формата и файловой системы для project-level skills не полностью
документированы в публичных источниках.

## C5. Agents

**Default subagents**: research (codebase), terminal commands, parallel work
streams. **Custom subagents**: определяются пользователем (детали формата
не полностью публичны). Subagents работают с собственным контекстом, могут
иметь custom prompts, tool access, model selection.

**Automations**: агенты, запускаемые по расписанию или по событиям
из внешних инструментов. Работают в cloud sandbox с MCPs и memory tool.

## C6. MCP

Конфигурируется в `.cursor/mcp.json` (project) и `~/.cursor/mcp.json` (global).
Формат: `{ "mcpServers": { "name": { "command": "...", "args": [...], "env": {...} } } }`.
Поддерживает stdio и Streamable HTTP. Лимит: ~40 активных tools.
Project-level config приоритетнее global.

## C7. Hooks

Развитая система hooks (`.cursor/hooks`). Типы:

- **stop** --- при остановке агента.
- **beforeSubmitPrompt** --- модификация промпта.
- **PreToolUse** / **PostToolUse** --- перед/после вызова инструмента.
- **beforeMCPExecution** / **afterMCPExecution** --- перед/после MCP-вызова.

Hooks могут observe, block или modify поведение. Используются для security,
compliance, observability. Совместимость с Claude Code hooks (CLI).

## C8. LSP

Не поддерживается как отдельная project-level конфигурация (встроен в IDE).

## C9. Other

- **Cloud agents**: агенты в облачных sandbox'ах.
- **Worktree agents**: параллельные агенты в git worktrees.
- **Memory tool**: агенты обучаются на предыдущих запусках.
- **Long-running agents**: для сложных многоэтапных задач.
- **Cursor CLI**: CLI-интерфейс с hooks-совместимостью.

## C10. Adapter verdict

Cursor требует **отдельного адаптера `cursor`**. Уникальная файловая структура
(`.cursor/rules/*.mdc`), собственный формат правил с glob-паттернами, MCP в
`.cursor/mcp.json`, hooks. Компоненты адаптера: rules (`.mdc` с frontmatter),
MCP (`.cursor/mcp.json`), hooks (`.cursor/hooks`). `AGENTS.md` поддерживается
дополнительно.

## Плюсы

- Гранулярная система правил с glob-паттернами и типами (Always, Auto, Agent
  Requested, Manual).
- Развитая система hooks для security и compliance.
- Subagents и cloud agents для параллельной работы.
- Automations по расписанию/событиям.
- MCP с project-level конфигурацией.

## Минусы

- Проприетарный формат `.mdc` --- не совместим с другими инструментами.
- Лимит ~40 MCP tools --- ограничение для сложных конфигураций.
- Skills документированы поверхностно --- формат неясен.
- Платный без бесплатного tier (кроме Hobby с ограничениями).
- `.cursorrules` deprecated, но миграция не автоматическая.

## Источники

- [Cursor --- Rules](https://cursor.com/docs/context/rules)
- [Cursor --- MCP](https://cursor.com/docs/context/mcp)
- [Cursor --- Hooks](https://cursor.com/docs/hooks)
- [Cursor --- Subagents](https://cursor.com/docs/subagents)
- [Cursor --- Changelog](https://cursor.com/changelog)
- [Cursor --- Hooks for security](https://cursor.com/blog/hooks-partners)
