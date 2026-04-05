---
type: research
summary: Детальный анализ DigitalOcean App Platform как платформы для хостинга документации agloom.
description: >-
  Оценка DigitalOcean App Platform (Static Sites) по критериям
  стоимости, CI/CD, CDN, bandwidth, build minutes, preview
  deployments и DX для статического Docusaurus-сайта.
relates:
  - docs/researches/hosting/RESEARCH.md
---

# DigitalOcean App Platform (Static Sites)

## Общие сведения

DigitalOcean App Platform -- PaaS от DigitalOcean с поддержкой
статических сайтов. Запущена в 2020 году. Включает бесплатный
tier для статики (до 3 приложений). Позиционируется как
альтернатива Vercel/Netlify внутри экосистемы DigitalOcean.

## Оценка по критериям

### K1. Стоимость

Бесплатный план: до 3 приложений со статическими сайтами.
Каждое приложение включает 1 GiB outbound data transfer
в месяц. Дополнительные приложения: $3/мес. Дополнительный
трафик: $0.02/GiB.

### K2. CI/CD интеграция

Интеграция с GitHub и GitLab. Автодеплой при push.
Настройка через dashboard или `app.yaml` spec файл.
Поддержка autodiscovery для Node.js проектов.

### K3. Кастомный домен + SSL

Бесплатный SSL на всех планах. Кастомные домены через
dashboard. DDoS protection включена по умолчанию.

### K4. CDN

DigitalOcean использует CDN, но с меньшим количеством
PoP по сравнению с Cloudflare или Vercel. Серверы
преимущественно в Северной Америке, Европе и Азии.
Для глобальной аудитории уступает специализированным
CDN-провайдерам.

### K5. Bandwidth limits

Бесплатный план: 1 GiB/мес -- критически мало. При
Docusaurus-бандле ~300 KB это ~3400 page views в месяц.
Для документационного сайта open-source проекта этого
недостаточно. Дополнительный трафик: $0.02/GiB.

### K6. Build minutes

Не документированы явно для бесплатного плана. Билды
запускаются автоматически при push. Лимиты менее прозрачны
по сравнению с конкурентами.

### K7. Preview deployments

Нет нативных PR preview deployments на бесплатном плане.
Доступно автоматическое разворачивание dev-веток, но
без интеграции с PR workflow в GitHub.

### K8. DX для Docusaurus

Нет специального Framework preset для Docusaurus.
Настройка вручную: build command `npx docusaurus build`,
output directory `build`. Поддержка Node.js и pnpm
через buildpacks. DX уступает Vercel и Cloudflare Pages.

## Плюсы

- Бесплатный план для статических сайтов -- легко начать.
- Интеграция с экосистемой DigitalOcean: если проект
  уже использует DO Droplets, все в одном аккаунте.
- SSL и DDoS protection из коробки.
- Простой переход от VPS к App Platform внутри DigitalOcean.

## Минусы

- 1 GiB bandwidth на бесплатном плане -- на порядок ниже
  конкурентов (Cloudflare: unlimited, остальные: 100 GB).
  Непригоден для production-документации.
- Отсутствие PR preview deployments.
- Нет Framework preset для Docusaurus -- ручная настройка.
- CDN-покрытие уступает Cloudflare и Vercel.
- Менее зрелая платформа для статического хостинга по
  сравнению с Vercel, Netlify и Cloudflare Pages.

## Контекст применимости

Оправдан только при условии привязки к экосистеме DigitalOcean
и готовности оплачивать трафик сверх 1 GiB. Для изолированного
документационного сайта экономически невыгоден по сравнению
с Cloudflare Pages (unlimited bandwidth бесплатно).

## Источники

- [App Platform Pricing -- DigitalOcean](https://www.digitalocean.com/pricing/app-platform)
- [App Platform Pricing -- DigitalOcean Documentation](https://docs.digitalocean.com/products/app-platform/details/pricing/)
- [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform)
