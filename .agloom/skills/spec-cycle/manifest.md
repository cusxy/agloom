---
summary: Manifest компонентов spec-cycle
description: >-
  Единый реестр компонентов системы spec-cycle — оркестратор,
  агенты, общие документы, граф переходов
blueprint: schemas/draft/doc.schema.yml
relates:
  - ${agloom:PROJECT_DIR}/${agloom:AGLOOM_SKILLS_DIR}/spec-cycle/SKILL.md
---

# Manifest

## Оркестратор

- [SKILL.md](SKILL.md)

## Агенты

| Агент            | Файл                                                    | Фаза      | Роль        | Описание                                                    |
| ---------------- | ------------------------------------------------------- | --------- | ----------- | ----------------------------------------------------------- |
| spec-writer      | [spec-writer.md](${agloom:PROJECT_DIR}/${agloom:AGLOOM_AGENTS_DIR}/spec-writer.md)           | Specify   | Исполнитель | Создаёт и исправляет спецификации модулей                   |
| spec-reviewer    | [spec-reviewer.md](${agloom:PROJECT_DIR}/${agloom:AGLOOM_AGENTS_DIR}/spec-reviewer.md)       | Specify   | Reviewer    | Проверяет непротиворечивость, полноту и формат спецификаций |
| test-deriver     | [test-deriver.md](${agloom:PROJECT_DIR}/${agloom:AGLOOM_AGENTS_DIR}/test-deriver.md)         | Test      | Исполнитель | Выводит failing tests из спецификаций (red TDD)             |
| test-reviewer    | [test-reviewer.md](${agloom:PROJECT_DIR}/${agloom:AGLOOM_AGENTS_DIR}/test-reviewer.md)       | Test      | Reviewer    | Проверяет покрытие спецификации тестами и философию TDD     |
| spec-implementer | [spec-implementer.md](${agloom:PROJECT_DIR}/${agloom:AGLOOM_AGENTS_DIR}/spec-implementer.md) | Implement | Исполнитель | Реализует код по спецификации — делает тесты зелёными       |
| impl-reviewer    | [impl-reviewer.md](${agloom:PROJECT_DIR}/${agloom:AGLOOM_AGENTS_DIR}/impl-reviewer.md)       | Implement | Reviewer    | Проверяет соответствие кода спецификации и конвенциям       |

## Общие документы

| Документ       | Файл                                                      | Описание                                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| agent-protocol | [agent-protocol.md](${agloom:PROJECT_DIR}/${agloom:AGLOOM_DOCS_DIR}/cycling/agent-protocol.md) | Протокол ввода/вывода, findings, DoR/DoD, структура агента |
| spec-format    | [spec-format.md](docs/spec-format.md)                     | Формат операций и правила написания спецификаций           |
| service types  | [service.md](docs/types/service.md)                       | Шаблоны операций backend-сервиса                           |
| library types  | [library.md](docs/types/library.md)                       | Шаблоны операций библиотеки                                |

## Граф переходов

```text
spec-writer → spec-reviewer → test-deriver → test-reviewer → spec-implementer → impl-reviewer
     ↑              |               ↑              |                ↑                |
     └──────────────┘               └──────────────┘                └────────────────┘
     (при замечаниях)               (при замечаниях)                (при замечаниях)
```
