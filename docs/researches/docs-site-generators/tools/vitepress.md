---
type: research
summary: Анализ VitePress как генератора документационного сайта для agloom.
description: >-
  Детальная оценка VitePress по критериям совместимости стека, landing page,
  sidebar ordering, поиска, DX и зрелости экосистемы.
relates:
  - docs/researches/docs-site-generators/RESEARCH.md
---

# VitePress

## Описание

VitePress -- статический генератор сайтов на базе Vite и Vue 3, духовный
преемник VuePress. Ориентирован на документационные и контентные сайты.
Конвертирует Markdown-файлы в статический HTML с SPA-навигацией.
Конфигурация пишется на TypeScript (`.vitepress/config.ts`).

Используется крупными проектами: Vite, Vitest, Vue 3, Pinia, Rollup,
UnoCSS, D3, Iconify.

## Оценка по критериям

### K1. Совместимость стека

Полная совместимость с Node.js/pnpm экосистемой. Установка через
`pnpm add -D vitepress`. Конфигурация на TypeScript с полной типизацией.
Использует тот же markdown-парсер (markdown-it), что и многие Node.js
проекты. gray-matter для frontmatter -- идентично текущему стеку agloom.

### K2. Landing page

Встроенный layout `home` с hero-секцией (заголовок, описание, CTA-кнопки,
изображение) и features-блоком (сетка карточек с иконками). Достаточно
для landing page базового уровня. Для расширенных сценариев -- кастомные
Vue-компоненты напрямую в Markdown или через layout slots.

Поддерживает оба сценария:

- **Единый сайт**: `index.md` с layout `home` как главная, `/guide/` и
  `/reference/` как разделы документации.
- **Раздельный**: два VitePress-инстанса или кастомный layout для landing.

### K3. Sidebar ordering

Нативно VitePress требует ручного описания sidebar в конфиге. Плагин
[vitepress-sidebar](https://github.com/jooy2/vitepress-sidebar) добавляет
автогенерацию с сортировкой по полю `order` в frontmatter.

Конвертация из текущего поля `after` (linked-list) в числовой `order`
выполняется тривиально: пересчёт позиций при сборке.

### K4. Markdown + frontmatter

Markdown-it с расширениями: syntax highlighting (Shiki), GitHub-style alerts,
emoji, code groups, line highlighting, diff-блоки. gray-matter для YAML
frontmatter. Vue-компоненты доступны в Markdown напрямую.

### K5. Поиск

Встроенный local search (MiniSearch) без внешних зависимостей. Опционально --
интеграция с Algolia DocSearch. Для ~15 страниц документации встроенный
поиск достаточен.

### K6. DX и производительность

- Dev-сервер: мгновенный старт (Vite).
- HMR: < 100 мс.
- Билд: секунды для малых проектов.
- Простая структура: `.vitepress/config.ts` + Markdown-файлы.

### K7. Зрелость экосистемы

- ~2M еженедельных загрузок npm.
- Активная разработка, спонсируется VoidZero (компания за Vite).
- Стабильный API, обратная совместимость.
- Большое сообщество плагинов.

## Плюсы

- Одна экосистема с проектом (Node.js, TypeScript, pnpm).
- Минимальная конфигурация для старта.
- Высокая скорость разработки (Vite HMR).
- Встроенный landing page layout.
- Встроенный поиск без внешних сервисов.
- Широкое adoption крупными проектами.

## Минусы

- Sidebar ordering из frontmatter требует стороннего плагина.
- Vue-зависимость: кастомизация за пределами темы требует знания Vue 3.
- Менее гибкий landing page по сравнению с Docusaurus (нет полностраничных
  React-компонентов).
- Нет встроенного версионирования документации (не требуется для agloom,
  но ограничение при масштабировании).

## Контекст применимости

**Оправдан**: проекты малого-среднего масштаба в Node.js/TypeScript экосистеме,
где требуется быстрый старт, хороший DX и стандартный документационный layout.

**Не оправдан**: проекты с потребностью в глубокой кастомизации layout каждой
страницы, multi-version docs, или экосистема далека от JavaScript.

## Источники

- [VitePress -- What is VitePress?](https://vitepress.dev/guide/what-is-vitepress)
- [VitePress -- Frontmatter Config](https://vitepress.dev/reference/frontmatter-config)
- [VitePress -- Sidebar](https://vitepress.dev/reference/default-theme-sidebar)
- [vitepress-sidebar -- GitHub](https://github.com/jooy2/vitepress-sidebar)
- [PkgPulse -- Docusaurus vs VitePress vs Starlight](https://www.pkgpulse.com/blog/best-documentation-frameworks-2026)
