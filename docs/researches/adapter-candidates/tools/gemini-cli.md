---
type: research
summary: Анализ Gemini CLI как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации Gemini CLI (Google)
  по критериям C1-C10. Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# Gemini CLI (Google)

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

Gemini CLI --- open-source CLI-агент от Google (`google-gemini/gemini-cli`).
Модели Gemini (Pro, Flash). Контекстное окно до 1M токенов. Бесплатный tier
с Google-аккаунтом (Flash). Развитая система extensions.

## C1. Instructions

Основной файл --- `GEMINI.md` (имя конфигурируемо через `context.fileName`
в `settings.json`). Иерархическая загрузка: global (`~/.gemini/GEMINI.md`) ->
ancestor directories -> subdirectories (лимит 200, конфигурируемо).
Поддержка импорта через `@path/to/file.md` синтаксис. Команды `/memory show`,
`/memory reload`, `/memory add`. Команда `/init` для генерации начального файла.

## C2. Rules

Импорт-синтаксис `@path/to/file.md` для модуляризации контекста внутри
`GEMINI.md`. Отдельный каталог правил (аналог `.claude/rules/`) не
документирован. Модульность достигается через импорты и extensions.

## C3. Commands

Пользовательские slash-команды --- TOML-файлы в `.gemini/commands/`.
Extension-level: `extensions/<name>/commands/*.toml`. Вложенные каталоги
определяют namespace (`commands/gcs/sync.toml` -> `/gcs:sync`). Приоритет:
project > user > extension.

## C4. Skills

Формат SKILL.md, совместимый с Claude Code и Codex CLI. Размещение:
`.gemini/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md` (portable).
Lazy-loading: при старте загружаются только `name` и `description`, полные
инструкции --- при активации через `activate_skill` tool. Skills могут быть
частью extensions.

## C5. Agents

Статус: **experimental/preview**. Определяются в `.gemini/agents/*.md`.
Формат: Markdown + YAML frontmatter (`name`, `description`, `model`, `tools`).
Wildcard-синтаксис для tools (`*`, `mcp_*`, `mcp_server-name_*`). Вызов через
`@agent-name` или автоматическая делегация.

## C6. MCP

Конфигурируется в `.gemini/settings.json` под ключом `mcpServers`. Поля:
`command`, `args`, `env`, `trust`, `includeTools`, `excludeTools`, `timeout`.
Поддерживает stdio, SSE (`url`), HTTP streaming (`httpUrl`).

## C7. Hooks

Extensions могут содержать hooks (часть `gemini-extension.json`).
Project-level hooks вне extensions не документированы.

## C8. LSP

Не поддерживается на уровне project-level конфигурации.

## C9. Other

- **Extensions**: ключевое отличие --- модульные пакеты с commands, MCP,
  skills, agents, hooks, policies, themes. Установка:
  `gemini extensions install <github-url>`. 70+ extensions в галерее.
- **Variable substitution**: `${extensionPath}`, `${workspacePath}`, `${/}`.
- **Sandbox**: кастомный `sandbox.Dockerfile` в `.gemini/`.
- **Policies**: конфигурация в `.gemini/policies/`.

## C10. Adapter verdict

Gemini CLI требует **отдельного адаптера `gemini`**. Ключевые отличия от
существующих адаптеров: проприетарное имя файла (`GEMINI.md`), JSON settings,
TOML-команды, extensions. Компоненты адаптера: instructions (`GEMINI.md`),
skills (`.gemini/skills/`), agents (`.gemini/agents/`),
commands (`.gemini/commands/`), MCP (`.gemini/settings.json`).

## Плюсы

- Конфигурируемое имя файла инструкций --- гибкость адаптации.
- Lazy-loading skills --- оптимизация расхода токенов.
- Развитая система extensions с commands, MCP, skills, agents, hooks.
- Бесплатный tier и наибольшее контекстное окно (1M токенов).
- Импорт-синтаксис `@` для модуляризации контекста.

## Минусы

- Суб-агенты в статусе experimental/preview --- API нестабилен.
- Проприетарное имя файла инструкций вместо стандарта AGENTS.md.
- Команды в TOML --- несовместимы с Markdown-командами Claude Code.
- Extensions только на уровне пользователя, нет project-level extensions.
- Бесплатный tier ограничен Flash-моделями (март 2026).

## Источники

- [Gemini CLI --- Configuration](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html)
- [Gemini CLI --- Extensions](https://geminicli.com/extensions/)
- [Gemini CLI --- Agent Skills](https://geminicli.com/docs/cli/skills/)
- [Gemini CLI --- Subagents](https://geminicli.com/docs/core/subagents/)
- [Gemini CLI --- Settings](https://geminicli.com/docs/cli/settings/)
- [Gemini CLI --- GEMINI.md](https://geminicli.com/docs/cli/gemini-md/)
