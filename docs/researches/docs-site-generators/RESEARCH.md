---
type: research
summary: >-
  Сравнительный анализ инструментов для документационного сайта agloom:
  VitePress, Starlight, Docusaurus, Nextra, MkDocs Material.
description: >-
  Исследование open-source генераторов документационных сайтов для проекта
  agloom. Рассмотрены пять инструментов-лидеров с оценкой по критериям
  совместимости со стеком, поддержки landing page, sidebar ordering из
  frontmatter, и качества developer experience.
---

# Исследование: генераторы документационных сайтов

Дата: 2026-04-05

## Контекст исследования

### Проблема

Проект agloom -- CLI-инструмент на TypeScript для транспиляции конфигураций
AI-агентов -- нуждается в публичном документационном сайте. Документация
существует в виде Markdown-файлов с YAML frontmatter (`docs/guide/` -- 8
файлов, `docs/reference/` -- 7 файлов), но не доступна конечным
пользователям в удобном формате.

### Мотивация

Публичный сайт документации повышает доступность проекта, снижает порог входа
для новых пользователей и обеспечивает индексацию поисковыми системами.

### Цель

Выбрать инструмент для генерации статического документационного сайта, который
интегрируется со стеком проекта (TypeScript, Node.js, pnpm) и поддерживает
требования к структуре контента.

### Границы

- Рассматриваются только open-source SSG, ориентированные на документацию.
- Хостинг-платформы выходят за границы исследования (любой статический хостинг).
- Визуальный дизайн и кастомизация тем -- за границами; оценивается только
  наличие базовых возможностей (dark theme, responsive, landing page).
- Два сценария использования: единый сайт (landing + docs) и раздельные
  (landing на основном домене, docs на поддомене).

## Критерии оценки

Критерии определены до анализа инструментов, на основе требований проекта.

| #   | Критерий                | Описание                                                | Вес    |
| --- | ----------------------- | ------------------------------------------------------- | ------ |
| K1  | Совместимость стека     | TypeScript/Node.js экосистема, установка через npm/pnpm | high   |
| K2  | Landing page            | Hero-секция, features-блок, кастомные страницы          | high   |
| K3  | Sidebar ordering        | Управление порядком через frontmatter или конфиг        | medium |
| K4  | Markdown + frontmatter  | Поддержка YAML frontmatter, расширения Markdown         | high   |
| K5  | Поиск                   | Встроенный или легко интегрируемый full-text search     | medium |
| K6  | DX и производительность | Скорость билда, HMR, простота конфигурации              | medium |
| K7  | Зрелость экосистемы     | Активность разработки, размер сообщества, стабильность  | medium |

## Объекты анализа

Детальный анализ каждого инструмента вынесен в отдельные файлы:

- [VitePress](tools/vitepress.md) -- Vue/Vite-based SSG для документации
- [Starlight](tools/starlight.md) -- Astro-based документационный фреймворк
- [Docusaurus](tools/docusaurus.md) -- React-based SSG от Meta
- [Nextra](tools/nextra.md) -- Next.js-based документационный фреймворк
- [MkDocs Material](tools/mkdocs-material.md) -- Python-based SSG с Material-темой

## Сравнительная таблица

| Критерий                 | VitePress        | Starlight         | Docusaurus       | Nextra            | MkDocs Material  |
| ------------------------ | ---------------- | ----------------- | ---------------- | ----------------- | ---------------- |
| K1 Совместимость стека   | Node.js/npm      | Node.js/npm       | Node.js/npm      | Node.js/npm       | Python/pip       |
| K2 Landing page          | Встроенный hero  | Встроенный hero   | Полноценные стр. | Ограниченный      | Нет встроенного  |
| K3 Sidebar ordering      | Плагин (order)   | frontmatter       | frontmatter      | Файловая система  | YAML-конфиг      |
| K4 Markdown/frontmatter  | gray-matter      | Zod-валидация     | MDX + FM         | MDX 3 + FM        | PyMdown          |
| K5 Поиск                 | Встроенный local | Pagefind          | Algolia/плагин   | Pagefind          | Встроенный       |
| K6 DX/производительность | HMR <100ms       | Быстрый билд      | Медленнее        | Next.js HMR       | Средний          |
| K7 Зрелость              | ~2M downloads/w  | ~200K downloads/w | ~3M downloads/w  | ~300K downloads/w | Maintenance mode |

**Условные обозначения**: FM -- frontmatter, downloads/w -- еженедельные загрузки npm/PyPI.

## Заключение

### Решение: Docusaurus

По результатам анализа и обсуждения с автором проекта выбран Docusaurus.
Исходная рекомендация агента (VitePress) была пересмотрена с учётом
субъективных предпочтений и дополнительных аргументов.

Основания для выбора:

1. **Совместимость стека** (K1). Docusaurus построен на React -- том же
   фреймворке, что использует agloom для CLI (Ink). JSX/TSX-компоненты
   знакомы команде, не требуется изучение Vue. Лицензия -- MIT.

2. **Landing page** (K2). Полноценная поддержка кастомных страниц на React.
   Для единого сайта (landing + docs) Docusaurus предоставляет максимальную
   гибкость: landing как React-страница, docs как плагин. Для раздельного
   сценария -- docs на поддомене с кастомным landing.

3. **Sidebar ordering** (K3). Нативная поддержка `sidebar_position`
   в frontmatter. Конвертация из текущего поля `after` (linked-list)
   в числовой порядок тривиальна.

4. **Кастомизация**. React-компоненты и swizzling (переопределение любого
   компонента темы) обеспечивают глубокую кастомизацию без форка.

5. **Зрелость** (K7). ~3M еженедельных загрузок -- наибольшая среди
   рассмотренных инструментов. Поддерживается Meta. Стабильный API (v3).

Компромиссы: более медленный билд по сравнению с VitePress (Webpack vs Vite),
больший бандл, наличие неиспользуемых возможностей (версионирование, i18n).
Для масштаба agloom (~15 страниц) эти минусы несущественны.

### Альтернативы

- **VitePress** -- исходная рекомендация агента. Быстрее в билде (HMR <100ms),
  легче. Компромисс -- Vue-зависимость и плагин для sidebar ordering.
- **Starlight** -- нативный sidebar ordering и Pagefind search. Компромисс --
  меньшая зрелость (~200K downloads/w), необходимость изучения Astro.

### Отклоненные варианты

- **Nextra** -- привязка к Next.js App Router, нестабильный API (v4 -- breaking
  change с pages router), меньшее сообщество.
- **MkDocs Material** -- внешняя зависимость от Python-экосистемы, переход
  в maintenance mode с ноября 2025, преемник Zensical ещё не стабилен.

## Источники

- [VitePress -- официальная документация](https://vitepress.dev/)
- [Starlight -- официальная документация](https://starlight.astro.build/)
- [Docusaurus -- официальная документация](https://docusaurus.io/)
- [Nextra -- официальная документация](https://nextra.site/)
- [Material for MkDocs -- официальная документация](https://squidfunk.github.io/mkdocs-material/)
- [vitepress-sidebar -- npm](https://www.npmjs.com/package/vitepress-sidebar)
- [Docusaurus vs VitePress vs Starlight -- PkgPulse Blog](https://www.pkgpulse.com/blog/best-documentation-frameworks-2026)
- [Docusaurus Review 2026 -- Ferndesk](https://ferndesk.com/blog/docusaurus-review)
- [MkDocs 2.0 -- Material for MkDocs Blog](https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/)
