---
summary: Команда help — рендеринг Markdown-документации в терминал
description: >
  Команда agloom help для отображения списка help topics и рендеринга
  Markdown-файлов из docs/usage/ в терминал через marked + marked-terminal.
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
(см. `docs/specs/cli.md`). Команда отображает список доступных
help topics или рендерит содержимое конкретного topic
из Markdown-файлов в терминал.

Документация хранится в Markdown-файлах в директории `docs/usage/`
и поставляется в npm-пакете. Подход вдохновлён GitHub CLI
(`gh help <topic>`), но с обратной flow: документация хранится
в файлах и рендерится в TUI, а не хранится в коде
и генерируется в docs
(см. `docs/researches/cli-documentation-delivery/RESEARCH.md`).

Команда `help` и флаг `--help` — это РАЗНЫЕ механизмы:

- `agloom --help` — краткая справка со списком команд
  (см. `docs/specs/cli.md` § --help).
- `agloom help` — перечень доступных help topics.
- `agloom help <topic>` — рендер конкретного topic в терминал.

## Зависимости

Команда `help` добавляет следующие зависимости в `package.json`:

- `marked` — парсер Markdown.
- `marked-terminal` — рендерер Markdown для терминала
  (плагин для `marked`).

## Команда help

`agloom help [<topic>]` — отображает список доступных help topics
или рендерит содержимое конкретного topic в терминал.

**Аргументы:**

- `<topic>` (string, опционально) — имя help topic для отображения.
  Соответствует имени файла в `docs/usage/` без расширения `.md`.

**Поведение:**

1. Распарсить позиционный аргумент `<topic>` из командной строки.
2. Вычислить абсолютный путь к директории документации:
   `path.resolve(import.meta.dirname, '../../docs/usage')`.
   Путь разрешается относительно директории исполняемого файла
   (через `import.meta.dirname`), а не `process.cwd()`,
   чтобы документация была доступна при глобальной установке
   через `npm install -g`.
3. Прочитать содержимое директории документации.
4. Отобрать файлы с расширением `.md`.
5. Для каждого файла определить имя topic как имя файла
   без расширения `.md`.
6. Отсортировать список topics по имени в алфавитном порядке.
7. Если `<topic>` не указан — отобразить список topics
   (см. § Вывод списка topics); завершить с exit code 0.
8. Найти topic, имя которого совпадает с `<topic>`.
9. Прочитать содержимое файла `<docsDir>/<topic>.md`.
10. Отрендерить Markdown-содержимое с использованием `marked`
    и `marked-terminal`.
11. Отобразить результат рендеринга в stdout.

**Расширения:**

3a. Директория документации не существует → список topics
считается пустым (шаги 4–6 возвращают пустой результат).

7a. Список topics пуст (директория отсутствует или не содержит
`.md`-файлов) → отобразить `"No help topics available."`;
exit code 1.

8a. Topic с указанным именем не найден, список topics непуст →
отобразить сообщение `"Unknown help topic: {topic}."`,
пустую строку и список доступных topics
(см. § Вывод списка topics); exit code 1.

8b. Topic с указанным именем не найден, список topics пуст →
отобразить сообщение `"Unknown help topic: {topic}."`; exit code 1.

9a. Ошибка чтения файла → отобразить сообщение
`"Failed to read help topic: {topic}."`; exit code 1.

10a. Ошибка рендеринга Markdown → отобразить сообщение
`"Failed to render help topic: {topic}."`; exit code 1.

### Вывод списка topics

```text
Available help topics:

  {topics[0].name}
  {topics[1].name}
  ...

Run 'agloom help <topic>' to learn more.
```

Topics отображаются в алфавитном порядке (порядок из шага 6).
Каждый topic — на отдельной строке с отступом в два пробела.
Количество topics в выводе определяется содержимым директории
`docs/usage/` — хардкод списка ЗАПРЕЩАЕТСЯ, потому что набор
topics расширяется добавлением `.md`-файлов без изменения кода.

**Вывод:**

При вызове без `<topic>` — список topics (см. § Вывод списка topics).

При вызове с `<topic>` — содержимое `docs/usage/<topic>.md`,
отрендеренное в терминал-совместимый формат (ANSI-коды
для заголовков, списков, code blocks, выделения и ссылок).
Конкретное форматирование определяется библиотекой
`marked-terminal`.

**Exit codes:**

- `0` — список topics отображён или topic отрендерен успешно.
- `1` — topic не найден, ошибка чтения файла, нет доступных topics.

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
  <topic>  Help topic name (e.g., configuration, transpile)
```

## Конфигурация сборки

### package.json

Поле `files` в `package.json` ТРЕБУЕТСЯ расширить для включения
документации в npm-пакет:

```json
{
  "files": ["dist", "docs/usage"]
}
```

### Начальные topics

Директория `docs/usage/` ДОЛЖНА содержать следующие файлы
при поставке:

- `configuration.md` — описание `.agloom/config.yml`.
- `transpile.md` — описание команды `transpile`.
- `clean.md` — описание команды `clean`.
- `init.md` — описание команды `init`.
- `adapters.md` — описание команды `adapters`.

Содержание topic-файлов НЕ ВХОДИТ в scope данной спецификации —
описан только механизм загрузки и рендеринга.

## Вне scope

- Содержание help topics (`docs/usage/*.md`).
- Pager (`less`/`more`) для длинных topics.
- Поиск по содержимому topics.
- Генерация man pages из topics.
- Shell completions для имён topics.
- Извлечение заголовка/описания из topic-файлов для вывода
  в списке topics.
