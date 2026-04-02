---
type: research
summary: "Symlink-based инструменты (Saddle, ai-rules-sync) — синхронизация через файловые ссылки"
relates:
  - docs/researches/existing-alternatives/RESEARCH.md
---

# Symlink-based инструменты (Saddle, ai-rules-sync)

## Общая характеристика

Категория инструментов, использующих symlinks для указания нескольких
agent-specific путей на один и тот же набор файлов. Два наиболее
зрелых представителя:

- **Saddle** ([saddle.sh](https://saddle.sh)): declarative YAML rules,
  auto-detection установленных инструментов, drift detection (`saddle --check`).
  npm: `saddle-cli` (v1.0.4, MIT).
- **ai-rules-sync** ([github.com/lbb00/ai-rules-sync](https://github.com/lbb00/ai-rules-sync)):
  symlink-sync из Git-репозиториев, multi-repo support для комбинирования
  корпоративных стандартов, community-коллекций и personal preferences.
  8 инструментов (Cursor, Claude Code, Copilot, OpenCode, Trae AI, Codex,
  Gemini CLI, Warp), v0.8.1, Unlicense.

## Анализ по критериям

**C1. Scope конфигурации**: инструкции, правила, skills (через symlinks).
Saddle покрывает agents/, commands/, skills/, configurations/, rules/.
ai-rules-sync — rules, skills, commands, subagents.

**C2. Трансформация**: **отсутствует**. Symlinks указывают на один и тот же
файл — содержимое идентично для всех агентов. Если агент A ожидает JSON,
а агент B — TOML, symlinks не решают задачу.

**C3. Покрытие агентов**: Saddle — 6 агентов (Claude Code, Codex, Copilot,
Cursor, Gemini, OpenCode). ai-rules-sync — 8 инструментов.

**C4. Расширяемость**: Saddle — добавление агента через YAML-файл
(declarative). ai-rules-sync — конфигурация в YAML.

**C5. Валидация**: Saddle — drift detection (`--check` с exit code 0/1).
Не валидирует содержимое.

**C6. Project-level фокус**: да. Оба инструмента работают с файлами
в корне проекта.

**C7. Зрелость**: Saddle — v1.0 stable. ai-rules-sync — v0.8.1.
Небольшие community.

**C8. Каноническая модель**: каноническая директория -> symlinks к целевым
путям. Простая модель, но без трансформации.

## Плюсы

- Простейшая ментальная модель: один файл -> несколько ссылок.
- Нулевые зависимости от runtime (symlinks — средство ОС).
- Saddle: drift detection для CI/CD.
- ai-rules-sync: multi-repo для корпоративных сценариев.
- Instant propagation: изменение в каноническом файле немедленно видно
  всем агентам (через symlink).

## Минусы

- **Фундаментальное ограничение**: невозможность трансформации между форматами.
  Если Claude Code ожидает `CLAUDE.md`, а Codex — `AGENTS.md` с другим
  содержимым, symlinks бесполезны.
- Symlinks ломаются при замене файла агентом (overwrite вместо edit-in-place).
- Нет валидации содержимого.
- Не решают задачу MCP-конфигурации (JSON vs TOML).
- Ограниченное community.

## Контекст применимости

Symlink-инструменты оправданы, когда все целевые агенты принимают идентичный
контент в идентичных файлах (например, `AGENTS.md` как единый стандарт).
Не подходят при наличии различий в форматах, именах файлов или структуре
конфигурации.

## Источники

- [Saddle — Official Site](https://saddle.sh)
- [ai-rules-sync — GitHub](https://github.com/lbb00/ai-rules-sync)
