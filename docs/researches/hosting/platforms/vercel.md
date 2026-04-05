---
type: research
summary: Детальный анализ Vercel как платформы для хостинга документации agloom.
description: >-
  Оценка Vercel по критериям стоимости, CI/CD, CDN, bandwidth,
  build minutes, preview deployments и DX для статического
  Docusaurus-сайта.
relates:
  - docs/researches/hosting/RESEARCH.md
---

# Vercel

## Общие сведения

Vercel -- платформа для деплоя frontend-приложений, созданная
командой Next.js. Лидер по developer experience среди Jamstack-
хостингов. Два основных плана: Hobby (бесплатный, только для
персональных некоммерческих проектов) и Pro ($20/user/мес).

## Оценка по критериям

### K1. Стоимость

Hobby-план бесплатен, но запрещает коммерческое использование.
Для open-source проекта agloom документационный сайт попадает
в серую зону: проект бесплатный, но продвигает инструмент.
Pro-план стоит $20/user/мес -- в пределах бюджета, но значительно
дороже альтернатив для чисто статического сайта.

### K2. CI/CD интеграция

Нативная интеграция с GitHub, GitLab, Bitbucket. Zero-config
деплой: Vercel автоматически определяет Docusaurus и настраивает
build command / output directory. Автодеплой при push.

### K3. Кастомный домен + SSL

Бесплатный SSL на всех планах. Кастомные домены настраиваются
через dashboard. Автоматическое обновление сертификатов.

### K4. CDN

Global Edge Network. Агрессивное кеширование статических ассетов.
Быстрые билды через build cache. Для статических сайтов
производительность сопоставима с Cloudflare.

### K5. Bandwidth limits

Hobby: 100 GB/мес (hard limit). Pro: 1 TB/мес. Для ~15-страничного
Docusaurus-сайта с бандлом ~300 KB 100 GB покрывает ~330 000
page views -- достаточно для документации open-source CLI.

### K6. Build minutes

Hobby: 6000 минут/мес (де-факто неограниченно для статики).
Максимальная длительность билда: 45 минут. Лимит: 32 деплоя
в час. Для Docusaurus-сайта ограничения несущественны.

### K7. Preview deployments

Автоматический preview для каждого PR. Комментарий в PR
с ссылкой на preview. Поддержка protected environments.
Лучший UX среди рассмотренных платформ: интуитивный dashboard,
deployment comments, screenshot previews.

### K8. DX для Docusaurus

Vercel предоставляет официальный гайд по деплою Docusaurus.
CLI-деплой через `vercel`, web-деплой через import из GitHub.
Автоопределение framework. Поддержка pnpm и Node.js 20+.

## Плюсы

- Лучший developer experience среди рассмотренных платформ:
  интуитивный UI, быстрая настройка, информативные deployment logs.
- Zero-config деплой Docusaurus.
- Быстрые билды с агрессивным кешированием.
- Превосходные preview deployments с комментариями в PR.

## Минусы

- Hobby-план запрещает коммерческое использование. Нарушение
  может привести к блокировке аккаунта. Для open-source
  документационного сайта статус неоднозначен.
- Pro-план ($20/мес) избыточен для статического сайта -- платить
  за serverless-функции, Edge Middleware и прочие возможности,
  которые не используются.
- Bandwidth 100 GB на Hobby -- при вирусном трафике сайт
  станет недоступен до следующего цикла.
- Vendor lock-in: экосистема оптимизирована под Next.js,
  Docusaurus -- поддерживается, но не является приоритетом.

## Контекст применимости

Оправдан для команд, уже использующих Vercel для основного
продукта (Next.js приложения). Для изолированного статического
документационного сайта -- избыточен по стоимости (Pro)
или рискован по лицензии (Hobby).

## Источники

- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Limits](https://vercel.com/docs/limits)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Deploying Docusaurus with Vercel](https://vercel.com/guides/deploying-docusaurus-with-vercel)
- [Vercel Pricing 2026 -- Temps](https://temps.sh/blog/vercel-pricing-complete-guide-2026)
