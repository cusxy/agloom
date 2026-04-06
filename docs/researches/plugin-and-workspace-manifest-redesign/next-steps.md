---
type: research
summary: Дерево spec-cycles и открытые вопросы для редизайна манифестов agloom
description: >-
  Последовательность spec-cycles для реализации рекомендованной
  модели B и открытые вопросы, требующие решения пользователя
  перед запуском реализации.
relates:
  - docs/researches/plugin-and-workspace-manifest-redesign/RESEARCH.md
---

# Дерево spec-cycles и открытые вопросы

## Дерево spec-cycles

В порядке зависимостей:

1. **lift-config-yml-ban-in-plugin** — снять запрет `config.yml`
   в плагине. Изменение: `plugin-manifest.md` § Соответствие
   структуре `.agloom/`. Без кода.
2. **in-tree-subplugins-convention** — описать
   `.agloom/plugins/` как рекомендуемую локацию для подплагинов.
   Изменения: `plugin-loading.md`, возможно `init-command.md`.
   Код минимален — относительные пути уже работают через
   существующую `Resolve Plugins`.
3. **plugin-targets-field** — опциональное `targets:` в
   `plugin.yml`. Изменения: `plugin-manifest.md`,
   `plugin-loading.md`. Код: парсинг, валидация, warning
   при пустом пересечении.
4. **variables-cross-reference-fix** — cross-reference
   `VariableDeclaration` из `config.md`. Без кода.
5. **transitive-plugin-deps** — поле `plugins:` в `plugin.yml`
   и процедура Resolve Transitive Plugins (DFS, циклы,
   first-wins). Существенная работа в `src/cli/resolve-plugins.ts`.
6. **docs-and-migration** — обновить `docs/reference/config.md`
   и пользовательский guide с примерами in-tree и транзитивных
   зависимостей.

Параллельно могут идти 1, 2, 4. Шаг 3 зависит от 1, 2.
Шаг 5 зависит от 1, 2, 3. Шаг 6 — последний.

## Открытые вопросы

- **OQ1**. Имя поля: `targets:` (рекомендация), `supports:`
  или `compatibleWith:`?
- **OQ2**. Пустое пересечение `targets` ∩ `config.adapters`:
  warning (рекомендация) или fail-fast? Fail-fast блокирует
  валидные сценарии (плагин с overlay для пяти адаптеров,
  проект использует один).
- **OQ3**. Конфликт версий в транзитивном графе:
  first-wins + warning (рекомендация) или fail-fast?
  Fail-fast проще, но блокирует diamond dependency без ручного
  override.
- **OQ4**. Нужен ли explicit override (`resolutions` как в yarn,
  `overrides` как в npm) в `config.yml` на v1? Рекомендация:
  нет до появления use case.
- **OQ5**. Должен ли `init` создавать `.agloom/plugins/`
  (пустая директория с `.gitkeep`) при scaffolding? Решение
  косметическое.
- **OQ6**. `version: 0.0.0` как соглашение для in-tree
  подплагинов — допустимо? Явный маркер `version: "in-tree"`
  ломает существующую semver-валидацию (см.
  `plugin-manifest.md` § Валидация версии), поэтому строковое
  соглашение `0.0.0` предпочтительнее.
