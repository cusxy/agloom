---
summary: Команда init — импорт существующих agent-специфичных файлов в .agloom/
description: >
  Команда agloom init для бэкапа project-файлов в .agloom/project/
  и копирования существующих agent-специфичных файлов
  в .agloom/overlays/<agentId>/.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/provider-overlay.md
maps_to:
  - src/cli/
---

# Команда init

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация добавляет команду `init` в CLI
(см. `docs/specs/cli.md`). Команда выполняет две задачи:

1. Создаёт полный бэкап agent-специфичных project-файлов
   в `.agloom/project/`.
2. Импортирует существующие agent-специфичные файлы
   в `.agloom/overlays/<agentId>/`
   (см. `docs/specs/provider-overlay.md` § Структура директории overlays/).

## Типы данных

### InitOutcome

Результат выполнения импорта для одного агента.

- `copiedCount` (number) — количество скопированных файлов.
- `errors` (array\<string>) — сообщения об ошибках.

### ProjectBackupOutcome

Результат выполнения бэкапа project-файлов.

- `copiedCount` (number) — количество скопированных файлов.
- `errors` (array\<string>) — сообщения об ошибках.

### Результат процедур

Процедуры Backup Project Files и Init Overlay Files возвращают
`ProjectBackupOutcome | string` и `InitOutcome | string` соответственно.
Возврат строки означает ошибку, предотвращающую выполнение процедуры
(см. расширения 7a, 8a в § Процедура Backup Project Files
и 2a, 3a в § Процедура Init Overlay Files).

## Процедура Backup Project Files

Общая процедура бэкапа agent-специфичных project-файлов из корня проекта
в `.agloom/project/`. Вызывается командой `init` при любом режиме
(`--agent` или `--all`).

**Вход:**

- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
- `force` (boolean, обязательно) — перезаписать существующие файлы.

**Поведение:**

1. Прочитать реестр адаптеров целиком.
2. Для каждой записи реестра прочитать `entry.projectFiles`
   (см. `docs/specs/adapter-registry-ext.md` § Расширение AdapterRegistryEntry).
3. Собрать объединённый набор имён файлов из `projectFiles`
   всех записей реестра (без дубликатов).
4. Рекурсивно просканировать `projectRoot` на наличие файлов,
   имена которых совпадают с элементами объединённого набора.
5. Исключить из результатов сканирования файлы, находящиеся
   в `node_modules/`, скрытых каталогах (имя начинается с `.`)
   и каталоге `.agloom/`.
6. Определить целевую директорию как `<projectRoot>/.agloom/project/`.
7. Проверить, что целевая директория не содержит файлов.
8. Создать целевую директорию и промежуточные каталоги
   при необходимости.
9. Для каждого найденного файла определить относительный путь
   от `projectRoot`.
10. Для каждого найденного файла скопировать его
    в `<projectRoot>/.agloom/project/<relativePath>`,
    создавая промежуточные каталоги при необходимости.
11. Сформировать `ProjectBackupOutcome` с `copiedCount`
    (количество файлов, успешно скопированных на шаге 10) и `errors`.

**Расширения:**

7a. Целевая директория уже существует и содержит файлы,
`force` равен `false` → вернуть строку-сообщение
`".agloom/project/ already exists. Use --force to overwrite."`.

7b. `force` равен `true` → пропустить проверку,
перезаписать существующие файлы при копировании.

8a. Ошибка создания директории → вернуть строку-сообщение
с текстом ошибки.

10a. Ошибка копирования файла → добавить сообщение в `errors`,
продолжить с оставшимися файлами.

**Результат:**

- `outcome` (ProjectBackupOutcome) — результат бэкапа,
  или строка-сообщение об ошибке (расширения 7a, 8a).

## Процедура Init Overlay Files

Процедура копирования существующих agent-специфичных файлов
из целевой директории адаптера в overlay-директорию.
Переиспользуется командой `init` для каждого агента.

**Вход:**

- `entry` (AdapterRegistryEntry, обязательно) — запись адаптера из реестра.
- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
- `force` (boolean, обязательно) — перезаписать существующие файлы.

**Поведение:**

1. Определить целевую директорию как
   `<projectRoot>/.agloom/overlays/<entry.id>/`.
2. Проверить, что целевая директория не содержит файлов.
3. Создать целевую директорию и промежуточные каталоги
   при необходимости.
4. Рекурсивно скопировать все файлы из
   `<projectRoot>/<entry.targetRoot>/` в целевую директорию,
   сохраняя структуру каталогов.
5. Сформировать `InitOutcome` с `copiedCount` (количество файлов,
   успешно скопированных на шаге 4) и `errors`.

**Расширения:**

2a. Целевая директория уже существует и содержит файлы,
`force` равен `false` → вернуть строку-сообщение
`".agloom/overlays/{entry.id}/ already exists. Use --force to overwrite."`.

2b. `force` равен `true` → пропустить проверку,
перезаписать существующие файлы при копировании.

3a. Ошибка создания директории → вернуть строку-сообщение
с текстом ошибки.

4a. Директория `targetRoot` не существует → `copiedCount: 0`,
не является ошибкой.

4b. Ошибка копирования → добавить сообщение в `errors`,
продолжить с оставшимися файлами.

**Результат:**

- `outcome` (InitOutcome) — результат импорта,
  или строка-сообщение об ошибке (расширения 2a, 3a).

## Команда init

