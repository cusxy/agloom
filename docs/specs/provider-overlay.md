---
summary: Provider overlay — копирование agent-специфичных файлов из overlays/
description: >
  Шаг provider overlay при транспиляции: копирование файлов из
  .agloom/overlays/<adapterId>/ в target-директорию адаптера
  с интерполяцией переменных для текстовых файлов (whitelist
  расширений) и побайтовым копированием остальных.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/interpolation.md
  - docs/specs/layer-model.md
  - docs/specs/plugin-manifest.md
  - docs/specs/plugin-loading.md
  - docs/specs/patch-mechanism.md
  - docs/specs/plugin-values.md
  - docs/specs/permissions-transpiler.md
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
которые копируются в целевую директорию. Текстовые файлы
с расширениями из whitelist проходят интерполяцию переменных
(см. `docs/specs/interpolation.md`) перед записью; остальные файлы
копируются побайтово.

## Структура директории overlays/

Директория `.agloom/overlays/` содержит per-provider файлы,
организованные по идентификатору адаптера:

```text
.agloom/
  overlays/
    claude/
      .claude/
        settings.json
        commands/
          my-cmd.md
      .mcp.json
    opencode/
      .opencode/
        opencode.json
```

Файлы в `.agloom/overlays/<adapterId>/` отражают свою позицию
относительно project root. При транспиляции они копируются
в `<projectRoot>/<относительный путь>`.

## Whitelist расширений для интерполяции

Константа `INTERPOLATABLE_EXTENSIONS` определяет набор расширений
файлов, для которых выполняется интерполяция переменных при
копировании overlay-файлов. Файлы с расширениями, не входящими
в whitelist, ДОЛЖНЫ копироваться побайтово без изменений.

Значение (массив строк, case-insensitive при сравнении):

```text
.md, .txt, .json, .jsonc, .jsonl, .xml, .html, .svg, .toml, .yml, .yaml
```

Сравнение расширения файла ДОЛЖНО быть case-insensitive
(например, `.MD` и `.md` обрабатываются одинаково).

## Расширение TranspilerStepOutcome

Поле `name` типа `TranspilerStepOutcome`
(см. `docs/specs/cli.md` § Типы данных) ТРЕБУЕТСЯ расширить
допустимым значением `"Overlay"`:

- `name` (string: `"Instructions"` | `"Skills"` | `"Agents"` | `"Overlay"`)

## Операция overlay (cli:procedure)

Выполнение шага provider overlay — обнаружение, интерполяция
и копирование overlay-файлов в целевую директорию адаптера.

**Вход:**

- `entry` (AdapterRegistryEntry, обязательно) — запись адаптера из реестра.
- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
- `variables` (Record\<string, string>, опционально) — карта
  agloom-переменных (результат `buildVariables`,
  см. `docs/specs/interpolation.md` § Построение карты переменных).
  Если параметр передан, интерполяция выполняется для файлов
  с расширениями из whitelist. Если не передан, все файлы
  копируются побайтово (обратная совместимость).
- `env` (Record\<string, string | undefined>, опционально,
  default: `process.env`) — объект окружения для разрешения
  `${env:VAR}`. Передаётся в `interpolate()`.

**Поведение:**

1. Определить директорию-источник как
   `<projectRoot>/.agloom/overlays/<entry.id>/`.
2. Рекурсивно обнаружить все файлы в директории-источнике.
3. Для каждого обнаруженного файла определить относительный путь
   файла внутри директории-источника.
4. Для каждого обнаруженного файла определить целевой путь как
   `<projectRoot>/<относительный путь>`.
5. Для каждого обнаруженного файла создать промежуточные каталоги
   при необходимости.
6. Для каждого обнаруженного файла определить расширение файла.
7. Если `variables` передан И расширение файла входит
   в `INTERPOLATABLE_EXTENSIONS` (case-insensitive) — прочитать
   содержимое файла-источника с кодировкой UTF-8, вызвать
   `interpolate(content, variables, env)`
   (см. `docs/specs/interpolation.md` § Интерполяция контента),
   записать результат в целевой путь с кодировкой UTF-8.
8. Иначе — скопировать файл побайтово из источника в целевой путь.
9. Сформировать `TranspilerStepOutcome` с `name: "Overlay"`,
   `writtenCount` и `errors`.

**Расширения:**

1a. Директория-источник не существует → вернуть
`TranspilerStepOutcome` с `writtenCount: 0` и пустым `errors`.

2a. Ошибка обхода директории (I/O-ошибка при чтении содержимого) →
вернуть `TranspilerStepOutcome` с `writtenCount: 0`
и `[errorMessage]` в `errors`.

5a. Ошибка создания промежуточного каталога → добавить сообщение
в `errors`, продолжить с оставшимися файлами.

7a. `interpolate` выбрасывает `InterpolationError` → добавить
сообщение `"Interpolation failed for {относительный путь}: {причина}"`
в `errors`, продолжить с оставшимися файлами.

7b. Ошибка чтения или записи файла (I/O-ошибка) → добавить
сообщение в `errors`, продолжить с оставшимися файлами.

8a. Ошибка копирования → добавить сообщение в `errors`,
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

В цикле по записям (шаг 4), после подшага 4.4 (Agents):

4.5. Выполнить операцию overlay (см. § Операция overlay)
с `entry`, `projectRoot` и `variables` (карта переменных,
построенная для текущей записи,
см. `docs/specs/interpolation.md`
§ Расширение команды transpile).

Подшаг 4.5 оригинальной нумерации (отобразить результаты)
сдвигается → 4.6.

**Изменения в существующих шагах:**

Шаг 4.6 (бывший 4.5: «Отобразить результаты шагов в TUI») — порядок
отображения включает Overlay: Instructions → Skills → Agents → Overlay.

Шаг 5 («Вычислить totalWritten как сумму writtenCount всех шагов») —
`totalWritten` вычисляется как сумма `writtenCount` всех четырёх шагов
(Instructions, Skills, Agents, Overlay).

**Изменения в выводе:**

Шаг overlay отображается после остальных транспилерных шагов:

```text
  ✓ Overlay       4 files
```

Если `.agloom/overlays/<adapterId>/` не существует:

```text
  ✓ Overlay       0 files
```

**Изменения в exit codes:**

Exit code учитывает ошибки шага overlay наравне
с остальными шагами.
