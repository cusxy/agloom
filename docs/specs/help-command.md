---
summary: Команда help — рендеринг Markdown-документации в терминал
description: >
  Команда agloom help для отображения категоризированного списка help topics
  и рендеринга Markdown-файлов из docs/guide/ и docs/reference/ в терминал
  через marked + marked-terminal.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/ci-deploy.md
  - docs/researches/cli-documentation-delivery/RESEARCH.md
  - docs/specs/docusaurus-setup.md
  - docs/specs/cli-global-flags.md
maps_to:
  - src/cli/
---

# Команда help

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация добавляет команду `help` в CLI
(см. `docs/specs/cli.md`). Команда отображает категоризированный
список доступных help topics или рендерит содержимое конкретного
topic из Markdown-файлов в терминал.

Документация хранится в Markdown-файлах в директориях `docs/guide/`
и `docs/reference/` и поставляется в npm-пакете. Подход вдохновлён
GitHub CLI (`gh help <topic>`), но с обратной flow: документация
хранится в файлах и рендерится в TUI, а не хранится в коде
и генерируется в docs
(см. `docs/researches/cli-documentation-delivery/RESEARCH.md`).

Команда `help` и флаг `--help` — это РАЗНЫЕ механизмы:

- `agloom --help` — краткая справка со списком команд
  (см. `docs/specs/cli.md` § --help).
- `agloom help` — перечень доступных help topics с группировкой
  по категориям.
- `agloom help <topic>` — рендер конкретного topic в терминал.

## Зависимости

Команда `help` добавляет следующие зависимости в `package.json`:

- `marked` — парсер Markdown.
- `marked-terminal` — рендерер Markdown для терминала
  (плагин для `marked`).
- `gray-matter` — парсер YAML frontmatter в Markdown-файлах.

## Типы данных

### DocCategory

Категория документации. Порядок категорий фиксирован.

| `id`          | `label`       | `order` |
| ------------- | ------------- | ------- |
| `"guide"`     | `"Guide"`     | `1`     |
| `"reference"` | `"Reference"` | `2`     |

- `id` (string) — идентификатор категории, совпадает с именем директории
  внутри `docs/`.
- `label` (string) — человекочитаемое название для отображения в списке topics.
- `order` (integer) — порядок отображения категории в списке.

### TopicEntry

Запись одного help topic.

- `name` (string) — полное имя topic в формате `{category}/{slug}`
  (например, `"guide/getting-started"`).
- `description` (string) — описание topic из frontmatter поля `description`.
- `prev` (string | undefined) — slug предыдущего topic в цепочке
  внутри категории из frontmatter поля `prev`. Значение — slug
  (имя файла без `.md`) в той же категории. `undefined` если поле
  отсутствует в frontmatter.
- `next` (string | undefined) — slug следующего topic в цепочке
  внутри категории из frontmatter поля `next`. Значение — slug
  (имя файла без `.md`) в той же категории. `undefined` если поле
  отсутствует в frontmatter.
- `category` (string) — идентификатор категории (`"guide"` или `"reference"`).

### Frontmatter doc-файла

Каждый Markdown-файл в `docs/guide/` и `docs/reference/`
ДОЛЖЕН содержать YAML frontmatter со следующими полями:

- `title` (string, обязательно) — заголовок topic.
- `description` (string, обязательно) — краткое описание topic
  (отображается в списке topics). Длина ТРЕБУЕТСЯ ограничивать
  120 символами (см. `docs/specs/docs-structure.md` § Frontmatter-формат).
- `prev` (string, опционально) — slug предыдущего topic в цепочке
  внутри той же категории. Значение — имя файла без `.md`
  (например, `getting-started`). Поле ТРЕБУЕТСЯ опускать
  (не указывать в frontmatter) для первого topic в цепочке.