`agloom init (--agent <agentId> | --all) [--force]` — создаёт бэкап
project-файлов в `.agloom/project/` и копирует существующие
agent-специфичные файлы в `.agloom/overlays/<agentId>/`.

**Аргументы:**

- `--agent` (string, опционально) — идентификатор агента из реестра.
  ТРЕБУЕТСЯ, если `--all` не указан.
- `--all` (boolean, опционально, default: false) — инициализировать
  все поддерживаемые агенты из реестра.
- `--force` (boolean, опционально, default: false) — перезаписать
  существующие файлы.

Аргументы `--agent` и `--all` являются взаимоисключающими.

<!-- prettier-ignore-start -->

**Поведение:**

1. Распарсить аргументы `--agent`, `--all` и `--force`
   из командной строки.
2. Проверить, что указан хотя бы один из `--agent` или `--all`.
3. Проверить, что `--agent` и `--all` не указаны одновременно.
4. Определить `projectRoot` как текущий рабочий каталог процесса
   (`process.cwd()`).
5. Выполнить процедуру Backup Project Files
   (см. § Процедура Backup Project Files) с `projectRoot` и `force`.
6. Если указан `--agent`: выполнить процедуру Resolve Adapter
   (см. `docs/specs/adapter-registry-ext.md` § Процедура Resolve Adapter)
   с `agentId`.
7. Если указан `--agent`: выполнить процедуру Init Overlay Files
   (см. § Процедура Init Overlay Files) с `entry`, `projectRoot`
   и `force`.
8. Если указан `--all`: для каждой записи реестра адаптеров
   выполнить процедуру Init Overlay Files
   (см. § Процедура Init Overlay Files) с `entry`, `projectRoot`
   и `force`.
9. Отобразить результат в TUI (см. § Вывод).
10. Завершить процесс с exit code (см. § Exit codes).

<!-- prettier-ignore-end -->

**Расширения:**

2a. Ни `--agent`, ни `--all` не указан → отобразить сообщение
об обязательности одного из аргументов; exit code 1.

3a. `--agent` и `--all` указаны одновременно → отобразить сообщение
`"--agent and --all are mutually exclusive."`; exit code 1.

5a. Процедура Backup Project Files вернула строку-сообщение →
ошибка процедуры Backup Project Files является блокирующей;
при возврате строки-сообщения команда завершается с exit code 1
без выполнения Init Overlay Files. Сообщение отображается в TUI.

6a. Resolve Adapter вернул ошибку (адаптер не найден) →
отобразить сообщение
`"Unknown agent: {value}. Run 'agloom adapters' to see available adapters."`;
exit code 1.

7a. Процедура Init Overlay Files вернула строку-сообщение →
отобразить сообщение; exit code 1.

8a. Процедура Init Overlay Files для одной из записей реестра
вернула строку-сообщение → отобразить сообщение; exit code 1.

**Вывод:**

Вывод начинается со строки `"Initializing..."`. Далее отображаются
результаты в следующем порядке:

1. Результат бэкапа project-файлов.
2. Результат(ы) копирования overlay-файлов.

Результат бэкапа project-файлов (успех):

```text
  ✓ {projectCopiedCount} project files backed up to .agloom/project/
```

Результат копирования overlay-файлов (успех, для каждого агента):

```text
  ✓ {copiedCount} files copied to .agloom/overlays/{agentId}/
```

Вариант «успех» (--agent claude):

```text
Initializing...
  ✓ {projectCopiedCount} project files backed up to .agloom/project/
  ✓ {copiedCount} files copied to .agloom/overlays/claude/

Done.
```

Вариант «успех» (--all):

```text
Initializing...
  ✓ {projectCopiedCount} project files backed up to .agloom/project/
  ✓ {copiedCount} files copied to .agloom/overlays/claude/
  ✓ {copiedCount} files copied to .agloom/overlays/opencode/
  ✓ {copiedCount} files copied to .agloom/overlays/agentsmd/

Done.
```

Вариант «ошибки» (при наличии ошибок в `errors` любого из outcome):

```text
Initializing...
  ✓ {projectCopiedCount} project files backed up to .agloom/project/
  ✗ {errors[0]}

Done. {copiedCount} files copied.
```

Символ `✓` СЛЕДУЕТ отображать зелёным цветом.
Символ `✗` СЛЕДУЕТ отображать красным цветом.

**Exit codes:**

- `0` — все шаги завершились без ошибок (включая 0 файлов).
- `1` — ни `--agent`, ни `--all` не указан; `--agent` и `--all`
  указаны одновременно; неизвестный агент; директория уже
  существует без `--force`; ошибка создания директории;
  или ошибка копирования.

## Справка

Команда `init` ДОЛЖНА быть добавлена в вывод `agloom --help`:

```text
  init         Import existing agent configs into .agloom/
```

Команда ДОЛЖНА поддерживать `agloom init --help`.
Вывод `agloom init --help`:

```text
Usage: agloom init (--agent <agentId> | --all) [--force]

Import existing agent configs into .agloom/

Options:
  --agent <agentId>  Agent identifier (required unless --all)
  --all              Initialize all supported agents
  --force            Overwrite existing files
  --help             Show help
```

## Вне scope

- Автоматическое создание канонических файлов из agent-специфичных
  (reverse transpile).
- Поле `projectFiles` в `AdapterRegistryEntry` — описывается
  в `docs/specs/adapter-registry-ext.md`.
