---
type: research
summary: Детальный анализ Cloudflare Pages как платформы для хостинга документации agloom.
description: >-
  Оценка Cloudflare Pages по критериям стоимости, CI/CD, CDN,
  bandwidth, build minutes, preview deployments и DX для
  статического Docusaurus-сайта.
relates:
  - docs/researches/hosting/RESEARCH.md
---

# Cloudflare Pages

## Общие сведения

Cloudflare Pages -- платформа статического хостинга, интегрированная
в экосистему Cloudflare (CDN, DNS, DDoS protection, WAF). Запущена
в 2021 году, к 2026 году является одним из лидеров рынка статического
хостинга. Коммерческое использование разрешено на бесплатном плане.

## Оценка по критериям

### K1. Стоимость

Бесплатный план включает неограниченный bandwidth, неограниченное
количество сайтов и статических запросов. Платный план (Workers Paid,
$5/мес) требуется только при использовании Pages Functions (serverless).
Для чисто статического Docusaurus-сайта достаточно бесплатного плана.

### K2. CI/CD интеграция

Нативная интеграция с GitHub и GitLab. Автоматический деплой при push
в любую ветку. GitHub App "Cloudflare Workers and Pages" обеспечивает
статус-чеки в PR. Docusaurus распознается как Framework preset --
build command и output directory настраиваются автоматически.

### K3. Кастомный домен + SSL

Бесплатный SSL через Cloudflare. Поддержка кастомных доменов без
ограничений. При использовании Cloudflare DNS -- автоматическая
настройка. Для agloom.sh / agloom.ai требуется перенос DNS
на Cloudflare или добавление CNAME-записей.

### K4. CDN

300+ edge-локаций по всему миру. Latency < 50ms глобально для
статических ассетов. CDN встроен в платформу -- дополнительная
настройка не требуется.

### K5. Bandwidth limits

Неограниченный bandwidth на бесплатном плане. Это ключевое отличие
от конкурентов (Vercel: 100 GB, Netlify: 100 GB, GitHub Pages: 100 GB).

### K6. Build minutes

500 билдов в месяц на бесплатном плане. Для документационного
сайта с ~15 страницами этого достаточно с запасом (даже при 10+
коммитах в день).

### K7. Preview deployments

Автоматический preview deployment для каждого PR. Уникальный URL
вида `<hash>.<project>.pages.dev`. Комментарий с URL публикуется
в PR автоматически. Поддержка branch deploy controls (все ветки,
выборочные, или отключение).

### K8. DX для Docusaurus

Cloudflare Pages предоставляет официальный Framework preset
для Docusaurus. Документация Cloudflare содержит пошаговый гайд
по деплою Docusaurus. Поддержка Node.js 18+ в build environment.
Для pnpm требуется задать environment variable
`NPM_FLAGS=--legacy-peer-deps` или использовать `.node-version` файл.

## Плюсы

- Неограниченный bandwidth -- нет риска превышения лимитов при росте
  трафика.
- 300+ CDN-локаций -- лучшее покрытие среди рассмотренных платформ.
- Бесплатный план разрешает коммерческое использование.
- Интеграция с экосистемой Cloudflare (DNS, WAF, analytics).
- Preview deployments из коробки.

## Минусы

- Build environment имеет ограничения по версиям Node.js (поддержка
  18+, но не всегда latest). Для pnpm может потребоваться дополнительная
  конфигурация.
- Dashboard и UX менее интуитивны по сравнению с Vercel/Netlify --
  интерфейс ориентирован на Cloudflare-экосистему, а не на frontend-
  разработчиков.
- Сообщество сообщает о спорадических проблемах с preview deployments
  (март 2026: билды могли использовать устаревший commit вместо HEAD).
- Отсутствие встроенных server-side redirects через UI -- настройка
  через `_redirects` файл (лимит 2000 статических + 100 динамических).

## Контекст применимости

Оправдан для проектов любого масштаба: от персональных сайтов до
production-документации. Особенно выгоден при высоком трафике благодаря
неограниченному bandwidth. Менее удобен для команд, привыкших к UX
Vercel/Netlify.

## Источники

- [Cloudflare Pages -- Pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare Pages -- Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Deploy a Docusaurus site -- Cloudflare Pages docs](https://developers.cloudflare.com/pages/framework-guides/deploy-a-docusaurus-site/)
- [Preview deployments -- Cloudflare Pages docs](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [GitHub integration -- Cloudflare Pages docs](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)
