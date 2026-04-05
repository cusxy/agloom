---
type: research
summary: Анализ Nextra как генератора документационного сайта для agloom.
description: >-
  Детальная оценка Nextra по критериям совместимости стека, landing page,
  sidebar ordering, поиска, DX и зрелости экосистемы.
relates:
  - docs/researches/docs-site-generators/RESEARCH.md
---

# Nextra

## Описание

Nextra -- фреймворк поверх Next.js для контентных сайтов. Поддерживает
MDX 3, file-based routing, Pagefind search. Текущая версия -- Nextra 4,
работает только с Next.js App Router (breaking change с pages router).

Используется отдельными проектами, но значительно менее распространён,
чем VitePress или Docusaurus.

## Оценка по критериям

### K1. Совместимость стека

Node.js экосистема, npm/pnpm. Привязан к Next.js -- полноценный
React-фреймворк с SSR, ISR, middleware. Для документационного сайта
это избыточная зависимость. TypeScript поддерживается нативно.

### K2. Landing page

Документационная тема включает базовый landing layout. Кастомизация
через React-компоненты и Next.js pages. Менее развитый landing page
из коробки по сравнению с VitePress и Docusaurus.

### K3. Sidebar ordering

Файловая система определяет структуру sidebar. Управление порядком
через `_meta.json` файлы в каждой директории (не через frontmatter).
Frontmatter-based ordering отсутствует.

### K4. Markdown + frontmatter

MDX 3 с React Server Components. YAML frontmatter поддерживается.
Автоматическая оптимизация ссылок и изображений через Next.js Link
и Next.js Image.

### K5. Поиск

Pagefind -- build-time индексация, client-side full-text search.
Работает без внешних сервисов.

### K6. DX и производительность

- Next.js dev-сервер: быстрый HMR.
- Hybrid rendering (SSG, SSR, ISR) -- избыточен для статического сайта.
- Конфигурация сложнее из-за Next.js слоя.
- Shiki для syntax highlighting (build-time).

### K7. Зрелость экосистемы

- ~300K еженедельных загрузок npm.
- Nextra 4 -- breaking change (только App Router), миграция с v2/v3
  нетривиальна.
- Менее активное сообщество по сравнению с VitePress/Docusaurus.
- Основной мейнтейнер -- Shu Ding (Vercel), limited bus factor.

## Плюсы

- Полная мощь Next.js (SSR, ISR, API routes) при необходимости.
- MDX 3 с React Server Components.
- Pagefind -- встроенный поиск.
- Автооптимизация изображений и ссылок.
- TypeScript-first.

## Минусы

- Избыточная зависимость от Next.js для статического документационного
  сайта.
- Sidebar ordering через `_meta.json`, не через frontmatter -- требует
  изменения workflow.
- Nextra 4 -- breaking change с pages router; нестабильный API между
  мажорными версиями.
- Меньшее сообщество и экосистема плагинов.
- Limited bus factor (один основной мейнтейнер).
- Landing page из коробки менее развит.

## Контекст применимости

**Оправдан**: проекты, уже использующие Next.js, где документация --
часть основного приложения, или требуется SSR/ISR для контента.

**Не оправдан**: standalone документационные сайты, где Next.js --
избыточная зависимость, или когда стабильность API критична.

## Источники

- [Nextra -- Official Documentation](https://nextra.site/)
- [Nextra -- Docs Theme](https://nextra.site/docs/docs-theme/start)
- [GitHub -- shuding/nextra](https://github.com/shuding/nextra)
