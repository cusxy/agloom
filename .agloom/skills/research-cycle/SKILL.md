---
name: research-cycle
description: >-
  Оркестрирует цикл генерации и валидации исследования
  (generate → validate). Используй для создания исследовательского
  документа с анализом объектов и обоснованием выводов.
blueprint: schemas/draft/skill.schema.yml
---

# Research Cycle

Ты — оркестратор цикла **generate → validate** для исследовательских документов.

## Общие документы

Тебе ТРЕБУЕТСЯ прочитать перед началом работы:

- Протокол оркестрации: [orchestrator-protocol.md](${agloom:PROJECT_DIR}/${agloom:AGLOOM_DOCS_DIR}/cycling/orchestrator-protocol.md).

## Сценарий

### Фазы

| Фаза     | Исполнитель       | Reviewer            |
| -------- | ----------------- | ------------------- |
| Generate | `research-writer` | `research-reviewer` |

### Определение scope

- Продуктовые решения → `docs/researches/<topic>.md`
- Инфраструктура агентов / процессов → `.agloom/docs/<topic>.md`

## Definition of Ready

Перед запуском цикла проверь:

- `dor-1`: Проведено уточнение требований (pre-cycle clarification) по процедуре
  из [Уточнение требований](${agloom:PROJECT_DIR}/${agloom:AGLOOM_DOCS_DIR}/cycling/orchestrator-protocol.md#уточнение-требований-pre-cycle-clarification).
- `dor-2`: Определена тема исследования (из запроса пользователя или context).
- `dor-3`: Определён целевой путь файла (существующий или новый).
- `dor-4`: Для существующих файлов: файл найден и доступен для чтения.

## Definition of Done

Цикл завершён когда:

- `dod-1`: research-reviewer прошёл с `verdict: pass`.
- `dod-2`: Файл исследования содержит корректный front matter (`type: research`).
- `dod-3`: Форматирование Markdown: `pnpm run fmt:md` выполнен без ошибок.
- `dod-4`: Валидация документа: проверки doc-validator пройдены без ошибок
  (`doc:frontmatter`, `doc:structure`, `doc:references`, `doc:links`, `doc:prose`, `doc:review`).
- `dod-5`: Пользователь подтвердил завершение цикла (human-in-the-loop,
  см. [Валидация на границах фаз](${agloom:PROJECT_DIR}/${agloom:AGLOOM_DOCS_DIR}/cycling/orchestrator-protocol.md#валидация-на-границах-фаз-human-in-the-loop)).
- `dod-6`: Сводка результатов выведена.

## Сводка

После завершения цикла ТРЕБУЕТСЯ вывести:

- Тема исследования.
- Принятые решения (из секции «Заключение» документа).
- Количество итераций (сколько раз запускался writer).
- Если были возвраты — краткое описание замечаний reviewer.
