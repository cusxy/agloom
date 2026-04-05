---
type: research
summary: Анализ MkDocs Material как генератора документационного сайта для agloom.
description: >-
  Детальная оценка MkDocs Material по критериям совместимости стека,
  landing page, sidebar ordering, поиска, DX и зрелости экосистемы.
relates:
  - docs/researches/docs-site-generators/RESEARCH.md
---

# MkDocs Material

## Описание

Material for MkDocs -- тема и фреймворк расширений поверх MkDocs
(Python-based SSG). Преобразует Markdown в документационный сайт
с Material Design. Используется AWS, Google, Microsoft, Netflix, OpenAI.

В 2026 году экосистема переживает кризис: MkDocs 2.0 вызвал конфликт
мейнтейнеров и смену владельца PyPI-пакета; Material for MkDocs перешёл
в maintenance mode с ноября 2025; команда фокусируется на преемнике
Zensical.

## Оценка по критериям

### K1. Совместимость стека

Python-зависимость: требует Python runtime, pip/pipx для установки.
Внешняя экосистема по отношению к agloom (Node.js/TypeScript). Добавляет
Python в CI/CD pipeline. Конфигурация в `mkdocs.yml` (YAML).

### K2. Landing page

Нет встроенного landing page layout. Кастомный landing требует
переопределения шаблонов (Jinja2) или использования HTML-расширений.
Значительно сложнее, чем в VitePress/Starlight/Docusaurus.

### K3. Sidebar ordering

Navigation определяется в `mkdocs.yml` через `nav` секцию (YAML).
Полный контроль над порядком и группировкой, но ручное редактирование
конфига при добавлении страниц. Frontmatter-based ordering отсутствует
(без плагинов).

### K4. Markdown + frontmatter

Python-Markdown с расширениями PyMdown Extensions: admonitions, tabs,
code highlighting, math. YAML frontmatter поддерживается для метаданных
(title, description). Нет MDX -- нельзя вставлять компоненты в Markdown.

### K5. Поиск

Встроенный client-side search (lunr.js). Работает из коробки без
внешних зависимостей. Поддерживает множество языков.

### K6. DX и производительность

- Live-reload в dev-режиме (проблемы с надёжностью в MkDocs 1.x).
- Средняя скорость билда.
- Простая конфигурация для базовых сценариев.
- Python-зависимость усложняет setup для JavaScript-команд.

### K7. Зрелость экосистемы

- Широкое adoption (AWS, Google, Microsoft, Netflix, OpenAI).
- MkDocs 2.0 -- кризис: смена владельца PyPI-пакета, удалённый roadmap.
- Material for MkDocs -- maintenance mode с ноября 2025.
- Преемник Zensical -- в разработке, не стабилен.
- Экосистема в состоянии неопределённости.

## Плюсы

- Один из наиболее визуально проработанных документационных фреймворков.
- Богатый набор Markdown-расширений (admonitions, tabs, annotations).
- Встроенный поиск с мультиязычной поддержкой.
- Широкое adoption крупными компаниями.
- Простая конфигурация через YAML.

## Минусы

- Python-зависимость: внешняя экосистема для Node.js/TypeScript проекта.
- Maintenance mode с ноября 2025 -- только bugfixes и security patches.
- MkDocs 2.0 кризис: нестабильность экосистемы, конфликт мейнтейнеров.
- Нет встроенного landing page layout.
- Нет frontmatter-based sidebar ordering.
- Нет MDX или аналога для встраивания компонентов в Markdown.
- Преемник Zensical ещё не готов к production.

## Контекст применимости

**Оправдан**: Python-проекты, существующие документации на MkDocs,
команды с опытом Python-экосистемы, сценарии где визуальное качество
Material Design критично.

**Не оправдан**: новые проекты в Node.js/TypeScript экосистеме (2026),
учитывая maintenance mode и неопределённость экосистемы MkDocs.

## Источники

- [Material for MkDocs -- Official Documentation](https://squidfunk.github.io/mkdocs-material/)
- [MkDocs 2.0 -- Material for MkDocs Blog](https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/)
- [Zensical -- Material for MkDocs Blog](https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/)
- [GitHub -- squidfunk/mkdocs-material](https://github.com/squidfunk/mkdocs-material)
- [MkDocs -- Official Site](https://www.mkdocs.org/)
