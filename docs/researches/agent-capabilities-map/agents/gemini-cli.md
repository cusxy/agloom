---
type: research
summary: Возможности Gemini CLI для Agloom
description: >
  Детальный анализ project-level конфигурации Gemini CLI (Google)
  по критериям C1–C8. Часть исследования agent-capabilities-map.
relates:
  - docs/researches/agent-capabilities-map/RESEARCH.md
---

# Gemini CLI (Google)

Критерии оценки — см. `docs/researches/agent-capabilities-map/RESEARCH.md` § Критерии оценки.

## Общая характеристика

Gemini CLI — open-source CLI-агент от Google (`google-gemini/gemini-cli` на GitHub).
Использует модели Gemini (Pro, Flash). Контекстное окно до 1M токенов.
Более миллиона разработчиков по состоянию на начало 2026.

## C1. Конфигурационная модель

Project-level каталог `.gemini/` с JSON-конфигурацией:

```text
project-root/
├── GEMINI.md                    # Project context (git-tracked)
└── .gemini/
    ├── settings.json            # Project settings (git-tracked)
    ├── commands/                # Custom slash commands
    │   └── *.toml
    ├── skills/                  # Agent skills
    │   └── <name>/SKILL.md
    ├── agents/                  # Sub-agents (experimental)
    │   └── *.md
    └── sandbox.Dockerfile       # Custom sandbox image
```

Расширения (extensions) устанавливаются в `~/.gemini/extensions/` и могут содержать
commands, skills, agents, MCP servers, hooks, policies и themes.

Иерархия настроек (от низшего к высшему приоритету): defaults → system defaults →
user settings → project settings → system settings → env vars → CLI args.

## C2. Инструкции агенту

Основной файл — `GEMINI.md` (имя конфигурируемо через `context.fileName`).
Иерархическая загрузка:

1. `~/.gemini/GEMINI.md` — глобальный контекст.
2. Ancestor directories — от текущей директории к корню проекта.
3. Subdirectories — сканирование подкаталогов (лимит — 200, конфигурируемо).

Поддержка импорта через `@path/to/file.md` синтаксис для модуляризации.
Команды `/memory show` и `/memory refresh` для управления загруженным контекстом.
Команда `/init` для генерации начального `GEMINI.md`.

## C3. Команды

Пользовательские slash-команды определяются как TOML-файлы:

- **Project-level**: `.gemini/commands/*.toml`.
- **Extension-level**: `extensions/<name>/commands/*.toml`.
- **Nested**: вложенные каталоги определяют namespace (`commands/gcs/sync.toml` → `/gcs:sync`).

Приоритет: project commands > user commands > extension commands (при конфликте
extension command получает префикс `/extension-name.command-name`).

## C4. Навыки (Skills)

Принят формат SKILL.md, совместимый с Claude Code и Codex CLI:

```text
.gemini/skills/<name>/SKILL.md
.agents/skills/<name>/SKILL.md    # cross-agent portable path
~/.gemini/skills/<name>/SKILL.md  # personal
```

Lazy-loading: при старте загружаются только `name` и `description` из frontmatter.
Полные инструкции загружаются в контекст только при активации (`activate_skill` tool).
Это экономит токены и улучшает точность ответов.

Skills также могут быть частью extensions, устанавливаемых через
`gemini extensions install`.

## C5. Суб-агенты

Статус: **экспериментальный (preview)**. Определяются в `.gemini/agents/*.md`:

```yaml
---
name: security-reviewer
description: Reviews code for security issues
model: gemini-2.5-pro
tools:
  - read_file
  - search_code
  - mcp_* # wildcard: all MCP tools
---
System prompt for the agent...
```

Поддержка wildcard-синтаксиса для tools (`*`, `mcp_*`, `mcp_server-name_*`).
Вызов через `@agent-name` синтаксис или автоматическая делегация.

## C6. MCP-интеграция

Конфигурируется в `.gemini/settings.json` под ключом `mcpServers`:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": { "API_KEY": "..." },
      "trust": true,
      "includeTools": ["tool1"],
      "excludeTools": ["tool2"],
      "timeout": 30000
    }
  }
}
```

Поддерживает stdio, SSE (`url`), и HTTP streaming (`httpUrl`) транспорты.
Фильтрация инструментов через `includeTools`/`excludeTools`. Опция `trust`
для bypass подтверждений.

## C7. Расширяемость

**Extensions** — ключевое отличие Gemini CLI. Каждый extension — пакет
с `gemini-extension.json`, объединяющий commands, MCP servers, context,
skills, agents, hooks, policies и themes.

Установка: `gemini extensions install <github-url>`. Более 70 extensions доступны
в галерее, включая интеграции от Figma, Shopify, Stripe и других.

Variable substitution: `${extensionPath}`, `${workspacePath}`, `${/}`.

## C8. Зрелость экосистемы

Open-source (GitHub: `google-gemini/gemini-cli`). Активная экосистема extensions.
Бесплатный tier с Google аккаунтом. Суб-агенты в статусе preview — API может измениться.
Gemini CLI v0.23.0 (январь 2026) — обновлённый формат settings.json.

## Плюсы

- Наиболее развитая система extensions — модульные пакеты с commands, MCP, skills,
  agents, hooks, policies и themes.
- Конфигурируемое имя файла инструкций (`context.fileName`) — гибкость адаптации.
- Импорт-синтаксис (`@path/to/file.md`) для модуляризации контекста.
- Lazy-loading skills — оптимизация расхода токенов.
- Бесплатный tier и наибольшее контекстное окно (1M токенов).

## Минусы

- Суб-агенты в статусе **experimental/preview** — API нестабилен.
- Проприетарное имя файла инструкций (`GEMINI.md`) вместо стандарта `AGENTS.md`.
- Команды в формате TOML, а не Markdown — несовместимы с Claude Code/Codex CLI.
- Extensions — только на уровне пользователя (`~/.gemini/extensions/`),
  нет project-level extensions.
- Сложность настройки для Google Workspace аккаунтов (GCP, API keys).

## Источники

- [Gemini CLI — Configuration](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html)
- [Gemini CLI — Extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/)
- [Gemini CLI — Agent Skills](https://geminicli.com/docs/cli/skills/)
- [Gemini CLI — Subagents (experimental)](https://geminicli.com/docs/core/subagents/)
