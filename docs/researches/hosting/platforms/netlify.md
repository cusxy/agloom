---
type: research
summary: Детальный анализ Netlify как платформы для хостинга документации agloom.
description: >-
  Оценка Netlify по критериям стоимости, CI/CD, CDN, bandwidth,
  build minutes, preview deployments и DX для статического
  Docusaurus-сайта.
relates:
  - docs/researches/hosting/RESEARCH.md
---

# Netlify

## Общие сведения

Netlify -- пионер Git-to-deploy workflow для статических сайтов.
Основана в 2014 году. В 2025 году перешла на кредитную модель
биллинга. Планы: Free (бесплатный), Personal ($9/user/мес),
Pro ($20/user/мес).

## Оценка по критериям

### K1. Стоимость

С сентября 2025 года для новых аккаунтов действует кредитная
модель: бесплатный план включает 300 credits/мес. Расход:
bandwidth -- 10 credits/GB, deploy -- 15 credits. При бюджете
300 credits это эквивалентно ~30 GB bandwidth при нулевых
деплоях или ~20 деплоев при минимальном трафике. Кредитная
карта не требуется. Коммерческое использование разрешено.

Для legacy-аккаунтов (до сентября 2025) сохраняются прежние
лимиты: 100 GB bandwidth, 300 build minutes, 125 000 serverless
function invocations в месяц.

### K2. CI/CD интеграция

Нативная интеграция с GitHub, GitLab, Bitbucket. Автодеплой
при push. Netlify помог популяризовать Git-to-deploy workflow.
Настройка через `netlify.toml` или dashboard.

### K3. Кастомный домен + SSL

Бесплатный SSL через Let's Encrypt на всех планах. Кастомные
домены через dashboard. Автоматическое обновление сертификатов.

### K4. CDN

Global CDN. Для статических сайтов производительность
сопоставима с Vercel и Cloudflare. Instant rollbacks
на предыдущие деплои.

### K5. Bandwidth limits

Кредитная модель (новые аккаунты): bandwidth расходует
10 credits/GB из общего пула 300 credits/мес. Эффективный
лимит зависит от расхода credits на деплои и functions.
При превышении -- сайт приостанавливается до нового цикла.

Legacy-аккаунты: 100 GB/мес (hard limit). Personal:
100 GB + оплата овеража ($20/100 GB). Pro: 1 TB/мес.

### K6. Build minutes

Кредитная модель (новые аккаунты): каждый deploy расходует
15 credits из пула 300 credits/мес, что эквивалентно ~20
деплоям (без учета bandwidth). Для Docusaurus-сайта с ~15
страницами (билд ~1-2 минуты) лимит покрывает типичный
workflow, но значительно жестче legacy-лимитов.

Legacy-аккаунты: 300 build minutes/мес.

### K7. Preview deployments

Автоматический deploy preview для каждого PR. Комментарий
в PR с ссылкой. Netlify первым внедрил эту функциональность.
Deploy previews доступны на бесплатном плане.

### K8. DX для Docusaurus

Docusaurus указан в официальной документации Netlify.
Настройка: build command `npm run build`, publish directory
`build`. Важный нюанс: Netlify включает Pretty URLs
по умолчанию, что требует настройки `trailingSlash`
в `docusaurus.config.js` для корректной работы.

## Плюсы

- Зрелая платформа с предсказуемым поведением.
- Дополнительные бесплатные возможности: form handling,
  identity, split testing -- полезны при расширении сайта
  за пределы документации.
- Deploy previews из коробки с хорошим UX.
- Коммерческое использование разрешено на бесплатном плане.

## Минусы

- Переход на кредитную модель биллинга (2025) усложнил
  понимание лимитов. Поведение при превышении -- сайт
  приостанавливается (а не деградирует).
- Кредитная модель (300 credits/мес) делает эффективные лимиты
  bandwidth и деплоев взаимозависимыми: больше деплоев --
  меньше bandwidth, и наоборот. При превышении сайт полностью
  недоступен.
- Конкурентные преимущества Netlify ослабли к 2026 году:
  Cloudflare Pages предлагает больше за бесплатно, а DX
  Vercel превосходит Netlify.

## Контекст применимости

Оправдан для проектов, которые используют дополнительные
возможности Netlify (forms, identity, edge functions).
Для чисто статического сайта -- функционально эквивалентен
Vercel Hobby, но с менее предсказуемой кредитной моделью.

## Источники

- [Netlify Pricing](https://www.netlify.com/pricing/)
- [Netlify Free Plan](https://www.netlify.com/blog/introducing-netlify-free-plan/)
- [Netlify Billing FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/)
- [Docusaurus Deployment -- Netlify](https://docusaurus.io/docs/deployment)
- [Netlify Free Tier Limits 2026 -- Temps](https://temps.sh/blog/temps-vs-coolify-vs-netlify)
