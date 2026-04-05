---
type: research
summary: Детальный анализ GitHub Pages как платформы для хостинга документации agloom.
description: >-
  Оценка GitHub Pages по критериям стоимости, CI/CD, CDN,
  bandwidth, build minutes, preview deployments и DX для
  статического Docusaurus-сайта.
relates:
  - docs/researches/hosting/RESEARCH.md
---

# GitHub Pages

## Общие сведения

GitHub Pages -- бесплатный статический хостинг, встроенный в GitHub.
Доступен для публичных репозиториев на GitHub Free и для приватных
на GitHub Pro/Team/Enterprise. Поддерживает Jekyll из коробки
и произвольные SSG через GitHub Actions.

## Оценка по критериям

### K1. Стоимость

Полностью бесплатен для публичных репозиториев. Один user/org site
и неограниченное количество project sites. Для open-source agloom --
нулевая стоимость.

### K2. CI/CD интеграция

Деплой через GitHub Actions (рекомендуемый способ для Docusaurus).
Workflow: build в Actions, деплой артефакта. Настройка требует
написания YAML workflow файла -- не zero-config. Docusaurus
предоставляет пример workflow в документации.

### K3. Кастомный домен + SSL

Бесплатный SSL через Let's Encrypt. Кастомные домены
поддерживаются: CNAME для поддоменов, A-записи для apex.
Автоматическое обновление сертификатов.

### K4. CDN

GitHub Pages использует CDN Fastly. Производительность приемлема,
но уступает Cloudflare (300+ PoP) по глобальному покрытию.
Для документационного сайта с аудиторией преимущественно
в dev-сообществе -- достаточно.

### K5. Bandwidth limits

Soft limit 100 GB/мес. При превышении -- вежливое письмо от
GitHub Support с рекомендациями (CDN перед сайтом, GitHub
Releases для больших файлов, альтернативный хостинг). Сайт
не блокируется немедленно, но систематическое превышение
может привести к ограничениям.

### K6. Build minutes

GitHub Actions предоставляет 2000 минут/мес для бесплатных
аккаунтов (публичные репозитории -- неограниченно). Лимит
GitHub Pages: 10 билдов в час. Для Docusaurus с ~15 страницами --
более чем достаточно.

### K7. Preview deployments

GitHub Pages не поддерживает preview deployments нативно.
Один репозиторий -- один сайт. Реализация PR previews
требует сторонних Actions и дополнительной инфраструктуры
(например, деплой preview на отдельную ветку или внешний
сервис). Это существенное ограничение для командной работы.

### K8. DX для Docusaurus

Docusaurus предоставляет официальную документацию по деплою
на GitHub Pages, включая пример GitHub Actions workflow.
Требуется настройка `url` и `baseUrl` в `docusaurus.config.js`.
Для project site URL будет `<org>.github.io/<repo>/` --
не идеален для кастомного домена (нужна дополнительная
настройка). Нюанс: `trailingSlash` может требовать настройки.

## Плюсы

- Нулевая стоимость для open-source проектов.
- Нативная интеграция с GitHub -- репозиторий и хостинг
  в одном месте. Минимальная когнитивная нагрузка.
- Soft limits -- сайт не блокируется при кратковременном
  превышении bandwidth.
- Высокая стабильность и надежность (GitHub SLA).
- Неограниченные build minutes для публичных репозиториев.

## Минусы

- Отсутствие preview deployments -- критично для workflow
  с PR-ревью документации.
- Один сайт на репозиторий -- ограничение при раздельном
  сценарии (landing + docs на разных доменах).
- Настройка деплоя не zero-config: требуется GitHub Actions
  workflow файл и конфигурация Docusaurus.
- CDN-покрытие уступает Cloudflare.
- Ограничение на 1 GB размера репозитория -- несущественно
  для документации, но формально существует.

## Контекст применимости

Оправдан для open-source проектов с минимальными требованиями
к workflow: одиночный мейнтейнер, редкие обновления документации,
отсутствие потребности в PR previews. Менее подходит для активной
командной работы над документацией.

## Источники

- [GitHub Pages limits -- GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [What is GitHub Pages -- GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Docusaurus -- Deployment to GitHub Pages](https://docusaurus.io/docs/deployment)
- [Docusaurus GitHub Pages Deployment -- FreeCodeCamp](https://www.freecodecamp.org/news/set-up-docs-as-code-with-docusaurus-and-github-actions/)
