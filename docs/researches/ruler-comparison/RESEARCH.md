---
type: research
summary: >-
  Сравнительный анализ возможностей Ruler и Agloom: клиентский API,
  архитектура, расширяемость, рекомендации по заимствованию.
description: >-
  Систематическое сравнение 12 возможностей Ruler (централизованное
  управление правилами, 31+ агент, MCP propagation, nested rules, skills,
  конфигурация, CLI, gitignore, dry-run, revert, global config,
  concatenation markers) с аналогами в Agloom. Для каждой возможности
  описана реализация в обоих проектах, ключевые различия, рекомендации
  по заимствованию.
relates:
  - docs/researches/existing-alternatives/RESEARCH.md
---

# Исследование: сравнение возможностей Ruler и Agloom

Дата: 2026-04-12

## Контекст исследования

### Проблема

Ruler и Agloom решают одну задачу -- централизованное управление
инструкциями для AI-агентов с генерацией agent-specific файлов. Ruler
набирает популярность и поддерживает 31+ агент. Необходимо систематическое
сравнение для выявления gaps в Agloom и возможностей для заимствования.

### Цель

Для каждой возможности Ruler определить: (1) как реализовано в Ruler,
(2) есть ли аналог в Agloom, (3) стоит ли перенимать.

### Границы

Сравниваются только возможности, присутствующие в Ruler. Возможности,
уникальные для Agloom (plugin system, переменные, per-agent content
filtering, overlays), не являются объектами анализа. Анализ основан
на исходном коде обоих проектов (апрель 2026).

## Критерии оценки

| #   | Критерий           | Описание                                                 |
| --- | ------------------ | -------------------------------------------------------- |
| K1  | Полнота покрытия   | Насколько полно возможность реализована в каждом проекте |
| K2  | DX клиентского API | Удобство конфигурации и CLI для конечного пользователя   |
| K3  | Расширяемость      | Сложность добавления нового агента / возможности         |
| K4  | Maintainability    | Объём кода, дублирование, сложность поддержки            |
| K5  | Релевантность      | Насколько возможность нужна пользователям Agloom         |

## Объекты анализа (12 возможностей)

Возможности сгруппированы в пять категорий. Детальный анализ каждой
группы -- в per-object файлах.

### Группа A: Контент и правила

- **(1) Централизованное управление правилами** -- `.ruler/` vs `.agloom/`
- **(2) Concatenation markers** -- `<!-- Source: path -->` vs frontmatter + agent comments
- **(3) Nested Rule Loading** -- вложенные `.ruler/` для монорепо vs отсутствует

Детали: [capabilities/content-and-rules.md](capabilities/content-and-rules.md)

### Группа B: Агенты и расширяемость

- **(4) Поддержка агентов** -- 31+ vs 6
- **(5) Расширяемость** -- IAgent + strategy vs adapter registry

Детали: [capabilities/agents-and-extensibility.md](capabilities/agents-and-extensibility.md)

### Группа C: MCP Server Propagation

- **(6) MCP Server Propagation** -- фильтрация по capabilities vs канонический YAML

Детали: [capabilities/mcp.md](capabilities/mcp.md)

### Группа D: Skills

- **(7) Skills Support** -- копирование директорий vs skills transpiler

Детали: [capabilities/skills.md](capabilities/skills.md)

### Группа E: CLI и инфраструктура

- **(8) Конфигурация** -- `ruler.toml` (TOML) vs `config.yml` (YAML)
- **(9) CLI команды** -- init/apply/revert vs transpile/init/clean
- **(10) Gitignore автоматизация** -- managed block vs отсутствует
- **(11) Dry-run mode** -- `--dry-run` флаг vs отсутствует
- **(12) Global configuration** -- XDG_CONFIG_HOME vs отсутствует

Детали: [capabilities/cli-and-infrastructure.md](capabilities/cli-and-infrastructure.md)

## Сравнительная таблица

