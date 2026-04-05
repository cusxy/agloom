---
type: research
summary: Анализ VPS (DigitalOcean, Hetzner) как альтернативы managed-хостингу для документации.
description: >-
  Оценка VPS-подхода (Nginx/Caddy на DigitalOcean или Hetzner)
  по критериям стоимости, CI/CD, CDN, bandwidth и DX для
  статического Docusaurus-сайта.
relates:
  - docs/researches/hosting/RESEARCH.md
---

# VPS (DigitalOcean / Hetzner)

## Общие сведения

VPS-подход предполагает размещение статических файлов на виртуальном
сервере под управлением Nginx или Caddy. Проект agloom уже использует
VPS на DigitalOcean, что обеспечивает знакомство команды с этим
подходом. Hetzner рассматривается как более экономичная альтернатива.

## Оценка по критериям

### K1. Стоимость

DigitalOcean Droplet: от $4/мес (1 vCPU, 512 MB RAM, 500 GB transfer).
Hetzner CX23: от EUR 3.99/мес (2 vCPU, 4 GB RAM, 20 TB transfer;
цена повышена с 1 апреля 2026).
Hetzner предлагает значительно больше ресурсов за сопоставимую цену.
На одном VPS можно разместить множество статических сайтов.

### K2. CI/CD интеграция

Требуется самостоятельная настройка: GitHub Actions workflow
для билда + scp/rsync/docker deploy. Дополнительная инфраструктура:
SSH-ключи в GitHub Secrets, deploy scripts. Нет zero-config решения.

### K3. Кастомный домен + SSL

SSL через Let's Encrypt + Certbot (или Caddy с автоматическим SSL).
Кастомные домены: A-записи на IP сервера. Требуется настройка
и мониторинг обновления сертификатов (автоматизируемо, но требует
начальной конфигурации).

### K4. CDN

Нет встроенного CDN. Сервер расположен в одном дата-центре.
Для глобальной аудитории необходимо добавить CDN (Cloudflare
бесплатный план или аналог). Без CDN -- latency зависит
от расстояния до дата-центра.

### K5. Bandwidth limits

DigitalOcean: 500 GB -- 1 TB в зависимости от плана.
Hetzner: 20 TB на минимальном плане -- значительно больше
конкурентов. Для статического сайта -- более чем достаточно.

### K6. Build minutes

Не применимо -- билд выполняется в GitHub Actions (бесплатно
для публичных репозиториев) или на самом VPS.

### K7. Preview deployments

Отсутствуют. Реализация требует значительных усилий:
отдельные виртуальные хосты для каждого PR, автоматизация
создания/удаления, DNS wildcard. Практически нецелесообразно
для документационного сайта.

### K8. DX для Docusaurus

Нет специфической поддержки. Стандартный процесс: `npx
docusaurus build` локально или в CI, затем копирование
`build/` директории на сервер. Конфигурация Nginx для
SPA fallback и кеширования -- manual setup.

## Плюсы

- Полный контроль над инфраструктурой: конфигурация
  Nginx, заголовки, redirects, rate limiting.
- Возможность размещения дополнительных сервисов
  на том же VPS (API, мониторинг, analytics).
- Hetzner предлагает 20 TB bandwidth за EUR 3.99/мес --
  лучшее соотношение bandwidth/цена.
- Отсутствие vendor lock-in.

## Минусы

- Значительные операционные затраты: настройка и поддержка
  сервера, обновления ОС, мониторинг uptime, бэкапы.
- Отсутствие CDN из коробки -- требуется дополнительная
  настройка (Cloudflare proxy или аналог).
- Нет preview deployments -- критично для командной
  работы.
- CI/CD требует ручной настройки.
- Single point of failure: один сервер в одном дата-центре.
  Downtime при обновлениях или сбоях.

## Контекст применимости

Оправдан при наличии существующего VPS, используемого для других
сервисов, и готовности инвестировать время в DevOps. Для
изолированного статического документационного сайта -- неоправданно
сложен по сравнению с managed-платформами (Cloudflare Pages
предлагает лучший CDN бесплатно и без операционных затрат).

## Источники

- [DigitalOcean Pricing](https://www.digitalocean.com/pricing)
- [Hetzner Cloud VPS Pricing](https://costgoat.com/pricing/hetzner)
- [Best Static Website Hosting: Free Options vs VPS](https://1vps.com/best-static-website-hosting)
- [Best Hosting Platforms for Developers 2026 -- DEV Community](https://dev.to/_d7eb1c1703182e3ce1782/best-hosting-platforms-for-developers-in-2026-cloudflare-vs-vercel-vs-digitalocean-o1b)