- `next` (string, опционально) — slug следующего topic в цепочке
  внутри той же категории. Значение — имя файла без `.md`
  (например, `project-structure`). Поле ТРЕБУЕТСЯ опускать
  (не указывать в frontmatter) для последнего topic в цепочке.

## Команда help

`agloom help [<topic>]` — отображает категоризированный список
доступных help topics или рендерит содержимое конкретного topic
в терминал.

**Аргументы:**

- `<topic>` (string, опционально) — имя help topic для отображения.
  Формат: `{category}/{slug}` (например, `guide/getting-started`,
  `reference/cli`). Допускается сокращённый формат без категории
  (`{slug}`), в этом случае выполняется поиск по всем категориям.

Команда `help` проходит через front-end пайплайн глобальных флагов
(см. `docs/specs/cli-global-flags.md` § Процедура Run CLI) до выполнения
шагов, описанных ниже. Значения `ResolvedPaths` команда `help`
семантически не использует, однако невалидные явные значения
`--project-dir`, `--agloom-dir` или `--config` ПРИВОДЯТ к ошибке
валидации пайплайна и завершению с exit code 1 до отображения списка
topics или рендеринга конкретного topic.

**Поведение:**

1. Распарсить позиционный аргумент `<topic>` из командной строки.
2. Вычислить абсолютный путь к базовой директории документации:
   `path.resolve(import.meta.dirname, '../../docs')`.
   Путь разрешается относительно директории исполняемого файла
   (через `import.meta.dirname`), а не `process.cwd()`,
   чтобы документация была доступна при глобальной установке
   через `npm install -g`.
   Если переменная окружения `AGLOOM_DOCS_DIR` установлена
   и непустая, её значение разрешается через `path.resolve(...)`
   и используется вместо вычисленного пути. Переменная предназначена
   исключительно для изоляции тестов (позволяет тестам подставить
   временный `docs/` без мутации реального) и НЕ ДОЛЖНА использоваться
   конечными пользователями.
3. Для каждой категории из DocCategory прочитать содержимое
   соответствующей директории (`{baseDocsDir}/{category.id}/`).
4. Для каждой категории отобрать файлы с расширением `.md`.
5. Для каждого `.md`-файла распарсить YAML frontmatter
   с помощью `gray-matter`.
6. Для каждого файла сформировать TopicEntry:
   `name` = `{category.id}/{filename без .md}`,
   `description` из frontmatter поля `description`,
   `prev` из frontmatter поля `prev` (undefined если поле отсутствует),
   `next` из frontmatter поля `next` (undefined если поле отсутствует),
   `category` = `category.id`.
7. Определить порядок topics внутри каждой категории
   по алгоритму разрешения linked list:
   a. Найти head — TopicEntry, у которого `prev` равен `undefined`.
   b. Начиная с head, последовательно переходить по `next`-указателям,
   добавляя каждый TopicEntry в результирующий массив.
   c. Остановиться, когда `next` текущего TopicEntry равен `undefined`
   или ссылается на slug, не найденный среди topics данной категории.
   d. Собрать orphans — все TopicEntry данной категории, не вошедшие
   в цепочку (шаги 7a–7c).
   e. Отсортировать orphans по slug в алфавитном порядке (по возрастанию).
   f. Добавить orphans в конец результирующего массива после цепочки.
8. Если `<topic>` не указан — отобразить категоризированный
   список topics (см. § Вывод списка topics); завершить
   с exit code 0.
9. Разрешить topic (см. § Разрешение имени topic).
10. Прочитать содержимое файла разрешённого topic.
11. Извлечь текстовое содержимое без YAML frontmatter
    с помощью `gray-matter`.
12. Отрендерить Markdown-содержимое с использованием `marked`
    и `marked-terminal`.
13. Отобразить результат рендеринга в stdout.

**Расширения:**

3a. Директория категории не существует → список topics
данной категории считается пустым (шаги 4–7 для этой
категории возвращают пустой результат).

5a. Файл не содержит валидного YAML frontmatter →
пропустить файл (не включать в список topics).

