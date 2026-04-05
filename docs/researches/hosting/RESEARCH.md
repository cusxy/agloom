---
type: research
summary: >-
  Сравнительный анализ платформ для хостинга статического
  документационного сайта agloom: Cloudflare Pages, Vercel,
  Netlify, GitHub Pages, DigitalOcean App Platform, VPS.
description: >-
  Исследование платформ статического хостинга для Docusaurus-сайта
  документации проекта agloom. Рассмотрены шесть вариантов
  размещения с оценкой по критериям стоимости, CI/CD, CDN,
  bandwidth, preview deployments и developer experience.
relates:
  - docs/researches/docs-site-generators/RESEARCH.md
---

# Исследование: хостинг документационного сайта

Дата: 2026-04-05

## Контекст исследования

### Проблема

Проект agloom нуждается в хостинг-платформе для публичного
документационного сайта. По результатам предыдущего исследования
([docs-site-generators](../docs-site-generators/RESEARCH.md)) выбран
Docusaurus (React-based SSG, v3) -- генератор чистой статики
(HTML/CSS/JS, бандл ~300 KB). Масштаб: ~15 страниц документации.

### Мотивация

Выбор хостинг-платформы определяет стоимость эксплуатации, скорость
доставки контента, удобство CI/CD workflow и доступность PR previews
для командной работы над документацией.

### Цель

Выбрать платформу для размещения статического Docusaurus-сайта,
обеспечивающую бесплатный или бюджетный хостинг (до $20/мес),
глобальную доставку через CDN, автодеплой из GitHub и PR previews.

### Границы

- Только статический хостинг -- серверная часть отсутствует.
- Кастомный домен обязателен (agloom.sh или agloom.ai).
- Бюджет: до $20/мес.
- Build environment: Node.js 20+, pnpm.
- Build command: `npx docusaurus build`, output: `build/`.
- PaaS-платформы (Render, Railway, Fly.io) рассмотрены обзорно --
  они ориентированы на серверные приложения и избыточны для статики.

## Критерии оценки

Критерии определены до анализа платформ.

| #   | Критерий            | Описание                                           | Вес    |
| --- | ------------------- | -------------------------------------------------- | ------ |
| K1  | Стоимость           | Free tier, платные планы, предсказуемость расходов | high   |
| K2  | CI/CD               | Автодеплой из GitHub, zero-config для Docusaurus   | high   |
| K3  | Домен + SSL         | Кастомный домен, бесплатный SSL, автообновление    | high   |
| K4  | CDN                 | Глобальная доставка, количество PoP, latency       | medium |
| K5  | Bandwidth           | Месячный лимит трафика, поведение при превышении   | medium |
| K6  | Build minutes       | Лимит минут/билдов, достаточность для workflow     | low    |
| K7  | Preview deployments | PR previews, комментарии в PR, branch deploys      | high   |
| K8  | DX для Docusaurus   | Framework preset, документация, настройка pnpm     | medium |

## Объекты анализа

Детальный анализ каждой платформы вынесен в отдельные файлы:

- [Cloudflare Pages](platforms/cloudflare-pages.md) -- edge-платформа
  с неограниченным bandwidth
- [Vercel](platforms/vercel.md) -- лидер по DX, ограничения free tier
- [Netlify](platforms/netlify.md) -- пионер Git-to-deploy, кредитная
  модель
- [GitHub Pages](platforms/github-pages.md) -- бесплатный хостинг
  без PR previews
- [DO App Platform](platforms/digitalocean-app-platform.md) --
  статический tier в экосистеме DigitalOcean
- [VPS](platforms/vps.md) -- DigitalOcean/Hetzner, полный контроль

### PaaS (краткий обзор)

Render, Railway и Fly.io ориентированы на серверные приложения.
Для чисто статического сайта они избыточны:

- **Render** -- бесплатный static tier (100 GB bandwidth), но
  без преимуществ перед Cloudflare Pages или Netlify.
- **Railway** -- $5/мес minimum, нет фокуса на статике.
- **Fly.io** -- контейнерный деплой, сложная модель ценообразования,
  нецелесообразен для статики.

## Сравнительная таблица

