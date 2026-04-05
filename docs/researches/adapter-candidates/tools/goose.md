---
type: research
summary: Анализ Goose как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации Goose (Block)
  по критериям C1-C10. Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# Goose (Block)

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

Goose --- open-source AI agent от Block (ранее Square). CLI + Desktop (Electron).
Написан на Rust. Multi-provider (любой LLM через Ollama, Claude, GPT и др.).
Передан в Linux Foundation Agentic AI Foundation (декабрь 2025). 30K+ GitHub
stars, 350+ контрибьюторов. Бесплатный, без подписки.

## C1. Instructions

Основной файл --- `.goosehints` в корне проекта. Загружается при старте сессии.
Поддержка `.goosehints` во вложенных поддиректориях (с v1.28.0). Формат ---
plain text / Markdown. Нет поддержки AGENTS.md как основного файла.

**Persistent instructions** --- в `config.yaml`, перечитываются при каждом
взаимодействии (в отличие от `.goosehints`, загружаемого однократно).

## C2. Rules

Нет отдельного каталога правил. Все правила --- через `.goosehints` или
persistent instructions в `config.yaml`. Glob-паттерны не поддерживаются.

## C3. Commands

Нет project-level пользовательских slash-команд. Встроенные: `goose run -t`
для ad-hoc задач, `goose run -i instructions.md` для файловых инструкций.

## C4. Skills

Формат SKILL.md. Размещение: `.goose/skills/<name>/SKILL.md` (project),
`~/.agents/skills/<name>/SKILL.md` (global, рекомендуемый стандарт).
Backward compatible: `.claude/skills/`, `~/.claude/skills/`. Ресурсы skills
подгружаются по необходимости.

## C5. Agents

Unified tooling: `load(source)` для загрузки в контекст, `delegate(source)`
для запуска как суб-агента. Источники: recipes, skills, agents --- обращение
по имени. Agent definitions содержат mapped tools и model shorthand (sonnet,
opus, haiku). `delegate()` поддерживает ad-hoc задачи, фильтрацию tools,
кастомные instructions и settings.

## C6. MCP

Конфигурируется в `~/.config/goose/config.yaml` под ключом `extensions`.
Каждое расширение --- MCP-сервер с `command`, `args`, `env`, `timeout`.
Поддержка stdio. Добавление через `goose configure` -> "Add Extension".
Ограничение MCP-серверов возможно через конфигурацию.

## C7. Hooks

Не документированы на уровне project-level конфигурации.

## C8. LSP

Не поддерживается на уровне project-level конфигурации.

## C9. Other

- **Recipes**: YAML-workflows с goals, extensions, inputs, sub-recipes.
  Аналог переиспользуемых pipeline.
- **ACP providers**: интеграция с Claude Code и Codex.
- **MCP Roots**: поддержка MCP Roots protocol.
- **Permission mode**: настраиваемый уровень автономности.
- **Secure keyring**: хранение API-ключей в системном keyring.

## C10. Adapter verdict

Goose **не покрывается существующими адаптерами** (не поддерживает AGENTS.md
нативно). Для полного покрытия требуется **отдельный адаптер `goose`**:
instructions (`.goosehints`), skills (`.goose/skills/`),
MCP (`config.yaml` extensions). Средний приоритет --- уникальная экосистема
с recipes и delegate-паттерном, но ограниченная конфигурация на уровне проекта.

## Плюсы

- Полностью бесплатный и open-source (Linux Foundation).
- Multi-provider без привязки к экосистеме.
- Recipes --- мощная система переиспользуемых workflows.
- SKILL.md поддержка с backward compatibility (.claude/skills/).
- Unified delegate() для sub-agents с фильтрацией tools.

## Минусы

- `.goosehints` --- проприетарный формат, не AGENTS.md.
- Нет отдельного каталога правил и glob-паттернов.
- MCP конфигурация в global config, не на уровне проекта.
- Нет project-level slash-команд и hooks.
- Security concern: prompt injection через recipes (Operation Pale Fire, 2026).

## Источники

- [Goose --- GitHub](https://github.com/block/goose)
- [Goose --- Configuration](https://block.github.io/goose/docs/configuration/)
- [Goose --- Using Skills](https://block.github.io/goose/docs/guides/context-engineering/using-skills/)
- [Goose --- Recipes (PulseMCP)](https://www.pulsemcp.com/building-agents-with-goose/part-4-configure-your-agent-with-goose-recipes)
- [Block introduces Goose](https://block.xyz/inside/block-open-source-introduces-codename-goose)
- [Goose with Docker](https://www.docker.com/blog/building-ai-agents-with-goose-and-docker/)
