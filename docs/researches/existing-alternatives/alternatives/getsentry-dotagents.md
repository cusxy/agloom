---
type: research
summary: "getsentry/dotagents — CLI от Sentry для воспроизводимого управления skills и MCP-конфигурациями"
relates:
  - docs/researches/existing-alternatives/RESEARCH.md
---

# getsentry/dotagents

## Общая характеристика

dotagents — CLI-инструмент от Sentry (TypeScript, npm: `@sentry/dotagents`).
Использует `agents.toml` как манифест конфигурации и `agents.lock` с SHA-256
integrity hashes для воспроизводимых установок. Устанавливает skills из
Git-репозиториев, генерирует MCP и hook конфигурации для каждого агента.

- **Сайт**: [dotagents.sentry.dev](https://dotagents.sentry.dev/)
- **Документация**: [docs.sentry.io/ai/dotagents](https://docs.sentry.io/ai/dotagents/)
- **GitHub**: [getsentry/dotagents](https://github.com/getsentry/dotagents)

## Анализ по критериям

**C1. Scope конфигурации**: skills, MCP-серверы, hooks. Skill sources —
Git-репозитории (GitHub, GitLab, произвольные хосты) и локальные пути.
Instructions — через SKILL.md. Slash commands и sub-agents — не документированы
как отдельные сущности.

**C2. Трансформация**: symlinks из `.agents/skills/` в agent-specific директории.
MCP и hook конфигурации генерируются в формате каждого агента. Уровень
трансформации промежуточный: skills — symlinks, MCP/hooks — генерация.

**C3. Покрытие агентов**: Claude Code, Cursor, Codex CLI, VS Code, OpenCode,
Pi (6 агентов). Gemini CLI не упомянут в документации.

**C4. Расширяемость**: конфигурация агентов через `agents` field в
`agents.toml`. Формального plugin API нет.

**C5. Валидация**: `agents.lock` с SHA-256 integrity hashes. `--frozen` flag
для CI (гарантирует идентичность установок). Не валидирует семантику
конфигурации.

**C6. Project-level фокус**: да. `agents.toml` в корне проекта.

**C7. Зрелость**: поддерживается Sentry (established company). Документация
на docs.sentry.io. Skills на AgentSkills.so и LobeHub. Конкретные данные
по stars/downloads не установлены.

**C8. Каноническая модель**: `agents.toml` как манифест + `agents.lock`
как lockfile. Модель ближе к package manager (skills из Git repos)
с элементами config generation (MCP, hooks).

## Плюсы

- Поддержка Sentry — established company с ресурсами и community.
- SHA-256 integrity + lockfile — наиболее надёжная модель воспроизводимости
  среди найденных инструментов.
- `--frozen` mode для CI/CD — детерминированные установки.
- Генерация MCP и hook конфигураций для каждого агента.
- Multi-source skills (GitHub, GitLab, local, pinned refs).

## Минусы

- Gemini CLI не поддерживается — один из целевых агентов Agent SDS.
- Scope ограничен skills + MCP + hooks. Slash commands и settings
  не покрыты.
- Модель package manager для skills — не решает задачу трансляции
  project-specific инструкций и команд.
- Skills деплоятся через symlinks — ограничение для агентов, не следующих
  symlinks.

## Контекст применимости

getsentry/dotagents оправдан для команд, использующих Sentry-экосистему
и нуждающихся в воспроизводимом управлении skills с integrity verification.
Не подходит для полной трансляции канонической конфигурации между форматами
агентов. Комплементарен Agent SDS: dotagents управляет внешними skills,
Agent SDS — трансляцией проектной конфигурации.

## Источники

- [getsentry/dotagents — GitHub](https://github.com/getsentry/dotagents)
- [getsentry/dotagents — Documentation](https://docs.sentry.io/ai/dotagents/)
- [getsentry/dotagents — Site](https://dotagents.sentry.dev/)