| Критерий         | Cloudflare Pages | Vercel Hobby  | Netlify Free    | GitHub Pages  | DO App Platform | VPS (Hetzner)   |
| ---------------- | ---------------- | ------------- | --------------- | ------------- | --------------- | --------------- |
| K1 Стоимость     | $0               | $0 / $20 Pro  | $0 (credits)    | $0            | $0 (1 GiB)      | EUR 3.99+/мес   |
| K2 CI/CD         | GitHub, preset   | GitHub, zero  | GitHub, toml    | Actions YAML  | GitHub, manual  | Actions + rsync |
| K3 Домен + SSL   | Бесплатно        | Бесплатно     | Бесплатно       | Бесплатно     | Бесплатно       | Let's Encrypt   |
| K4 CDN PoP       | 300+             | Global Edge   | Global CDN      | Fastly CDN    | Ограниченный    | Нет (1 DC)      |
| K5 Bandwidth     | Unlimited        | 100 GB        | ~30 GB\*\*      | 100 GB (soft) | 1 GiB           | 20 TB           |
| K6 Build mins    | 500 builds/мес   | 6000 мин/мес  | ~20 deploys\*\* | Unlimited\*   | Не документ.    | N/A             |
| K7 PR previews   | Да               | Да            | Да              | Нет           | Нет             | Нет             |
| K8 DX Docusaurus | Preset + гайд    | Preset + гайд | Гайд            | Actions YAML  | Ручная настр.   | Ручная настр.   |

\* Для публичных репозиториев через GitHub Actions.
\*\* Кредитная модель (новые аккаунты с сентября 2025): 300 credits/мес,
bandwidth = 10 credits/GB, deploy = 15 credits. Лимиты взаимозависимы.

**Условные обозначения**: DC -- дата-центр, PoP -- Point of Presence.

## Заключение

### Рекомендация: Cloudflare Pages

По результатам анализа Cloudflare Pages является оптимальным выбором
для хостинга документационного сайта agloom.

Основания:

1. **Стоимость** (K1). Бесплатный план без ограничений на bandwidth
   и коммерческое использование. Vercel Hobby запрещает коммерческое
   использование; Vercel Pro ($20/мес) избыточен для статики.

2. **CDN** (K4). 300+ edge-локаций -- лучшее покрытие среди
   рассмотренных платформ. Для open-source проекта с глобальной
   аудиторией это обеспечивает минимальную latency.

3. **Bandwidth** (K5). Неограниченный трафик устраняет риск
   недоступности сайта при всплеске посещаемости (Product Hunt,
   Hacker News). У конкурентов лимит 100 GB приводит к паузе
   или блокировке сайта.

4. **PR previews** (K7). Автоматические preview deployments
   с комментариями в PR -- необходимо для workflow с ревью
   документации.

5. **DX** (K8). Framework preset для Docusaurus, пошаговый
   гайд в документации Cloudflare, интеграция с GitHub.

Компромиссы: dashboard менее интуитивен, чем у Vercel; для pnpm
может потребоваться дополнительная конфигурация build environment;
сообщество сообщает о спорадических проблемах с preview deployments.
Для масштаба agloom (~15 страниц, один мейнтейнер) эти минусы
несущественны.

### Альтернативы

- **GitHub Pages** -- запасной вариант при нулевом бюджете
  и отсутствии потребности в PR previews. Нативная интеграция
  с GitHub, soft bandwidth limits, бесплатные build minutes
  для публичных репозиториев.
- **Vercel Pro** -- при наличии бюджета $20/мес и приоритете
  developer experience. Лучший UX, но экономически невыгоден
  для чисто статического сайта.

### Отклоненные варианты

- **Netlify** -- кредитная модель (300 credits/мес) делает
  эффективные лимиты bandwidth (~30 GB) и деплоев (~20) значительно
  жестче конкурентов. Преимущества ослабли к 2026 году.
- **DO App Platform** -- 1 GiB bandwidth на бесплатном плане
  непригоден для production-документации (~3400 page views/мес).
- **VPS** -- неоправданные операционные затраты при наличии
  бесплатных managed-платформ с лучшим CDN. Существующий VPS
  на DigitalOcean целесообразно сохранить для других сервисов.

## Источники

- [Cloudflare Pages -- Pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Vercel Pricing](https://vercel.com/pricing)
- [Netlify Pricing](https://www.netlify.com/pricing/)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [DO App Platform Pricing](https://www.digitalocean.com/pricing/app-platform)
- [Docusaurus Deployment](https://docusaurus.io/docs/deployment)
- [Deploy Docusaurus -- Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-docusaurus-site/)
- [Deploying Docusaurus with Vercel](https://vercel.com/guides/deploying-docusaurus-with-vercel)
- [Best Hosting Platforms 2026 -- DEV Community](https://dev.to/_d7eb1c1703182e3ce1782/best-hosting-platforms-for-developers-in-2026-cloudflare-vs-vercel-vs-digitalocean-o1b)
- [Best Static Website Hosting: Free vs VPS](https://1vps.com/best-static-website-hosting)
- [6 Best Free Static Hosting -- Appwrite](https://appwrite.io/blog/post/best-free-static-website-hosting)
- [Hetzner Cloud VPS Pricing](https://costgoat.com/pricing/hetzner)
