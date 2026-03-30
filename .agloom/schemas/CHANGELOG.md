---
summary: История изменений схем документов
description: >-
  Фиксирует изменения, breaking changes и миграции
  для схем типов документов
blueprint: schemas/draft/doc.schema.yml
---

# Changelog

## draft (2026-03-15)

Начальная разработка системы типизации документов. Схемы находятся в канале `draft/` —
breaking changes допускаются без церемонии до graduation в `v1/`.

### Компоненты

- `meta-schema.json` — мета-схема (vocabulary определений типов)
- `draft/spec.schema.yml` — спецификация модуля
- `draft/index.schema.yml` — index-файл папки
- `draft/doc.schema.yml` — информационный документ
- `draft/research.schema.yml` — исследование и анализ
- `draft/manifest.schema.yml` — реестр компонентов
- `draft/agent.schema.yml` — определение агента

### Источники правил

Определения типов основаны на:

- `.claude/docs/document-meta-schema.md` — исследование мета-схемы
- `CLAUDE.md` — конвенции проекта (front matter, структура документации)
