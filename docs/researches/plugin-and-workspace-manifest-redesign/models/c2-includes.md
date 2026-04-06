---
type: research
summary: Модель C2 — Includes (composition без понятия плагина)
description: >-
  Отказ от понятия «плагин» как такового. Вместо него —
  include-механизм: config.yml ссылается на другие config.yml
  или на директории с layer-вкладами.
relates:
  - docs/researches/plugin-and-workspace-manifest-redesign/RESEARCH.md
---

# Модель C2 — Includes (composition)

## Описание

Упразднить понятие «плагин» и `plugin.yml`. Вместо них —
механизм `includes:` в `config.yml`, который загружает
другие `config.yml` (или просто поддиректории с layer-структурой).
Каждый include вносит свой слой в порядке объявления.

```yaml
# .agloom/config.yml
adapters: [claude, opencode]
includes:
  - ./.agloom/shared/team-rules
  - ./.agloom/shared/ci-rules
  - ../other-project/.agloom/shared/common
```

`.agloom/shared/team-rules/` содержит либо свой `config.yml`
(с подмножеством полей — только `variables:` и `includes:`),
либо просто флэт-структуру `skills/ agents/ overlays/`.

Идея перекликается с Kustomize `bases:` и Ansible `include_tasks:`.

## Плюсы

- **C2+1**. Самая простая ментальная модель для primary use
  case: «скопируй кусок конфига отсюда». Никаких identity-полей,
  никаких версий, никаких запретов.
- **C2+2**. Composition — универсальный примитив. Include может
  ссылаться на include, транзитивность получается тривиально.
- **C2+3**. Никаких отдельных типов манифестов — только один
  `config.yml` с опциональными полями.

## Минусы

- **C2-1 (fatal для secondary)**. Distribution через git-ref
  ломается: чтобы подключить внешний набор правил, пользователь
  должен выполнить `git clone` вручную либо Agloom должен
  научиться клонировать «не плагины». Потеря всей
  инфраструктуры `git-plugin-loading.md` (кеш с TTL, resolve
  SHA, auth) — либо придётся дублировать её для includes,
  что возвращает сложность через заднюю дверь.
- **C2-2**. Нет identity у включаемого набора — невозможно
  декларировать «targets», нельзя предотвратить имя-конфликты
  между разными includes (два include с одинаковыми skill
  именами молча перезаписывают друг друга через layer-model).
- **C2-3**. Нельзя опубликовать набор правил в реестр
  (даже в будущий централизованный реестр) — нет identity.
- **C2-4**. Теряется partial-success и fail-fast семантика
  `Resolve Plugins`, которая завязана на identity плагина
  (см. `plugin-loading.md` § Стратегия обработки ошибок).
- **C2-5**. Breaking change всей реализации: `plugin-manifest.md`,
  `plugin-loading.md`, `plugin-values.md`, `git-plugin-loading.md` —
  переписываются или удаляются. Существующий внешний плагин
  `cusxy/skill-cycling` ломается.

## Контекст применимости

- **Оправдано, если**: Agloom отказывается от distribution
  как use case вовсе, фокусируясь только на composition внутри
  организации.
- **Не оправдано, если**: secondary use case (git-distribution)
  остаётся в скоупе, что прямо указано в context.

## Оценка по критериям

| K   | Значение | Обоснование                                       |
| --- | -------- | ------------------------------------------------- |
| K1  | high     | composition — идеальный примитив для primary      |
| K2  | **low**  | ломает git-plugin distribution                    |
| K3  | yes      | никаких identity-полей                            |
| K4  | medium   | семантика чистая, но теряется роль «плагин»       |
| K5  | yes      | тривиально                                        |
| K6  | medium   | новый механизм includes, код resolve переписан    |
| K7  | large    | переписать или удалить 4+ спецификации            |
| K8  | low      | ломает часть контракта Resolve Plugins            |
| K9  | medium   | знакомо пользователям kustomize/ansible           |
| K10 | hard     | transitive deps = deep include chain без identity |

## Вердикт

**Отвергнута.** Проваливает K2, K7, K8, K10. Модель привлекательна
для узкого use case, но несовместима с secondary use case
и breaking change стоимостью. Приводится для полноты и как
источник идей для будущих фич (например, опциональный `includes:`
в дополнение к `plugins:` — вне scope данного исследования).
