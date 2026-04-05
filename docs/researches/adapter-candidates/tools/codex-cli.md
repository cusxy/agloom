---
type: research
summary: Анализ Codex CLI как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации Codex CLI (OpenAI)
  по критериям C1-C10. Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# Codex CLI (OpenAI)

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

Codex CLI --- open-source CLI-агент от OpenAI. Устанавливается через
`npm install -g @openai/codex`. Модели GPT/Codex (GPT-5-Codex, GPT-4.1).
Строгая песочница по умолчанию. TOML-конфигурация.

## C1. Instructions

Основной файл --- `AGENTS.md` в корне проекта. Альтернативное размещение ---
`.codex/AGENTS.md`. Иерархия: global (`~/.codex/AGENTS.md`) -> project.
Поддерживается `AGENTS.override.md` для переопределений. Fallback-имена
настраиваются через `project_doc_fallback_filenames` в `config.toml`.
Лимит размера --- `project_doc_max_bytes`. Walkup-поиск от CWD к корню проекта.

## C2. Rules

Каталог `.codex/rules/` содержит `.rules`-файлы с command execution policy ---
`prefix_rule()` синтаксис для определения политик выполнения команд
(allow / prompt / forbidden). Это НЕ instruction-style правила (аналог
`.claude/rules/`), а политики безопасности для sandbox. Instruction-style
правила размещаются в `AGENTS.md`. Glob-паттерны для instruction rules
отсутствуют.

## C3. Commands

Нативные project-level slash-команды отсутствуют. Встроенные команды:
`/model`, `/review`, `/diff`, `/agent`, `/tools`, `/permissions`, `/fast`,
`/status`. Пользовательские команды покрываются через Skills.

## C4. Skills

Принят формат SKILL.md. Размещение --- `.agents/skills/<name>/SKILL.md`
(cross-agent portable path). Дополнительные пути: `~/.agents/skills/` (personal),
`/etc/codex/skills/` (system). Скан по нескольким путям с приоритетом
(CWD -> parent -> repo root -> user -> admin). Включение/отключение через
`config.toml`: `[[skills.config]]`. Feature flag: `codex --enable skills`.

## C5. Agents

Определяются в `.codex/agents/*.toml` (TOML-формат). Поля: `name`,
`description`, `developer_instructions`, `model`, `sandbox_mode`,
`nickname_candidates`. Глобальные настройки: `[agents]` в `config.toml` ---
`max_threads` (6), `max_depth` (1), `job_max_runtime_seconds` (1800).
Поддержка переопределения MCP-серверов и skills на уровне агента.

## C6. MCP

Конфигурируется в `config.toml` под ключом `[mcp_servers.<name>]`. Поля:
`command`, `args`, `env`, `enabled`, `startup_timeout_sec`, `tool_timeout_sec`,
`enabled_tools`, `disabled_tools`, `required`. Фильтрация инструментов
через allow/deny списки.

## C7. Hooks

Не документированы на уровне project-level конфигурации.

## C8. LSP

Не поддерживается на уровне project-level конфигурации.

## C9. Other

- **Trust model**: project config загружается только для доверенных проектов.
- **Profiles**: `[profiles.<name>]` в config.toml, переключение через
  `codex --profile <name>`.
- **Admin requirements**: `requirements.toml` для корпоративных ограничений.
- **Feature flags**: `[features]` в config.toml.
- **Agents SDK**: Codex может работать как MCP-сервер для Agents SDK.

## C10. Adapter verdict

Codex CLI уже покрывается адаптером `agentsmd` (AGENTS.md). Однако полный
адаптер позволит транспилировать: skills (размещение в `.agents/skills/`),
agents (TOML-формат в `.codex/agents/`), MCP (TOML в `config.toml`),
command policy rules (`.codex/rules/`). Рекомендация --- **расширить адаптер
`agentsmd`**
модулями skills и agents (TOML-трансляция), либо создать отдельный адаптер
`codex` при значительном расхождении форматов.

## Плюсы

- Нативная поддержка стандарта AGENTS.md.
- Строгая trust model для безопасности project-level конфигурации.
- Granular MCP control: allow/deny списки, таймауты, required flag.
- Profiles и admin-level requirements для корпоративных сценариев.
- Cross-agent portable path `.agents/skills/`.

## Минусы

- TOML-формат для агентов --- отличается от Markdown-стандарта большинства
  инструментов.
- Отсутствие нативных project-level slash-команд.
- Отсутствие hooks и LSP конфигурации.
- Skills за feature flag --- менее зрелая система.

## Источники

- [Codex CLI --- Config basics](https://developers.openai.com/codex/config-basic)
- [Codex CLI --- Configuration Reference](https://developers.openai.com/codex/config-reference)
- [Codex CLI --- AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Codex CLI --- Subagents](https://developers.openai.com/codex/subagents)
- [Codex CLI --- Agent Skills](https://developers.openai.com/codex/skills)
- [Codex CLI --- Sample Configuration](https://developers.openai.com/codex/config-sample)
