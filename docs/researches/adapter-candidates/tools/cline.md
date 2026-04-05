---
type: research
summary: Анализ Cline как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации Cline (VS Code extension)
  по критериям C1-C10. Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# Cline

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

Cline --- open-source автономный coding agent (VS Code extension). Ранее
известен как "Claude Dev". Multi-provider (Claude, GPT, Gemini и др. через
собственные API-ключи). Plan/Act pipeline с явным одобрением действий.

## C1. Instructions

Не использует единый файл инструкций (AGENTS.md, CLAUDE.md и т.д.). Инструкции
определяются через Custom Instructions в Settings UI и через `.clinerules`.
Нет иерархического сканирования по директориям.

## C2. Rules

Каталог `.clinerules/` в корне проекта. Содержит `.md` и `.txt` файлы,
объединяемые в единый набор правил. Global rules --- в системной директории
Cline Rules.

**Conditional rules** через YAML frontmatter:

```yaml
---
paths:
  - "src/**/*.ts"
  - "tests/**"
---
```

Правило активируется при совпадении паттерна с файлами в контексте.
Toggle on/off для каждого правила через UI. Cline Teams --- трёхуровневая
система приоритетов (organization > user > project).

Legacy: одиночный файл `.clinerules` (plain text).

## C3. Commands

Встроенная команда `/newrule` для создания правил. Нативные project-level
пользовательские slash-команды не документированы.

## C4. Skills

Формат SKILL.md. Размещение: `.cline/skills/<name>/SKILL.md` (project),
`~/.cline/skills/` (global). Экспериментальная функция (с версии 3.49.0) ---
требует включения: **Settings -> Features -> Enable Skills**. Skills
загружаются только при необходимости (on-demand).

## C5. Agents

Subagents через `use_subagents` tool. Запускаются параллельно. Ограничения:
read-only (не могут редактировать файлы, использовать browser, MCP, вложенные
subagents). Отображаются с per-subagent stats (tool calls, tokens, cost).
Отключены по умолчанию --- включаются через **Settings -> Agent -> Subagents**.

Кастомные agent-определения на уровне проекта не документированы.

## C6. MCP

Конфигурируется через `mcp_settings.json` (не `mcp.json`). Встроенный MCP
Marketplace для установки серверов. Поддержка stdio и HTTP. Cline может
создавать и устанавливать custom MCP-серверы по запросу пользователя.

## C7. Hooks

Не документированы на уровне project-level конфигурации.

## C8. LSP

Не поддерживается на уровне project-level конфигурации.

## C9. Other

- **Memory Bank**: паттерн самодокументирующейся разработки --- Cline
  поддерживает контекст через структурированные файлы.
- **Browser automation**: встроенный инструмент для взаимодействия с браузером.
- **Plan/Act mode**: явное разделение планирования и исполнения.
- **BYO API keys**: пользователь приносит собственные ключи, оплата по
  использованию.
- **Cline Teams**: remote configuration с organization-level rules.

## C10. Adapter verdict

Cline **частично покрывается текущими адаптерами** (AGENTS.md не
поддерживается нативно). Для полного покрытия требуется **отдельный адаптер
`cline`**: rules (`.clinerules/` с frontmatter), skills (`.cline/skills/`),
MCP (`mcp_settings.json`). Адаптер средней сложности --- уникальный формат
rules с conditional paths.

## Плюсы

- Conditional rules с glob-паттернами --- гибкая привязка к файлам.
- Встроенный MCP Marketplace --- простая установка серверов.
- BYO API keys --- прозрачная модель оплаты.
- SKILL.md поддержка (экспериментальная).
- Plan/Act pipeline с явным одобрением.

## Минусы

- Не поддерживает AGENTS.md нативно --- требует собственный формат инструкций.
- Skills экспериментальные --- за feature flag.
- Subagents read-only --- не могут редактировать файлы или использовать MCP.
- Нет project-level slash-команд и hooks.
- MCP конфигурация через UI, не через файл в репозитории по умолчанию.

## Источники

- [Cline --- Rules](https://docs.cline.bot/customization/cline-rules)
- [Cline --- Subagents](https://docs.cline.bot/features/subagents)
- [Cline --- GitHub](https://github.com/cline/cline)
- [Cline --- FAQ](https://cline.bot/faq)
- [Using Skills with Cline](https://medium.com/data-science-collective/using-skills-with-cline-3acf2e289a7c)
