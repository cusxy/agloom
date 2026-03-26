---
type: research
summary: "Microsoft APM (Agent Package Manager) — менеджер зависимостей для агентных конфигураций"
relates:
  - docs/researches/existing-alternatives/RESEARCH.md
---

# Microsoft APM (Agent Package Manager)

## Общая характеристика

APM — CLI-инструмент (Python/Go, MIT) от Microsoft, позиционируемый как
менеджер зависимостей для агентных конфигураций. Аналогия с npm/pip:
`apm.yml` объявляет зависимости проекта (skills, instructions, prompts,
agents, hooks, plugins, MCP-серверы), `apm install` разрешает зависимости
транзитивно и деплоит файлы в директории целевых агентов, `apm compile`
генерирует оптимизированные выходные файлы для каждого инструмента.

- **Сайт**: [microsoft.github.io/apm](https://microsoft.github.io/apm/)
- **GitHub**: [microsoft/apm](https://github.com/microsoft/apm)
- **GitHub Action**: [microsoft/apm-action](https://github.com/microsoft/apm-action)
- **Установка**: binary (macOS/Linux/Windows), `pip install apm-cli`,
  `scoop install apm`

## Анализ по критериям

**C1. Scope конфигурации**: наиболее широкий scope среди найденных инструментов —
skills, instructions, prompts, agents, hooks, plugins, MCP-серверы. Покрывает
все аспекты агентной конфигурации, включая hooks (pre/post actions).

**C2. Трансформация**: `apm compile` генерирует оптимизированные выходные файлы
для каждого агента — `AGENTS.md` для Copilot/Cursor/Codex, `CLAUDE.md`
для Claude Code. Подход близок к трансляции, но ориентирован на Markdown-инструкции.
Structured config (JSON <-> TOML) трансформация не документирована.

**C3. Покрытие агентов**: GitHub Copilot, Claude Code, Cursor, OpenCode (4 агента).
Не покрывает Codex CLI и Gemini CLI — два из четырёх целевых агентов Agent SDS.

**C4. Расширяемость**: package registry (`apm_modules/`) с транзитивным
dependency resolution. Новые агенты требуют изменения в core (формальный
plugin API для добавления агентов не документирован).

**C5. Валидация**: lockfile (`apm.lock.yaml`) с pinning к точным коммитам.
SARIF audit report для hidden Unicode scanning. Schema validation
канонической конфигурации не документирована.

**C6. Project-level фокус**: да. `apm.yml` в корне проекта. `apm_modules/`
как аналог `node_modules/`.

**C7. Зрелость**: ранняя стадия. Под организацией Microsoft на GitHub,
но создан и поддерживается одним разработчиком (@danielmeppiel).
Запрос на поддержку Dependabot (март 2026) — индикатор зарождающегося
community. Документация на отдельном сайте.

**C8. Каноническая модель**: `apm.yml` как манифест зависимостей + пакеты
в `apm_modules/`. Модель ближе к package manager (npm), чем к transpiler.
Lockfile обеспечивает воспроизводимость.

## Плюсы

- Наиболее широкий scope конфигурации среди найденных инструментов (skills,
  agents, hooks, MCP, plugins).
- Dependency resolution с транзитивными зависимостями и lockfile — уникальная
  возможность для управления сложными деревьями зависимостей.
- `apm compile` для генерации оптимизированных файлов.
- GitHub Action для CI/CD интеграции.
- Pack & Distribute: portable артефакт без зависимости от APM/Python/сети.
- Под организацией Microsoft — потенциал роста adoption.

## Минусы

- Не покрывает Codex CLI и Gemini CLI — два из четырёх целевых агентов Agent SDS.
- Зависимость от Python (`pip install apm-cli`) — несовместимость с
  TypeScript-экосистемой Agent SDS.
- Поддерживается одним разработчиком, несмотря на Microsoft org.
- Модель package manager (установка пакетов из registry) отличается от модели
  transpiler (трансляция единого формата) — APM управляет **распределением
  пакетов**, а не **трансляцией между форматами**.
- Ранняя стадия — API и модель могут измениться.

## Контекст применимости

APM оправдан для команд, нуждающихся в dependency management для агентных
конфигураций (переиспользование skills и instructions между проектами как
npm-пакетов). Менее подходит для трансляции project-specific конфигурации
между форматами агентов. Комплементарен, но не заменяет Agent SDS: APM
решает задачу distribution пакетов, Agent SDS — трансляции канонического
формата.

## Источники

- [Microsoft APM — Official Site](https://microsoft.github.io/apm/)
- [Microsoft APM — GitHub](https://github.com/microsoft/apm)
- [Microsoft APM Action — GitHub](https://github.com/microsoft/apm-action)
