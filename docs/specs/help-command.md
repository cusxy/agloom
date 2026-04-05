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
  - docs/researches/cli-documentation-delivery/RESEARCH.md
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
- `order` (integer) — порядок отображения внутри категории
  из frontmatter поля `order`.
- `category` (string) — идентификатор категории (`"guide"` или `"reference"`).

### Frontmatter doc-файла

Каждый Markdown-файл в `docs/guide/` и `docs/reference/`
ДОЛЖЕН содержать YAML frontmatter со следующими полями:

- `title` (string, обязательно) — заголовок topic.
- `description` (string, обязательно) — краткое описание topic
  (отображается в списке topics).
- `order` (integer, обязательно) — порядковый номер для сортировки
  внутри категории. Значения НЕ ОБЯЗАНЫ быть последовательными.

## Команда help

`agloom help [<topic>]` — отображает категоризированный список
доступных help topics или рендерит содержимое конкретного topic
в терминал.

**Аргументы:**

- `<topic>` (string, опционально) — имя help topic для отображения.
  Формат: `{category}/{slug}` (например, `guide/getting-started`,
  `reference/cli`). Допускается сокращённый формат без категории
  (`{slug}`), в этом случае выполняется поиск по всем категориям.

**Поведение:**

1. Распарсить позиционный аргумент `<topic>` из командной строки.
2. Вычислить абсолютный путь к базовой директории документации:
   `path.resolve(import.meta.dirname, '../../docs')`.
   Путь разрешается относительно директории исполняемого файла
   (через `import.meta.dirname`), а не `process.cwd()`,
   чтобы документация была доступна при глобальной установке
   через `npm install -g`.
3. Для каждой категории из DocCategory прочитать содержимое
   соответствующей директории (`{baseDocsDir}/{category.id}/`).
4. Для каждой категории отобрать файлы с расширением `.md`.
5. Для каждого `.md`-файла распарсить YAML frontmatter
   с помощью `gray-matter`.
6. Для каждого файла сформировать TopicEntry:
   `name` = `{category.id}/{filename без .md}`,
   `description` из frontmatter поля `description`,
   `order` из frontmatter поля `order`,
   `category` = `category.id`.
7. Отсортировать topics внутри каждой категории по полю `order`
   (по возрастанию).
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

5c. Frontmatter не содержит обязательного поля `order` →
`order` = `Infinity` (topic отображается в конце категории).

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
  и двоеточием (`  Guide:`).
- Topics внутри категории отображаются с отступом четыре пробела.
- Имя topic (`name`) и описание (`description`) разделяются
  пробелами. Имя topic выравнивается по левому краю;
  ширина колонки имени определяется длиной самого длинного
  имени topic среди ВСЕХ категорий.
- Topics внутри категории отсортированы по полю `order`
  (порядок из шага 7).
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

## Вне scope

- Содержание help topics (`docs/guide/*.md`, `docs/reference/*.md`).
- Pager (`less`/`more`) для длинных topics.
- Поиск по содержимому topics.
- Генерация man pages из topics.
- Shell completions для имён topics.
- Добавление новых категорий помимо `guide` и `reference`.
