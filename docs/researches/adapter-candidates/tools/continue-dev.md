---
type: research
summary: Анализ Continue Dev как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации Continue Dev
  (VS Code / JetBrains extension) по критериям C1-C10.
  Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# Continue Dev

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

Continue --- open-source AI code assistant (VS Code, JetBrains, CLI `cn`).
Multi-provider (OpenAI, Anthropic, Azure, Mistral и др.). Конфигурация через
`config.yaml` (предпочтительный формат) или `config.json` (legacy). Hub-based
система правил и промптов.

## C1. Instructions

Нет единого файла инструкций (AGENTS.md, CLAUDE.md и т.д.).
Инструкции определяются через `rules` в `config.yaml`. Правила конкатенируются
в system message для Agent, Chat и Edit запросов. Также доступен
`chatOptions.baseSystemMessage` для переопределения system message.

## C2. Rules

Правила определяются в `config.yaml` под ключом `rules`. Каждое правило
ссылается на Hub (`uses: "sanity/sanity-opinionated"`) или локальный файл
(`uses: "file://path/to/rules.md"`). Файлы правил --- Markdown с frontmatter
(`name`). Правила конкатенируются в system message.

Project-level `.continue/` каталог не документирован как стандартный путь
для project rules.

## C3. Commands

Slash-команды через Prompt Files. Frontmatter: `invokable: true`. Ссылки
на Hub (`uses: "supabase/create-functions"`) или локальные файлы
(`uses: "file://path/to/prompts.md"`). MCP-серверы могут предоставлять
дополнительные slash-команды через MCP prompts.

## C4. Skills

Не используют формат SKILL.md. Функциональность покрывается через
combination of rules + prompt files + context providers.

## C5. Agents

Continue Agents определяются в `config.yaml`. Компоненты: models, rules,
tools (MCP servers). Модели должны поддерживать `tool_use` capability для
Agent mode. Агенты доступны через Agent selector в sidebar.

Project-level определения суб-агентов не документированы как отдельные файлы.

## C6. MCP

Конфигурируется в `config.yaml` под ключом `mcpServers` или в standalone файлах
`.continue/mcpServers/*.json`. Также: `~/.continue/mcp.json` (user-level).
Поля: `name`, `command`, `args`, `env`, `cwd`, `requestOptions`,
`connectionTimeout`. Поддержка stdio, SSE, Streamable HTTP. MCP tools доступны
только в Agent mode.

## C7. Hooks

Не документированы на уровне project-level конфигурации.

## C8. LSP

Не поддерживается как отдельная project-level конфигурация.

## C9. Other

- **Continue Hub**: централизованный реестр правил, промптов и конфигураций.
- **Context Providers**: `@`-mentions для code, docs, diff, terminal, problems,
  folder, codebase, http и др.
- **Model Roles**: разные модели для Chat, Edit, Autocomplete, Embed, Rerank.
- **Remote Config**: `remoteConfigServerUrl` для командных конфигураций.
- **CLI (`cn`)**: CLI-интерфейс с тем же `config.yaml`.
- **`config.ts`**: TypeScript для программного расширения конфигурации.
- **`permissions.yaml`**: политики доступа инструментов.

## C10. Adapter verdict

Continue Dev требует **отдельного адаптера `continue`** при достаточном спросе.
Уникальная конфигурация: `config.yaml` с Hub-ссылками, MCP в
`.continue/mcpServers/`, prompt files. Однако приоритет низкий --- Continue не
использует AGENTS.md, SKILL.md или стандартные файловые структуры. Адаптер
потребует трансляции канонического формата в `config.yaml`.

## Плюсы

- Hub-based система --- переиспользование правил и промптов из сообщества.
- Multi-provider с model roles --- гибкая конфигурация моделей.
- Context Providers --- расширяемая система контекста.
- CLI (`cn`) с тем же config --- единая конфигурация IDE и CLI.
- Remote Config для командных настроек.

## Минусы

- Не поддерживает AGENTS.md и SKILL.md стандарты.
- Project-level конфигурация не стандартизирована --- нет dot-directory.
- Rules без glob-паттернов --- нет path-specific привязки.
- MCP tools только в Agent mode --- ограничение для Chat/Edit.
- Нет hooks и project-level sub-agent definitions.

## Источники

- [Continue --- config.yaml Reference](https://docs.continue.dev/reference)
- [Continue --- Customization Overview](https://docs.continue.dev/customize/overview)
- [Continue --- Configuration](https://docs.continue.dev/customize/deep-dives/configuration)
- [Continue --- MCP](https://docs.continue.dev/customize/deep-dives/mcp)
- [Continue --- Slash Commands](https://docs.continue.dev/customize/slash-commands)
- [Continue --- GitHub](https://github.com/continuedev/continue)
