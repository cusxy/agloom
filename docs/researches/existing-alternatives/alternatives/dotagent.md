---
type: research
summary: "dotagent (agentconfig) — CLI с бидирекциональной конверсией конфигураций AI-агентов"
relates:
  - docs/researches/existing-alternatives/RESEARCH.md
---

# dotagent (agentconfig)

## Общая характеристика

dotagent — CLI и библиотека (TypeScript, MIT), созданная John Lindquist
(создатель egghead.io). Обеспечивает импорт конфигураций из любого
поддерживаемого формата в каноническую структуру `.agent/` и экспорт
обратно в 14+ agent-specific форматов.

- **GitHub**: [johnlindquist/dotagent](https://github.com/johnlindquist/dotagent)
- **npm**: `agentconfig` (v1.1.1) / `dotagent` (v2.10.0)
- **Stars**: ~120 | **Commits**: ~72

## Анализ по критериям

**C1. Scope конфигурации**: правила и инструкции. Каждое правило —
`RuleBlock` с metadata (`id`, `alwaysApply`, `scope`, `triggers`, `priority`,
`description`) и `content`. MCP, skills, commands — не покрыты.

**C2. Трансформация**: **бидирекциональная** — уникальная особенность.
Импорт парсит существующие agent-specific файлы в каноническую модель,
экспорт генерирует из канонической модели в целевые форматы. Уровень
трансформации наиболее высокий среди найденных инструментов.

**C3. Покрытие агентов**: 14+ агентов (Copilot, Cursor, Cline, Windsurf,
Zed, Codex, Aider, Claude, Gemini, Qodo, Junie, Roo, OpenCode). Все целевые
агенты Agent SDS покрыты.

**C4. Расширяемость**: программный API (`importAll`, `exportToAgent`,
`exportAll`) позволяет интеграцию в другие инструменты. Формальной
plugin-архитектуры нет.

**C5. Валидация**: TypeScript-типизация модели `RuleBlock`. Schema validation
на уровне Zod не зафиксирована.

**C6. Project-level фокус**: да. Каталог `.agent/` в корне проекта.
Поддержка private/local rules (исключаются из экспорта и version control).

**C7. Зрелость**: ранняя стадия (120 stars, 72 commits). Автор (John Lindquist)
обладает высоким авторитетом в JavaScript-сообществе. Библиотека на npm
в версии 2.10.0.

**C8. Каноническая модель**: `.agent/` как каноническая директория.
Markdown + YAML frontmatter. Бидирекциональность позволяет начать
с существующих конфигураций (import), а не с нуля.

## Плюсы

- Бидирекциональная конверсия (import + export) — уникальная возможность миграции
  с существующих конфигураций.
- Программный API для интеграции в CI/CD и другие инструменты.
- Поддержка private/local rules.
- Автор с высоким авторитетом в JavaScript-экосистеме.
- Структурированная модель правил (`RuleBlock`) с metadata.

## Минусы

- Scope ограничен правилами/инструкциями — MCP, skills, commands не покрыты.
- Нет формальной plugin-архитектуры.
- Небольшое community (120 stars).
- Нет валидации выходных файлов против agent-specific schema.

## Контекст применимости

dotagent оправдан для миграции: команды, уже имеющие конфигурации нескольких
агентов, могут импортировать их в единую модель. Не подходит для полного
управления конфигурацией (MCP, skills, agents) или для команд, начинающих
с нуля.

## Источники

- [dotagent — GitHub](https://github.com/johnlindquist/dotagent)
