---
type: research
summary: Анализ KiloCode как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации KiloCode (VS Code / CLI)
  по критериям C1-C10. Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# KiloCode

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

KiloCode --- open-source agentic engineering platform (VS Code extension + CLI).
Форк OpenCode с расширениями. 1.5M+ пользователей, 25T+ обработанных токенов.
Multi-provider (любой провайдер через OpenRouter). Конфигурация --- JSONC.

## C1. Instructions

Использует `AGENTS.md` (через OpenCode-совместимость). Файл в корне проекта.
Иерархия: global -> project. Поддерживает `kilo.jsonc` для дополнительных
инструкций через ключ `instructions`. Миграция с `opencode.json` поддерживается.

## C2. Rules

Каталог `.kilo/rules/` содержит `.md`-файлы. Global rules --- через ключ
`instructions` в `~/.config/kilo/kilo.jsonc`. Legacy: `.kilocode/rules/`
(backward compatible).

**Mode-specific rules** (`.kilo/rules-code/`, `.kilo/rules-architect/`) ---
загружаются для всех агентов вместо активного (known bug). Список режимов
захардкожен (`code`, `architect`, `ask`, `debug`, `orchestrator`).

## C3. Commands

Не документированы как отдельная система project-level slash-команд.
Workflows доступны как repeatable prompt templates в UI.

## C4. Skills

Формат SKILL.md. Размещение: `.kilo/skills/<name>/SKILL.md` (project),
`~/.kilo/skills/` (global). Legacy: `.kilocode/skills/`. Дополнительные
пути и remote URLs через `skills.paths` и `skills.urls` в `kilo.jsonc`.
Все skills загружаются в общий пул --- агент выбирает по описанию.

## C5. Agents

Определяются через Settings UI или Markdown-файлы. Имя файла (без `.md`) ---
имя агента. Вложенные директории создают namespace
(`agents/backend/sql.md` -> `backend/sql`).

**Permissions**: `allow`, `deny`, `ask` для типов: `read`, `edit`, `bash`,
`glob`, `grep`, `list`, `task`, `webfetch`, `websearch`, `codesearch` и др.
Modes (code, architect, ask, debug, orchestrator) определяют группы
инструментов.

## C6. MCP

Конфигурируется в `kilo.jsonc` под ключом `mcp`. Формат:
`{ "server-name": { "type": "local", "command": [...], "environment": {...}, "enabled": true, "timeout": 10000 } }`.
Marketplace для поиска MCP-серверов. Permissions: `{server}_{tool}`.
Default timeout: 10s (local), 15s (remote).

## C7. Hooks

Не документированы на уровне project-level конфигурации.

## C8. LSP

Не поддерживается на уровне project-level конфигурации.

## C9. Other

- **Custom Modes**: Plan (Architect), Code (Coder), Debug (Debugger),
  пользовательские --- через Settings UI или YAML.
- **Autocomplete**: FIM-based Codestral.
- **PR import**: импорт Pull Request для code review.
- **Multi-model comparison**: сравнение ответов разных моделей.
- **Migration**: автоматическая миграция с `.kilocodemodes`, `custom_modes.yaml`,
  `opencode.json`.

## C10. Adapter verdict

KiloCode **частично покрывается адаптером `agentsmd`** (AGENTS.md). Для полного
покрытия требуется адаптер, транспилирующий: rules (`.kilo/rules/`),
skills (`.kilo/skills/`), agents (Markdown), MCP (`kilo.jsonc`). Учитывая
происхождение от OpenCode, рекомендация --- **расширить существующий адаптер
`opencode`** для поддержки `.kilo/` путей и `kilo.jsonc`, либо создать
отдельный адаптер `kilo`.

## Плюсы

- Нативная поддержка AGENTS.md и SKILL.md.
- Multi-provider --- работает с любым LLM.
- Развитая система permissions для agents/modes.
- Remote skills через URLs --- удобно для распределённых команд.
- Автоматическая миграция с OpenCode и legacy-форматов.

## Минусы

- Mode-specific rules загружаются для всех агентов (known bug).
- Список режимов для rules захардкожен --- кастомные режимы игнорируются.
- Нет нативных project-level slash-команд.
- Конфигурация MCP через CLI добавляется в `opencode.jsonc` вместо `kilo.jsonc`
  (known issue).
- Отсутствие hooks и LSP конфигурации.

## Источники

- [KiloCode --- Custom Rules](https://kilo.ai/docs/customize/custom-rules)
- [KiloCode --- Custom Modes](https://kilo.ai/docs/customize/custom-modes)
- [KiloCode --- Skills](https://kilo.ai/docs/customize/skills)
- [KiloCode --- MCP](https://kilo.ai/docs/automate/mcp/using-in-kilo-code)
- [KiloCode --- Settings](https://kilo.ai/docs/getting-started/settings)
- [KiloCode --- GitHub](https://github.com/Kilo-Org/kilocode)
