---
type: research
summary: "chezmoi — dotfiles-менеджер как потенциальная основа для управления конфигурациями AI-агентов"
relates:
  - docs/researches/existing-alternatives/RESEARCH.md
---

# chezmoi (dotfiles manager как основа)

## Общая характеристика

chezmoi — наиболее популярный dotfiles-менеджер (Go, MIT). Управляет файлами
через Go text templates с поддержкой шифрования (age/GPG), условной логики
по ОС/hostname, автоматического коммита и push в git.

- **Сайт**: [chezmoi.io](https://www.chezmoi.io/)
- **GitHub**: [twpayne/chezmoi](https://github.com/twpayne/chezmoi)
- **Stars**: ~18 500

Ряд разработчиков адаптировали chezmoi для управления конфигурациями
AI-агентов. Документированные кейсы: генерация MCP-конфигураций из единого
`servers.yaml`, синхронизация `CLAUDE.md`/`AGENTS.md` между машинами,
шифрование API-ключей.

## Анализ по критериям

**C1. Scope конфигурации**: любые файлы (chezmoi — generic инструмент).
Для AI-конфигураций покрывает инструкции, MCP, settings через шаблонизацию.
Не имеет семантического понимания агентных конфигураций.

**C2. Трансформация**: Go text templates позволяют генерировать разные
форматы из одного источника. Теоретически возможна полная трансформация
(JSON -> TOML -> YAML). На практике требует ручного написания шаблонов
для каждого формата и агента.

**C3. Покрытие агентов**: не ограничено — chezmoi управляет произвольными
файлами. Но каждый агент требует ручного создания шаблона.

**C4. Расширяемость**: через Go text templates и external tool вызовы.
Нет agent-specific плагинов.

**C5. Валидация**: нет. chezmoi проверяет корректность шаблонов, но не
валидирует содержимое как agent config.

**C6. Project-level фокус**: **нет**. chezmoi спроектирован для глобальных
dotfiles (`~/.config/`, `~/.claude/`). Использование для project-level
конфигурации — anti-pattern: chezmoi управляет home directory, а не
файлами внутри git-репозитория.

**C7. Зрелость**: высокая (~18 500 stars, годы разработки, обширная
документация). Однако зрелость относится к dotfiles management,
а не к agent config management.

**C8. Каноническая модель**: chezmoi source directory как единый
источник истины. Детерминированная генерация через шаблоны.

## Плюсы

- Наиболее зрелый generic инструмент для управления конфигурациями.
- Go text templates — мощный механизм условной генерации.
- Встроенное шифрование для API-ключей и чувствительных данных.
- Документированные кейсы использования для AI-агентов.
- Cross-machine синхронизация через git.

## Минусы

- **Нет project-level фокуса**: спроектирован для home directory, не для
  файлов внутри проекта. Agloom работает на уровне проекта.
- Нет семантического понимания агентных конфигураций — оперирует файлами,
  а не правилами, skills, командами.
- Каждый агент требует ручного написания Go-шаблона — высокая стоимость
  начальной настройки и поддержки.
- Go text templates — менее знакомы целевой аудитории (TypeScript-разработчики),
  чем Markdown или TypeScript.
- Не решает задачу дистрибуции конфигураций в проект — решает задачу
  синхронизации dotfiles между машинами.

## Контекст применимости

chezmoi оправдан для синхронизации глобальных настроек AI-агентов
(`~/.claude/`, `~/.codex/`) между машинами разработчика. Не подходит
как основа для project-level конфигурации внутри репозитория.

## Источники

- [chezmoi — Official Site](https://www.chezmoi.io/)
- [One Skills Brain with chezmoi (DEV Community)](https://dev.to/dotwee/one-skills-brain-for-codex-claude-cursor-and-copilot-with-chezmoi-2p3k)
- [Sync Claude Code with chezmoi and age](https://www.arun.blog/sync-claude-code-with-chezmoi-and-age/)
- [Dotfiles: Taming AI Coding Agents (Dr. Mowinckel)](https://drmowinckels.io/blog/2026/dotfiles-coding-agents/)
- [Dotfiles for AI-Assisted Development (Dylan Bochman)](https://dylanbochman.com/blog/2026-01-25-dotfiles-for-ai-assisted-development/)