5b. Frontmatter не содержит обязательного поля `description` →
`description` = `""` (пустая строка).

5c. Frontmatter не содержит полей `prev` и `next` →
topic становится orphan (не входит в linked list цепочку,
отображается после цепочки в алфавитном порядке по slug).

7a. Ни один TopicEntry в категории не имеет `prev` равный
`undefined` (head не найден) → все topics данной категории
считаются orphans (шаг 7d).

7b. Более одного TopicEntry в категории имеют `prev` равный
`undefined` (несколько heads) → первый по алфавитному
порядку slug становится head; остальные topics с `prev`
равным `undefined`, не достижимые из head через `next`-цепочку,
становятся orphans (шаг 7d).

7c. `next`-указатель ссылается на slug, не найденный
среди topics данной категории → цепочка обрывается
на текущем TopicEntry; оставшиеся topics, не вошедшие
в цепочку, становятся orphans (шаг 7d).

8a. Список topics пуст по всем категориям (директории
отсутствуют или не содержат `.md`-файлов с валидным
frontmatter) → отобразить `"No help topics available."`;
exit code 1.

9a. Topic не найден (см. § Разрешение имени topic,
расширения) → отобразить соответствующее сообщение об ошибке;
exit code 1.

10a. Ошибка чтения файла → отобразить сообщение
`"Failed to read help topic: {topic}."`;
exit code 1.

12a. Ошибка рендеринга Markdown → отобразить сообщение
`"Failed to render help topic: {topic}."`;
exit code 1.

### Разрешение имени topic

Процедура определения файла по переданному аргументу `<topic>`.

**Вход:**

- `topic` (string, обязательно) — значение аргумента `<topic>`.
- `topics` (array\<TopicEntry>, обязательно) — загруженный список topics.

**Поведение:**

1. Если `topic` содержит `/` — интерпретировать как
   `{category}/{slug}`. Найти TopicEntry с `name`,
   совпадающим с `topic`.
2. Если `topic` не содержит `/` — найти все TopicEntry,
   у которых `slug` (часть `name` после `/`) совпадает
   с `topic`.
3. Если найдено ровно одно совпадение — вернуть
   соответствующий TopicEntry.

**Расширения:**

1a. TopicEntry с указанным `name` не найден, список topics
непуст → отобразить сообщение
`"Unknown help topic: {topic}."`, пустую строку
и категоризированный список доступных topics
(см. § Вывод списка topics); exit code 1.

1b. TopicEntry с указанным `name` не найден, список topics
пуст → отобразить сообщение
`"Unknown help topic: {topic}."`;
exit code 1.

2a. Найдено более одного совпадения → отобразить сообщение
`"Ambiguous help topic: {topic}. Did you mean one of these?"`,
пустую строку, список совпавших topic names (каждый
с отступом два пробела, по одному на строке); exit code 1.

2b. Совпадений не найдено, список topics непуст →
отобразить сообщение `"Unknown help topic: {topic}."`,
пустую строку и категоризированный список доступных
topics (см. § Вывод списка topics); exit code 1.

2c. Совпадений не найдено, список topics пуст →
отобразить сообщение `"Unknown help topic: {topic}."`;
exit code 1.

**Результат:**

- `entry` (TopicEntry) — найденная запись topic.
- Абсолютный путь к файлу: `{baseDocsDir}/{entry.category}/{slug}.md`.

### Вывод списка topics

Категоризированный список topics с группировкой по категориям.

```text
Available help topics:

  {category[0].label}:
    {topics[0].name}          {topics[0].description}
    {topics[1].name}          {topics[1].description}
    ...

  {category[1].label}:
    {topics[0].name}          {topics[0].description}
    ...

Run 'agloom help <topic>' to learn more.
```

Правила форматирования:

- Категории отображаются в порядке DocCategory.order
  (guide → reference).
- Название категории отображается с отступом два пробела
  и двоеточием (`Guide:`).
