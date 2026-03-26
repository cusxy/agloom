---
summary: Provider overlay — копирование agent-специфичных файлов из overlays/
description: >
  Шаг provider overlay при транспиляции: копирование файлов из
  .agents/overlays/<adapterId>/ в target-директорию адаптера
  без трансформации содержимого.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
maps_to:
  - src/cli/
  - src/cli/types.ts
---

# Provider Overlay

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация добавляет шаг provider overlay в пайплайн
транспиляции (см. `docs/specs/cli.md` § Команда transpile).
Overlay позволяет пользователю размещать agent-специфичные файлы,
которые копируются в целевую директорию без трансформации.

## Структура директории overlays/

Директория `.agents/overlays/` содержит per-provider файлы,
организованные по идентификатору адаптера:

```text
.agents/
  overlays/
    claude/
      settings.json
      commands/
        my-cmd.md
    opencode/
      opencode.json
```

Файлы в `.agents/overlays/<adapterId>/` копируются
в `<entry.targetRoot>/` при транспиляции.

## Расширение TranspilerStepOutcome

Поле `name` типа `TranspilerStepOutcome`
(см. `docs/specs/cli.md` § Типы данных) ТРЕБУЕТСЯ расширить
допустимым значением `"Overlay"`:

- `name` (string: `"Instructions"` | `"Skills"` | `"Agents"` | `"Overlay"`)

## Операция overlay (cli:procedure)

Выполнение шага provider overlay — обнаружение и копирование
overlay-файлов в целевую директорию адаптера.

**Вход:**

- `entry` (AdapterRegistryEntry, обязательно) — запись адаптера из реестра.
- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.

**Поведение:**

1. Определить директорию-источник как
   `<projectRoot>/.agents/overlays/<entry.id>/`.
2. Рекурсивно обнаружить все файлы в директории-источнике.
3. Для каждого обнаруженного файла определить относительный путь
   файла внутри директории-источника.
4. Для каждого обнаруженного файла определить целевой путь как
   `<projectRoot>/<entry.targetRoot>/<относительный путь>`.
5. Для каждого обнаруженного файла создать промежуточные каталоги
   при необходимости.
6. Для каждого обнаруженного файла скопировать файл побайтово.
7. Сформировать `TranspilerStepOutcome` с `name: "Overlay"`,
   `writtenCount` и `errors`.

**Расширения:**

1a. Директория-источник не существует → вернуть
`TranspilerStepOutcome` с `writtenCount: 0` и пустым `errors`.

2a. Ошибка обхода директории (I/O-ошибка при чтении содержимого) →
вернуть `TranspilerStepOutcome` с `writtenCount: 0`
и `[errorMessage]` в `errors`.

5a. Ошибка создания промежуточного каталога → добавить сообщение
в `errors`, продолжить с оставшимися файлами.

6a. Ошибка копирования → добавить сообщение в `errors`,
продолжить с оставшимися файлами.

**Результат:**

`TranspilerStepOutcome` с `name: "Overlay"`.

## Приоритет

Overlay-файлы копируются ПОСЛЕ всех транспилерных шагов.
Если overlay-файл и каноническая транспиляция создают файл
с одинаковым путём, overlay-файл ДОЛЖЕН перезаписать каноническое
значение. Это позволяет пользователю переопределить каноническую
генерацию для конкретного провайдера.

## Расширение команды transpile

Команда `transpile` (см. `docs/specs/cli.md` § Команда transpile)
расширяется шагом provider overlay.

**Новые шаги:**

После шага 7 (Agents):

8. Выполнить операцию overlay (см. § Операция overlay).

**Изменения в существующих шагах:**

Шаги 8–11 оригинальной нумерации сдвигаются → 9–12.

Шаг 9 (бывший 8: «Отобразить результаты всех шагов») — порядок
отображения включает Overlay: Instructions → Skills → Agents → Overlay.

Шаг 10 (бывший 9: «Вычислить totalWritten как сумму writtenCount
всех трёх шагов») — `totalWritten` вычисляется как сумма
`writtenCount` всех четырёх шагов (Instructions, Skills, Agents, Overlay).

**Изменения в выводе:**

Шаг overlay отображается после остальных транспилерных шагов:

```text
  ✓ Overlay       4 files
```

Если `.agents/overlays/<adapterId>/` не существует:

```text
  ✓ Overlay       0 files
```

**Изменения в exit codes:**

Exit code учитывает ошибки шага overlay наравне
с остальными шагами.
