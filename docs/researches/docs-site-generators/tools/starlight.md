---
type: research
summary: Анализ Starlight (Astro) как генератора документационного сайта для agloom.
description: >-
  Детальная оценка Starlight по критериям совместимости стека, landing page,
  sidebar ordering, поиска, DX и зрелости экосистемы.
relates:
  - docs/researches/docs-site-generators/RESEARCH.md
---

# Starlight

## Описание

Starlight -- документационный фреймворк на базе Astro. Framework-agnostic:
поддерживает компоненты React, Vue, Svelte, Solid и др. через Astro Islands.
Акцент на производительности (минимальный JS на клиенте), доступности
и встроенном поиске (Pagefind).

GitHub: ~7.9K stars, 934 forks. Последнее обновление -- Starlight 0.38
(Astro 6, март 2026).

## Оценка по критериям

### K1. Совместимость стека

Работает в Node.js экосистеме, установка через npm/pnpm. Однако основной
язык шаблонов -- Astro (`.astro` файлы), не TypeScript/Vue/React.
Конфигурация в `astro.config.mjs`. TypeScript поддерживается для логики.

### K2. Landing page

Встроенный hero-компонент и features-блок в дефолтной теме. Кастомные
страницы через Astro-компоненты или MDX. Оба сценария (единый и раздельный
сайт) поддерживаются.

### K3. Sidebar ordering

Нативная поддержка через frontmatter `sidebar.order`:

```yaml
---
title: Getting Started
sidebar:
  order: 2
---
```

Автогенерация sidebar по директориям с сортировкой по `order`.
Конвертация из `after` в числовой `order` -- тривиальна.
Это преимущество перед VitePress, где требуется плагин.

### K4. Markdown + frontmatter

Markdown и MDX. Frontmatter валидируется через Zod-схемы (Astro Content
Collections). TypeScript type-safety для frontmatter-полей. Кастомные поля
поддерживаются через расширение схемы.

### K5. Поиск

Pagefind -- встроенный full-text search, работающий на клиенте без
внешних сервисов. Индексация при билде. Для малых сайтов -- оптимальное
решение.

### K6. DX и производительность

- Быстрый билд (Astro).
- Минимальный JS на клиенте (< 50 KB compressed при первой загрузке).
- Astro 6: экспериментальный Rust-компилятор для ускорения.
- Dev-сервер медленнее Vite (Astro использует собственный dev server).

### K7. Зрелость экосистемы

- ~200K еженедельных загрузок npm.
- Активная разработка (Astro 6, Starlight 0.38 -- март 2026).
- Версия < 1.0 -- API может меняться.
- Растущее сообщество, но значительно меньше VitePress/Docusaurus.

## Плюсы

- Нативный sidebar ordering через frontmatter (без плагинов).
- Pagefind -- встроенный client-side search.
- Минимальный JS-бандл на клиенте.
- Framework-agnostic компоненты (React, Vue, Svelte).
- Zod-валидация frontmatter -- type-safe контент.
- Встроенная доступность (accessibility-first подход).

## Минусы

- Версия < 1.0: API нестабилен, возможны breaking changes.
- Меньшее сообщество (~200K downloads/w vs ~2M у VitePress).
- Astro -- отдельный фреймворк, не используемый в agloom; добавляет
  когнитивную нагрузку при кастомизации.
- Dev-сервер медленнее Vite-based решений.
- Меньше готовых плагинов и интеграций по сравнению с VitePress/Docusaurus.

## Контекст применимости

**Оправдан**: проекты, где критичны производительность на клиенте,
accessibility, и нативный sidebar ordering. Хороший выбор при отсутствии
привязки к конкретному фреймворку.

**Не оправдан**: проекты, требующие глубокой кастомизации с использованием
существующих навыков команды (Vue/React), или когда стабильность API
критична (pre-1.0).

## Источники

- [Starlight -- Official Documentation](https://starlight.astro.build/)
- [Starlight -- Sidebar Navigation](https://starlight.astro.build/guides/sidebar/)
- [Starlight -- Frontmatter Reference](https://starlight.astro.build/reference/frontmatter/)
- [Astro -- What's New March 2026](https://astro.build/blog/whats-new-march-2026/)
- [GitHub -- withastro/starlight](https://github.com/withastro/starlight)