- Topics внутри категории отображаются с отступом четыре пробела.
- Имя topic (`name`) и описание (`description`) разделяются
  пробелами. Имя topic выравнивается по левому краю;
  ширина колонки имени определяется длиной самого длинного
  имени topic среди ВСЕХ категорий.
- Topics внутри категории отсортированы в порядке linked list
  с orphans в конце (порядок из шага 7).
- Между категориями — пустая строка.
- Категория, не содержащая topics, НЕ ДОЛЖНА отображаться.
- Количество topics и категорий в выводе определяется
  содержимым директорий `docs/guide/` и `docs/reference/` —
  хардкод списка ЗАПРЕЩАЕТСЯ, потому что набор topics
  расширяется добавлением `.md`-файлов без изменения кода.

**Вывод:**

При вызове без `<topic>` — категоризированный список topics
(см. выше).

При вызове с `<topic>` — содержимое файла topic,
отрендеренное в терминал-совместимый формат (ANSI-коды
для заголовков, списков, code blocks, выделения и ссылок).
Frontmatter ТРЕБУЕТСЯ удалить перед рендерингом.
Конкретное форматирование определяется библиотекой
`marked-terminal`.

**Exit codes:**

- `0` — список topics отображён или topic отрендерен успешно.
- `1` — topic не найден, topic неоднозначен, ошибка чтения файла,
  нет доступных topics.

## Изменения в cli.md

### Изменение секции --help

Секция `--help` (см. `docs/specs/cli.md` § --help) изменяется.

Описание `agloom --help` или `agloom help` заменяется
на `agloom --help`. Команда `agloom help` больше НЕ является
алиасом `--help` — это отдельная команда
(см. § Команда help).

### Добавление help в список команд

Команда `help` ДОЛЖНА быть добавлена в вывод `agloom --help`
(см. `docs/specs/cli.md` § --help, шаг 2):

```text
  help         Show help topics or display a specific help topic
```

### Изменение секции «Неизвестная команда»

Секция «Неизвестная команда» (см. `docs/specs/cli.md`
§ Неизвестная команда) изменяется. Список известных команд
дополняется значением `help`: `transpile`, `clean`, `init`,
`adapters`, `help`.

## Справка

Команда `help` ДОЛЖНА поддерживать `agloom help --help`.
Вывод `agloom help --help`:

```text
Usage: agloom help [<topic>]

Show help topics or display a specific help topic.

Arguments:
  <topic>  Help topic name (e.g., guide/getting-started, reference/cli)
```

## Конфигурация сборки

### package.json

Поле `files` в `package.json` ТРЕБУЕТСЯ обновить для включения
новых директорий документации в npm-пакет:

```json
{
  "files": ["dist", "docs/guide", "docs/reference"]
}
```

Директория `docs/usage` ТРЕБУЕТСЯ удалить из поля `files`.

### Удаление docs/usage/

Директория `docs/usage/` ТРЕБУЕТСЯ удалить. Все doc-файлы
ТРЕБУЕТСЯ перенести в `docs/guide/` или `docs/reference/`
с добавлением frontmatter (см. § Frontmatter doc-файла).
Содержание doc-файлов НЕ ВХОДИТ в scope данной спецификации —
описан только механизм загрузки и рендеринга.

## Валидация linked list

Валидация целостности linked list — отдельный механизм, НЕ являющийся
частью runtime-поведения команды `agloom help`. Команда `help` при runtime
ТРЕБУЕТСЯ обрабатывать некорректные цепочки gracefully (orphans в конце
списка, см. расширения 7a-7c).

Валидация выполняется standalone-скриптом `scripts/validate-docs-linked-list.ts`.
Скрипт предназначен для запуска в development-time (CI, pre-commit,
ручная проверка) и НЕ является частью CLI пользователя.

### Скрипт validate-docs-linked-list.ts

Расположение: `scripts/validate-docs-linked-list.ts`.

