---
type: research
summary: Анализ GitHub Copilot как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации GitHub Copilot
  по критериям C1-C10. Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# GitHub Copilot (Microsoft/GitHub)

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

GitHub Copilot --- AI-ассистент от GitHub/Microsoft. Доступен как расширение
для VS Code, JetBrains, Visual Studio, Eclipse, Xcode и как cloud agent на
GitHub.com. Проприетарный, требует подписку (Individual, Business, Enterprise).
Поддерживает несколько AI-моделей (GPT-4o, Claude, Gemini).

## C1. Instructions

Многоуровневая иерархия:

1. **Personal** --- настройки пользователя в IDE/GitHub.com (высший приоритет).
2. **Organization** --- инструкции администратора (Business/Enterprise). GA с
   апреля 2026.
3. **Repository** --- `.github/copilot-instructions.md` (Markdown).
4. **Path-specific** --- `.github/instructions/*.instructions.md` с
   `applyTo` frontmatter (glob-паттерны).
5. **AGENTS.md** --- в корне или вложенных директориях. Ближайший файл
   в дереве имеет приоритет. Поддерживает `CLAUDE.md` и `GEMINI.md`.

Все уровни комбинируются, не заменяют друг друга.

## C2. Rules

Path-specific instructions (`.github/instructions/*.instructions.md`) ---
аналог модульных правил. YAML frontmatter:

```yaml
---
applyTo: "**/*.ts,**/*.tsx"
excludeAgent: "code-review"
---
```

Поддержка glob-паттернов и фильтрации по агентам (`excludeAgent`).
Организационные правила --- через GitHub.com admin panel.

## C3. Commands

Chat modes (`.github/chatmodes/*.chatmode.md`) --- аналог slash-команд.
Определяют persona, instructions и tools. Встроенные: chat, edit, agent.
Пользовательские --- Markdown-файлы с YAML frontmatter.

## C4. Skills

Не используют формат SKILL.md. Copilot использует собственную систему
"skills" как встроенные capabilities (code search, web search, terminal, etc.).
Agent profiles (`.agent.md`) могут выполнять аналогичную роль, но не совместимы
с SKILL.md стандартом.

## C5. Agents

Custom agents определяются в `.github/agents/*.agent.md`. YAML frontmatter:
`name`, `description`, `model`, `tools`, `target` (`vscode`/`github-copilot`),
`disable-model-invocation`, `user-invocable`. MCP-серверы --- через
`mcp-servers` в frontmatter. Tool aliases: `execute`, `read`, `edit`, `search`,
`agent`, `web`, `todo`. Промпт --- до 30 000 символов.

Out-of-box MCP-серверы: `github` (read-only), `playwright`.

## C6. MCP

**Repository-level**: конфигурируется через GitHub.com repository settings
(copilot environment). **Agent-level**: через `mcp-servers` в `.agent.md`
frontmatter. Поддержка `${{ secrets.NAME }}` и `${{ vars.NAME }}` для
переменных. Транспорт: local stdio.

## C7. Hooks

Agent hooks доступны в preview (JetBrains, март 2026). Детали формата
project-level конфигурации не полностью документированы.

## C8. LSP

Не поддерживается на уровне project-level конфигурации.

## C9. Other

- **Cloud agent**: автономный агент на GitHub.com (назначение issues, PR).
- **Code review**: AI-ревью PR через Copilot.
- **Auto-approve MCP**: автоматическое одобрение MCP-вызовов.
- **Organization instructions**: централизованные инструкции (GA, апрель 2026).
- **`/init`**: генерация `copilot-instructions.md`.
- **`/memory`**: управление instruction files.
- **Multi-IDE**: VS Code, JetBrains, Visual Studio, Eclipse, Xcode.

## C10. Adapter verdict

GitHub Copilot требует **отдельного адаптера `copilot`**. Уникальная файловая
структура (`.github/`), собственный формат instructions и agents. Компоненты:
instructions (`copilot-instructions.md`, `*.instructions.md`), agents
(`.agent.md`), chatmodes (`.chatmode.md`). AGENTS.md поддерживается как
дополнение, но основная конфигурация --- проприетарная.

## Плюсы

- Наиболее гранулярная система инструкций: repository + path-specific +
  organization + personal.
- Glob-паттерны в path-specific instructions с `excludeAgent`.
- Cloud agent с поддержкой Issues и PR на GitHub.com.
- Multi-IDE и multi-model поддержка.
- Автоматическая генерация instructions через `/init`.

## Минусы

- Проприетарный формат --- `.github/copilot-instructions.md` и `.agent.md`
  не совместимы с другими инструментами.
- Не поддерживает SKILL.md стандарт.
- Платная подписка без бесплатного tier для agent mode.
- MCP конфигурация привязана к GitHub.com secrets/variables ---
  не портабельна.
- Agent hooks в preview --- API нестабилен.

## Источники

- [Adding custom instructions](https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
- [Custom agents configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration)
- [Creating custom agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents)
- [Enhancing agent mode with MCP](https://docs.github.com/en/copilot/tutorials/enhance-agent-mode-with-mcp)
- [AGENTS.md support](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/)
- [JetBrains agentic improvements](https://github.blog/changelog/2026-03-11-major-agentic-capabilities-improvements-in-github-copilot-for-jetbrains-ides/)
