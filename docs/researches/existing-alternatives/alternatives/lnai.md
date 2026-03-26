---
type: research
summary: "LNAI — CLI с TypeScript/Zod-определениями для type-safe синхронизации конфигураций AI-агентов"
relates:
  - docs/researches/existing-alternatives/RESEARCH.md
---

# LNAI

## Общая характеристика

LNAI — CLI-инструмент (TypeScript), определяющий конфигурации AI-агентов
в TypeScript с валидацией через Zod. Каталог `.ai/` содержит канонические
определения, команда `lnai sync` генерирует native-файлы для каждого агента.

- **Сайт**: [lnai.sh](https://lnai.sh/)
- **GitHub**: [KrystianJonca/lnai](https://github.com/KrystianJonca/lnai)
- **Hacker News**: [обсуждение (февраль 2026)](https://news.ycombinator.com/item?id=46868318)

## Анализ по критериям

**C1. Scope конфигурации**: инструкции, правила. Scope ограничен текстовым
контентом (Markdown-инструкции). MCP, commands, agents — не документированы
как поддерживаемые.

**C2. Трансформация**: генерирует файлы из TypeScript-определений. Каноническое
определение (`defineContext()`) преобразуется в agent-specific форматы.
Уровень трансформации выше, чем у Ruler (TypeScript -> Markdown), но ограничен
инструкциями.

**C3. Покрытие агентов**: Claude Code, Codex CLI, Cursor, Gemini CLI, OpenCode,
Windsurf, GitHub Copilot (7+ агентов). Все целевые агенты Agent SDS покрыты.

**C4. Расширяемость**: заявлена plugin-архитектура для добавления новых
инструментов. Зрелость plugin API не установлена.

**C5. Валидация**: Zod schema validation — ключевое отличие. Ошибки
в конфигурации обнаруживаются до генерации выходных файлов.

**C6. Project-level фокус**: да. Каталог `.ai/` в корне проекта.

**C7. Зрелость**: ранняя стадия. Проект молодой, community небольшое.
Попадание на главную страницу Hacker News (февраль 2026) — индикатор
интереса, но не зрелости.

**C8. Каноническая модель**: TypeScript-файлы в `.ai/` как источник истины.
Детерминированная генерация с автоматической очисткой orphaned-файлов.

## Плюсы

- Zod-валидация — единственный инструмент с type-safe каноническим форматом.
- Plugin-архитектура (заявлена) для расширения поддержки агентов.
- Автоматическая очистка orphaned-файлов при изменении конфигурации.
- TypeScript как каноническое определение — знакомый язык для целевой аудитории.

## Минусы

- Ранняя стадия разработки — небольшое community, незрелая документация.
- Scope ограничен инструкциями — MCP, skills, commands, agents как отдельные
  сущности не документированы.
- Зависимость от Node.js/TypeScript runtime для определения конфигурации.
- Зрелость plugin API не подтверждена.

## Контекст применимости

LNAI оправдан для TypeScript-команд, которым важна type-safety конфигурации
и готовых инвестировать в TypeScript-определения. Не подходит для команд,
не использующих Node.js, или при необходимости покрытия полного scope
конфигурации (MCP, skills, agents).

## Источники

- [LNAI — Official Site](https://lnai.sh/)
- [LNAI — GitHub](https://github.com/KrystianJonca/lnai)
- [LNAI — Hacker News Discussion](https://news.ycombinator.com/item?id=46868318)