Запуск: `npx tsx scripts/validate-docs-linked-list.ts [--fix]`.

**Аргументы:**

- `--fix` (boolean, опционально, default: false) — после успешной
  валидации записать вычисленные значения `sidebar_position`
  в frontmatter каждого doc-файла.

**Поведение:**

1. Распарсить аргумент `--fix` из `process.argv`.
2. Определить базовую директорию документации:
   `path.resolve(process.cwd(), 'docs')`.
3. Для каждой категории (`guide`, `reference`) прочитать
   содержимое соответствующей директории.
4. Для каждого `.md`-файла распарсить YAML frontmatter
   с помощью `gray-matter`.
5. Для каждого файла извлечь slug (имя файла без `.md`),
   `prev` и `next` из frontmatter.
6. Для каждой категории выполнить проверки:
   a. **Multiple heads** — более одного файла с отсутствующим
   полем `prev` в frontmatter.
   b. **Non-existent slug references** — значение `prev` или `next`
   ссылается на slug, не найденный среди файлов данной категории.
   c. **Broken back-references** — файл A имеет `next: B`,
   но файл B имеет `prev`, не равный slug файла A.
   Аналогично: файл A имеет `prev: B`, но файл B имеет `next`,
   не равный slug файла A.
   d. **Cycles** — последовательный обход `next`-указателей
   начиная с head приводит к уже посещённому файлу.
   e. **Orphaned files** — файлы, не достижимые из head
   через `next`-цепочку.
7. Собрать все найденные ошибки по всем категориям.
8. Если ошибки найдены — вывести диагностические сообщения
   в stderr; exit code 1 (шаги 9–11 НЕ выполняются).
9. Если `--fix` не указан — вывести сообщение об успехе
   в stdout; exit code 0.
10. Для каждой категории вычислить `sidebar_position` для каждого
    файла (см. § Вычисление sidebar_position).
11. Для каждого файла записать `sidebar_position` в frontmatter
    (см. § Запись sidebar_position в frontmatter).
12. Вывести результат записи в stdout; exit code 0.

**Расширения:**

3a. Директория категории не существует → пропустить категорию
(не является ошибкой).

4a. Файл не содержит валидного YAML frontmatter →
добавить ошибку: `"{category}: {slug} has invalid frontmatter"`.

11a. Вычисленное значение `sidebar_position` совпадает
с текущим значением в frontmatter → файл НЕ ДОЛЖЕН
перезаписываться (mtime файла НЕ ДОЛЖЕН измениться).

**Вывод:**

При отсутствии ошибок без `--fix` (stdout):

```text
docs-order: all checks passed
```

При отсутствии ошибок с `--fix` (stdout):

```text
docs-order: all checks passed
docs-order: wrote sidebar_position to {writtenCount} files ({skippedCount} unchanged)
```

Значение `writtenCount` — количество файлов, в которые фактически
записан `sidebar_position` (значение отличалось от вычисленного
или поле отсутствовало). Значение `skippedCount` — количество файлов,
пропущенных из-за совпадения текущего и вычисленного значения
(см. расширение 11a).

При наличии ошибок (stderr, по одной строке на каждую ошибку):

```text
docs-order: validation failed

  {category}: multiple heads: {slug1}, {slug2}
  {category}: {slug}.next references non-existent slug "{value}"
  {category}: {slug}.prev references non-existent slug "{value}"
  {category}: broken back-reference: {slug1}.next = {slug2}, but {slug2}.prev = {slug3}
  {category}: cycle detected: {slug1} -> {slug2} -> ... -> {slug1}
  {category}: orphaned files: {slug1}, {slug2}
```

**Exit codes:**

- `0` — все проверки пройдены без ошибок (с `--fix` или без).
- `1` — найдена хотя бы одна ошибка (запись `sidebar_position`
  НЕ выполняется).

### Вычисление sidebar_position

