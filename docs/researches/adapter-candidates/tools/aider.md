---
type: research
summary: Анализ Aider как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации Aider
  по критериям C1-C10. Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# Aider

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

Aider --- open-source CLI AI pair programmer. Git-native (автоматические
коммиты). Multi-provider (Claude, GPT, Gemini, DeepSeek, локальные модели).
Architect mode --- парное использование reasoning + editor моделей.
Устанавливается через `pip install aider-chat`.

## C1. Instructions

Основной файл --- `CONVENTIONS.md`, загружаемый через `--read` (read-only).
Альтернативно --- любой файл через `aider --read <file>`. Конфигурация в
`.aider.conf.yml`:

```yaml
read:
  - CONVENTIONS.md
  - docs/architecture.md
```

Иерархия: home (`~/.aider.conf.yml`) -> git root -> CWD. Файлы, загруженные
позже, имеют приоритет. Поддержка AGENTS.md --- через `read: AGENTS.md`
(без нативного auto-discovery).

## C2. Rules

Нет отдельного каталога правил. Все правила --- через read-only файлы
(CONVENTIONS.md и др.). Glob-паттерны не поддерживаются.

## C3. Commands

Встроенные in-chat команды: `/read`, `/drop`, `/add`, `/architect`, `/model`,
`/diff`, `/commit`, `/lint`, `/test` и др. Project-level пользовательские
slash-команды не поддерживаются.

## C4. Skills

Не поддерживает формат SKILL.md. Функциональность покрывается через read-only
файлы и architect mode.

## C5. Agents

Не поддерживает project-level суб-агентов. Architect mode --- двухмодельный
режим (reasoning + editor), но не суб-агент. Aider может работать как
MCP-сервер для внешних агентов.

## C6. MCP

Aider не имеет нативной MCP client конфигурации. Существуют community
MCP-серверы для Aider (`aider-mcp`), позволяющие использовать Aider как tool
из других MCP-клиентов (Claude Desktop, Cursor).

## C7. Hooks

Не документированы. Поддерживает `--lint-cmd` и `--test-cmd` для автоматического
запуска линтера/тестов после изменений --- ограниченный аналог post-edit hooks.

## C8. LSP

Не поддерживается на уровне project-level конфигурации.

## C9. Other

- **Git-native**: автоматические коммиты после каждого изменения.
- **Architect mode**: парная работа reasoning + editor модели.
- **Prompt caching**: кэширование read-only файлов для экономии токенов.
- **Repository map**: автоматическое построение карты репозитория.
- **Auto-lint / Auto-test**: `--lint-cmd`, `--test-cmd` для CI-like workflow.
- **Community conventions**: репозиторий `Aider-AI/conventions` с шаблонами.
- **Dark/light mode**: визуальные настройки CLI.
- **`.env` support**: переменные окружения через `.env` файл.

## C10. Adapter verdict

Aider **не покрывается существующими адаптерами** и имеет **минимальную
конфигурацию на уровне проекта**. Единственная возможность --- генерация
`CONVENTIONS.md` и `.aider.conf.yml`. Рекомендация --- **адаптер низкого
приоритета**. Aider не поддерживает AGENTS.md auto-discovery, SKILL.md, agents,
MCP client, hooks. Адаптер будет генерировать только `CONVENTIONS.md` с read
конфигурацией --- ROI минимален.

## Плюсы

- Git-native --- каждое изменение коммитится автоматически.
- Multi-provider с architect mode для complex reasoning.
- Prompt caching для read-only файлов.
- Repository map --- автоматический контекст структуры проекта.
- Бесплатный, open-source, минимальные зависимости.

## Минусы

- Нет AGENTS.md auto-discovery --- только через explicit `--read`.
- Нет SKILL.md, agents, MCP client, hooks.
- Нет отдельного каталога правил и glob-паттернов.
- Минимальная project-level конфигурация --- только `.aider.conf.yml`.
- Нет project-level slash-команд.

## Источники

- [Aider --- YAML config file](https://aider.chat/docs/config/aider_conf.html)
- [Aider --- Coding conventions](https://aider.chat/docs/usage/conventions.html)
- [Aider --- Configuration](https://aider.chat/docs/config.html)
- [Aider --- In-chat commands](https://aider.chat/docs/usage/commands.html)
- [Aider --- GitHub](https://github.com/Aider-AI/aider)
- [Aider-AI/conventions](https://github.com/Aider-AI/conventions)