| Возможность               | Ruler             | Agloom                 | K5 Релевантность |
| ------------------------- | ----------------- | ---------------------- | ---------------- |
| Централиз. управление     | `.ruler/*.md`     | `.agloom/AGLOOM.md`    | --               |
| Concatenation markers     | `<!-- Source -->` | frontmatter + comments | --               |
| Nested rules              | Есть              | Нет                    | medium           |
| Количество агентов        | 31+               | 6                      | high             |
| Расширяемость (new agent) | 1 файл ~30 строк  | registry + N адаптеров | --               |
| MCP propagation           | filter by caps    | canonical YAML         | --               |
| Skills                    | copy директории   | transpiler pipeline    | --               |
| Конфигурация              | TOML, per-agent   | YAML, adapter list     | medium           |
| CLI (revert)              | Есть              | `clean` (аналог)       | --               |
| Gitignore автоматизация   | Managed block     | Нет                    | high             |
| Dry-run                   | `--dry-run`       | Нет                    | medium           |
| Global config             | XDG_CONFIG_HOME   | Нет                    | low              |

**Обозначения**: «--» означает, что возможность уже реализована в обоих
проектах (с различиями в подходе), релевантность заимствования не применима.

## Заключение

### Ключевые различия в подходах

Ruler применяет модель **конкатенации**: все `.md`-файлы объединяются
в единый текст, одинаковый для всех агентов. Agloom применяет модель
**трансформации**: YAML frontmatter и `<!-- agent:id -->` HTML-комментарии
позволяют генерировать разный контент для разных агентов из одного
исходного файла. Трансформационная модель Agloom семантически богаче,
но сложнее в реализации.

Ruler компенсирует простоту модели количеством агентов (31+ vs 6) и
инфраструктурными утилитами (gitignore, dry-run, global config, backup).
Agloom компенсирует меньшее число агентов plugin-системой, переменными,
overlay-механизмом и per-agent content filtering.

### Рекомендации по заимствованию

**Высокий приоритет:**

- **Gitignore автоматизация.** Ruler автоматически добавляет сгенерированные
  файлы в `.gitignore` через managed block. У Agloom этого нет -- пользователь
  должен вручную добавлять `CLAUDE.md`, `AGENTS.md` и пр. в `.gitignore`.
  Реализация тривиальна (~160 строк в Ruler), польза значительна.

- **Расширение набора агентов.** Ruler поддерживает 31+ агент. Agloom -- 6.
  Приоритетные кандидаты на добавление: Cursor, Windsurf, Cline, Copilot.
  Архитектура Agloom (adapter registry) позволяет добавлять агенты, но
  требует больше усилий на каждый агент (N адаптеров вместо 1 файла).

**Средний приоритет:**

- **Dry-run mode.** Полезен для preview изменений перед записью. В Ruler
  реализован как CLI-флаг с `logVerbose` вместо записи файлов.

- **Per-agent конфигурация.** `ruler.toml` позволяет настраивать
  `enabled`, `outputPath`, `mcp` для каждого агента. В Agloom конфигурация
  ограничена списком адаптеров в `config.yml`.

- **Nested rules для монорепо.** Ruler поддерживает вложенные `.ruler/`
  директории с независимыми конфигурациями. Для монорепо-пользователей
  это существенная возможность.

**Низкий приоритет:**

- **Global configuration (XDG_CONFIG_HOME).** Ruler ищет `.ruler/`
  в `$XDG_CONFIG_HOME/ruler` как fallback. Полезно для shared правил
  между проектами, но в Agloom эту роль частично выполняет plugin system.

### Что НЕ стоит заимствовать

- **Модель конкатенации.** Трансформационная модель Agloom принципиально
  мощнее. Переход к конкатенации означал бы потерю per-agent filtering.
- **Strategy pattern для агентов.** Adapter registry в Agloom обеспечивает
  лучшую композицию (один адаптер на транспайлер), хотя и дороже в setup.
- **Copy-based skills.** Agloom skills transpiler поддерживает трансформацию,
  что позволяет адаптировать skills под агента. Простое копирование -- шаг назад.

### Архитектурные наблюдения

Ruler демонстрирует значительное дублирование кода: `SkillsProcessor.ts`
содержит 1400+ строк, где каждая функция `propagateSkillsFor<Agent>` --
копия с другим путём. В Agloom аналогичная логика решается через adapter
registry + generic pipeline. Это подтверждает правильность архитектурного
выбора Agloom, но ценой более высокого барьера входа для контрибьюторов.

## Источники

- Ruler: [GitHub](https://github.com/intellectronica/ruler), исходный код `/tmp/ruler/`
- Ruler: [NPM](https://www.npmjs.com/package/@intellectronica/ruler)
- Agloom: исходный код текущего репозитория