Процедура определения значения `sidebar_position` для каждого
doc-файла в категории. Вычисление выполняется ТОЛЬКО если
все проверки linked list пройдены без ошибок (шаг 8 не сработал).

**Вход:**

- `entries` (array, обязательно) — список DocEntry данной категории
  с полями `slug`, `prev`, `next`.

**Поведение:**

1. Найти head — entry с `prev` равным `undefined`.
2. Построить упорядоченный массив цепочки: начиная с head,
   последовательно переходить по `next`-указателям, добавляя
   каждый entry в массив. Остановиться, когда `next` равен
   `undefined`.
3. Собрать orphans — все entries, не вошедшие в цепочку (шаг 2).
4. Отсортировать orphans по slug в алфавитном порядке
   (по возрастанию).
5. Назначить `sidebar_position` каждому entry в цепочке:
   позиция = индекс в массиве цепочки + 1 (1-based нумерация).
   Первый entry в цепочке получает `sidebar_position: 1`.
6. Назначить `sidebar_position` каждому orphan:
   позиция = длина цепочки + индекс orphan в отсортированном
   массиве orphans + 1 (1-based нумерация).

**Расширения:**

Нет расширений.

**Результат:**

- Map\<slug, sidebar_position> — соответствие slug → вычисленное
  значение `sidebar_position` (integer, >= 1).

### Запись sidebar_position в frontmatter

Процедура записи значения `sidebar_position` в YAML frontmatter
doc-файла. Запись выполняется точечной модификацией текста файла,
а НЕ полным roundtrip через `gray-matter` или иную YAML-библиотеку,
потому что полный roundtrip изменяет форматирование YAML
(порядок ключей, стиль кавычек, пустые строки).

**Вход:**

- `filePath` (string, обязательно) — абсолютный путь к `.md`-файлу.
- `sidebarPosition` (integer, обязательно) — вычисленное значение
  `sidebar_position`.

**Поведение:**

1. Прочитать содержимое файла как строку.
2. Найти границы YAML frontmatter: открывающий `---` на первой
   строке и закрывающий `---`.
3. Извлечь текущее значение `sidebar_position` из frontmatter
   поиском строки, соответствующей паттерну
   `^sidebar_position:\s*\d+\s*$` (regex, multiline) внутри
   границ frontmatter.
4. Если текущее значение совпадает с `sidebarPosition` —
   пропустить файл (не записывать).
5. Если строка `sidebar_position` найдена в frontmatter —
   заменить её на `sidebar_position: {sidebarPosition}`.
6. Если строка `sidebar_position` не найдена в frontmatter —
   вставить строку `sidebar_position: {sidebarPosition}`
   перед закрывающим `---`.
7. Записать изменённое содержимое в файл.

**Расширения:**

Нет расширений.

**Результат:**

- `written` (boolean) — `true` если файл был записан,
  `false` если пропущен (значение совпадало).

### Экспортируемый API

Скрипт экспортирует две функции:

- `validateDocsLinkedList(baseDocsDir: string)` — существующая
  функция валидации. Возвращает `{ success: boolean; errors: string[] }`.
  Поведение без изменений.

- `fixSidebarPositions(baseDocsDir: string)` — вычисляет
  и записывает `sidebar_position` во все doc-файлы.
  Функция ТРЕБУЕТСЯ вызывать ТОЛЬКО после успешной валидации
  (`validateDocsLinkedList` вернул `success: true`).
  Возвращает `{ writtenCount: number; skippedCount: number }`.
  Значение `writtenCount` — количество файлов, в которые
  фактически записан `sidebar_position`. Значение `skippedCount` —
  количество файлов, пропущенных из-за совпадения значений.

## Вне scope

- Содержание help topics (`docs/guide/*.md`, `docs/reference/*.md`).
- Pager (`less`/`more`) для длинных topics.
- Поиск по содержимому topics.
- Генерация man pages из topics.
- Shell completions для имён topics.
- Добавление новых категорий помимо `guide` и `reference`.
