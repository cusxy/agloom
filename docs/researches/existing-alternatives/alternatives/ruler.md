---
type: research
summary: "Ruler — CLI для синхронизации инструкций AI-агентов через конкатенацию Markdown"
relates:
  - docs/researches/existing-alternatives/RESEARCH.md
---

# Ruler

## Общая характеристика

Ruler — CLI-инструмент (TypeScript, MIT), разработанный Eleanor Berger
(@intellectronica). Хранит инструкции в каталоге `.ruler/` как Markdown-файлы,
конфигурация агентов — в `ruler.toml`. Команда `ruler apply` генерирует
agent-specific файлы конфигурации для 30+ AI-агентов.

- **GitHub**: [intellectronica/ruler](https://github.com/intellectronica/ruler)
- **npm**: `@intellectronica/ruler`
- **Версия**: v0.2.10 (Beta Research Preview)
- **Stars**: ~2 500 | **Forks**: ~134 | **Commits**: ~830

## Анализ по критериям

**C1. Scope конфигурации**: инструкции (rules), skills (SKILL.md), MCP-серверы
(propagation). Команды и суб-агенты — частично (через skills). Не покрывает
agent-specific settings (JSON/TOML конфиги).

**C2. Трансформация**: конкатенация Markdown-файлов и запись по целевым путям.
Трансформация между форматами (JSON -> TOML) отсутствует — контент остаётся
Markdown. MCP-конфигурация пропагируется в формате каждого агента (JSON, TOML),
но scope ограничен.

**C3. Покрытие агентов**: 30+ агентов, включая все целевые Agent SDS
(Claude Code, Codex CLI, Gemini CLI, OpenCode). Наибольшее покрытие
среди всех найденных инструментов.

**C4. Расширяемость**: новые агенты добавляются через `ruler.toml` (declarative
config). Формального plugin API нет — добавление нового формата требует
изменения исходного кода.

**C5. Валидация**: отсутствует. Ruler не проверяет, что сгенерированные файлы
корректны для целевого агента.

**C6. Project-level фокус**: да. Каталог `.ruler/` размещается в корне проекта.
Поддержка вложенных `.ruler/` для монорепозиториев.

**C7. Зрелость**: наиболее зрелый инструмент в категории (2 500 stars).
Статус «Beta Research Preview» указывает на незавершённость API. Активное
развитие (830+ commits).

**C8. Каноническая модель**: `.ruler/AGENTS.md` + `.ruler/ruler.toml`
как источник истины. Генерация детерминирована, но ограничена конкатенацией.

## Плюсы

- Наибольшее покрытие агентов (30+) среди всех найденных инструментов.
- Простая ментальная модель: Markdown-файлы + TOML-конфигурация -> `ruler apply`.
- Поддержка MCP server propagation и skills.
- `.gitignore` automation для сгенерированных файлов.
- Активное развитие и растущее сообщество.

## Минусы

- Конкатенация Markdown, а не семантическая трансляция — не различает структуру
  инструкций, команд и агентов как отдельные сущности.
- Не покрывает agent-specific settings (JSON/TOML конфиги типа `settings.json`,
  `config.toml`).
- Нет plugin API — добавление нового формата требует PR в репозиторий.
- Нет валидации выходных файлов.
- Статус «Beta Research Preview» — API может измениться.

## Контекст применимости

Ruler оправдан для команд, которым достаточно синхронизировать текстовые
инструкции и skills между агентами. Не подходит, когда требуется трансформация
между структурированными форматами (JSON <-> TOML) или валидация выходных файлов.

## Источники

- [Ruler — GitHub](https://github.com/intellectronica/ruler)
- [Ruler — npm](https://www.npmjs.com/package/@intellectronica/ruler)
- [Ruler — Unified Configuration Management (Medium)](https://addozhang.medium.com/ruler-unified-configuration-management-for-multiple-ai-coding-assistants-247df7d4754a)
