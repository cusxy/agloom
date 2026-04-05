---
name: docs-cycle
description: >-
  Оркестрирует цикл генерации и валидации пользовательской
  документации (write → review). Используй для создания
  или обновления docs/guide/ и docs/reference/.
blueprint: schemas/draft/skill.schema.yml
---

# Docs Cycle

Ты — оркестратор цикла **write → review** для пользовательской документации.

## Общие документы

Тебе ТРЕБУЕТСЯ прочитать перед началом работы:

- Протокол оркестрации: [orchestrator-protocol.md](/Users/cusxies/Development/MyProjects/agloom/.claude/docs/cycling/orchestrator-protocol.md).

## Сценарий

### Фазы

| Фаза  | Исполнитель   | Reviewer        |
| ----- | ------------- | --------------- |
| Write | `docs-writer` | `docs-reviewer` |

### Определение scope

Scope определяется одним из двух способов:

- **Пользователь указал** — конкретные doc-файлы (`docs/guide/*.md`,
  `docs/reference/*.md`) или спецификации (`docs/specs/*.md`), по которым
  нужно обновить документацию.
- **Auto-detect** — оркестратор анализирует контекст (какие спецификации
  или код изменились) и определяет затронутые doc-файлы. Маппинг
  спецификация → документация определяется через
  [docs-structure.md](../../docs/specs/docs-structure.md) (секция relates
  и описание каждого документа).

Правила определения целевых файлов:

- Новая спецификация → определить, какие doc-файлы из docs-structure.md
  покрывают описанную функциональность, добавить их в scope.
- Изменение существующей спеки → найти doc-файлы, ссылающиеся
  на эту спеку, добавить в scope.
- Прямое указание doc-файла → использовать as-is.

README.md — вне scope цикла.

## Definition of Ready

Перед запуском цикла проверь:

- `dor-1`: Проведено уточнение требований (pre-cycle clarification) по процедуре
  из [Уточнение требований](/Users/cusxies/Development/MyProjects/agloom/.claude/docs/cycling/orchestrator-protocol.md#уточнение-требований-pre-cycle-clarification).
- `dor-2`: Scope содержит хотя бы один doc-файл (существующий или путь
  для нового).
- `dor-3`: Для существующих doc-файлов: файлы найдены и доступны для чтения.
- `dor-4`: Спецификация структуры документации
  [docs-structure.md](../../docs/specs/docs-structure.md) доступна для чтения.
- `dor-5`: Для каждого doc-файла в scope определены связанные спецификации
  (через docs-structure.md relates или описание содержания).

## Definition of Done

Цикл завершён когда:

- `dod-1`: docs-reviewer прошёл с `verdict: pass`.
- `dod-2`: Все doc-файлы в scope созданы или обновлены.
- `dod-3`: Frontmatter каждого файла содержит `title`, `description`, `order`.
- `dod-4`: Форматирование: `pnpm run fmt:md` выполнен без ошибок.
- `dod-5`: Пользователь подтвердил завершение цикла (human-in-the-loop,
  см. [Валидация на границах фаз](/Users/cusxies/Development/MyProjects/agloom/.claude/docs/cycling/orchestrator-protocol.md#валидация-на-границах-фаз-human-in-the-loop)).
- `dod-6`: Сводка результатов выведена.

## Сводка

После завершения цикла ТРЕБУЕТСЯ вывести:

- Список созданных и обновлённых doc-файлов.
- Какие спецификации использовались как источники.
- Количество итераций (сколько раз запускался docs-writer).
- Если были возвраты — краткое описание замечаний docs-reviewer.
