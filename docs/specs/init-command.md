---
summary: Команда init — импорт существующих agent-специфичных файлов в .agloom/
description: >
  Команда agloom init для копирования существующих agent-специфичных файлов
  в .agloom/overlays/<agentId>/.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/provider-overlay.md
  - docs/specs/config.md
  - docs/specs/cli-global-flags.md
maps_to:
  - src/cli/
---

# Команда init

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация добавляет команду `init` в CLI
(см. `docs/specs/cli.md`). Команда выполняет две задачи:

1. Создаёт конфигурационный файл `.agloom/config.yml`
   (см. `docs/specs/config.md`).
2. Импортирует существующие agent-специфичные файлы
   в `.agloom/overlays/<agentId>/`
   (см. `docs/specs/provider-overlay.md` § Структура директории overlays/).

## Типы данных

### InitOutcome

Результат выполнения импорта для одного агента.

- `copiedCount` (number) — количество скопированных файлов.
- `errors` (array\<string>) — сообщения об ошибках.

### Результат процедуры

Процедура Init Overlay Files возвращает `InitOutcome | string`.
Возврат строки означает ошибку, предотвращающую выполнение процедуры
(см. расширения в § Процедура Init Overlay Files).

## Процедура Init Overlay Files

Процедура копирования существующих agent-специфичных файлов
из целевой директории адаптера в overlay-директорию.
Переиспользуется командой `init` для каждого агента.

**Вход:**

- `entry` (AdapterRegistryEntry, обязательно) — запись адаптера из реестра.
- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта
  (writeRoot); используется как база для относительных путей из
  `entry.overlayImportPaths`.
- `resourcesRoot` (string, обязательно) — абсолютный путь к директории
  ресурсов agloom; используется как база для записи overlay-файлов.
- `force` (boolean, обязательно) — перезаписать существующие файлы.

**Поведение:**

1. Определить целевую директорию как
   `<resourcesRoot>/overlays/<entry.id>/`.
2. Проверить, что целевая директория не содержит файлов.
3. Создать целевую директорию и промежуточные каталоги
   при необходимости.
4. Для каждого пути из `entry.overlayImportPaths`
   (см. `docs/specs/adapter-registry-ext.md`
   § Расширение AdapterRegistryEntry) определить тип пути:
   - Если путь содержит glob-метасимволы (`*`, `?`, `{`, `}`):
     резолвить через `fast-glob` с параметрами, описанными
     в `docs/specs/adapter-registry-ext.md`
     § Расширение AdapterRegistryEntry, поле `overlayImportPaths`.
     Для каждого найденного файла скопировать
     в `<целевая директория>/<относительный путь от projectRoot>`.
   - Если путь — файл: скопировать
     в `<целевая директория>/<путь>`.
   - Если путь — директория: рекурсивно скопировать содержимое
     в `<целевая директория>/<путь>/`, сохраняя структуру каталогов.
   - Если путь не существует (и не является glob-паттерном): пропустить без ошибки.
5. Сформировать `InitOutcome` с `copiedCount` (количество файлов,
   успешно скопированных на шаге 4) и `errors`.

**Расширения:**

2a. Целевая директория уже существует и содержит файлы,
`force` равен `false` → вернуть строку-сообщение
`"{resourcesRoot}/overlays/{entry.id}/ already exists. Use --force to overwrite."`.

2b. `force` равен `true` → пропустить проверку,
перезаписать существующие файлы при копировании.

3a. Ошибка создания директории → вернуть строку-сообщение
с текстом ошибки.

4a. Все пути из `overlayImportPaths` не существуют
и glob-паттерны не нашли файлов → `copiedCount: 0`,
не является ошибкой.

4b. Ошибка копирования → добавить сообщение в `errors`,
продолжить с оставшимися файлами.

4c. Ошибка выполнения `fast-glob` (I/O-ошибка) → добавить сообщение
в `errors`, продолжить с оставшимися путями из `overlayImportPaths`.

**Результат:**

- `outcome` (InitOutcome) — результат импорта,
  или строка-сообщение об ошибке (расширения 2a, 3a).

## Команда init

`agloom init [--adapter <adapterId>]... [--all] [--force] [--verbose]` —
копирует существующие agent-специфичные файлы в
`.agloom/overlays/<agentId>/` и создаёт конфигурационный файл
`.agloom/config.yml` (см. `docs/specs/config.md`).

**Аргументы:**

- `--adapter` (string, опционально, повторяемый) — идентификатор агента
  из реестра. МОЖЕТ быть указан несколько раз для инициализации
  нескольких агентов за один запуск (например,
  `--adapter claude --adapter opencode`). Взаимоисключающий с `--all`.
  Повторяющиеся идентификаторы дедуплицируются с сохранением порядка
  первого появления.
- `--all` (boolean, опционально, default: false) — инициализировать
  все поддерживаемые агенты из реестра.
- `--force` (boolean, опционально, default: false) — перезаписать
  существующие файлы.
- `--verbose` (boolean, опционально, default: false) — показывать все
  результаты, включая шаги с 0 скопированных файлов.

Аргументы `--adapter` (даже если указан несколько раз) и `--all`
являются взаимоисключающими. При отсутствии обоих используется
конфигурационный файл (см. `docs/specs/config.md`).

<!-- prettier-ignore-start -->

**Поведение:**

1. Распарсить аргументы из командной строки: значения всех вхождений
   `--adapter` накопить в массив `adapterIds` в порядке появления;
   распарсить булевы флаги `--all`, `--force` и `--verbose`.
2. Получить `paths` (ResolvedPaths) и `loadedConfig` (LoadConfigResult)
   от front-end пайплайна (см. `docs/specs/cli-global-flags.md`
   § Процедура Run CLI). Определить `projectRoot` как `paths.writeRoot`,
   `resourcesRoot` как `paths.resourcesRoot`.
3. Выполнить процедуру Resolve Adapters from CLI Args
   (см. `docs/specs/config.md`
   § Процедура Resolve Adapters from CLI Args)
   с `adapterIds`, `all`, `loadedConfig`, `"init"`. Содержимое
   `loadedConfig` семантически init не использует (команда создаёт
   новый конфиг), но передача нужна для унифицированного вызова
   процедуры.
4. Проверить, что `resourcesRoot` не является уже инициализированной
   директорией agloom. Директория считается инициализированной, если
   выполнено хотя бы одно из условий:
   - существует обычный файл `<resourcesRoot>/config.yml`;
   - существует директория `<resourcesRoot>/overlays/`, содержащая
     хотя бы один элемент.
     Сам `resourcesRoot` МОЖЕТ отсутствовать на файловой системе
     или существовать, но быть пустым, или содержать произвольные
     файлы, не связанные с agloom — это НЕ считается инициализацией.
5. Если указан `--adapter` или `--all`: создать файл
   `<resourcesRoot>/config.yml` (см. § Создание конфигурационного файла).
   Если директория `resourcesRoot` не существует — создать её
   вместе с промежуточными каталогами.
6. Для каждой записи из списка, полученного на шаге 3,
   выполнить процедуру Init Overlay Files
   (см. § Процедура Init Overlay Files) с `entry`, `projectRoot`,
   `resourcesRoot` и `force`. Процедура ТРЕБУЕТСЯ читать существующие
   agent-файлы проекта из `projectRoot` (базы для `overlayImportPaths`),
   а записывать overlay в `<resourcesRoot>/overlays/<entry.id>/`.
7. Отобразить результат в TUI (см. § Вывод).
8. Завершить процесс с exit code (см. § Exit codes).

<!-- prettier-ignore-end -->

**Расширения:**

3a. Resolve Adapters from CLI Args вернул ошибку → отобразить
сообщение ошибки; exit code 1.

4a. `resourcesRoot` считается инициализированной (существует
`<resourcesRoot>/config.yml` ИЛИ непустая `<resourcesRoot>/overlays/`),
и `--force` не указан → отобразить сообщение
`"{resourcesRoot} already initialized. Use --force to reinitialize."`;
exit code 1. Последующие шаги не выполняются.

4b. `--force` указан → пропустить проверку, продолжить с шага 5.

4c. `resourcesRoot` существует, но не содержит признаков инициализации
agloom (нет `config.yml`, нет непустой `overlays/`) → продолжить с шага 5.
Сценарий типичен для workflow
`mkdir -p /new/.agloom && agloom init --agloom-dir /new/.agloom`.

4d. `resourcesRoot` не существует на файловой системе → продолжить
с шага 5; директория будет создана на шаге 5. Данное расширение
достижимо только при дефолтном `--agloom-dir` (из каскада), поскольку
явный `--agloom-dir` уже отсеивается пайплайном Resolve Global Flags,
если указанная директория не существует.

5a. Ошибка записи `<resourcesRoot>/config.yml` → отобразить сообщение
ошибки; exit code 1.

6a. Процедура Init Overlay Files для одной из записей
вернула строку-сообщение → отобразить сообщение; exit code 1.

### Создание конфигурационного файла

Выполняется на шаге 5 при указании `--adapter` или `--all`.
Создаёт файл `<projectRoot>/.agloom/config.yml` в формате,
описанном в `docs/specs/config.md` § Формат файла.

Содержимое поля `adapters`:

- При одном или нескольких `--adapter`: список идентификаторов из массива
  `adapterIds`, дедуплицированный с сохранением порядка первого появления
  каждого `id`. Например, `--adapter claude --adapter opencode` →
  `adapters: [claude, opencode]`; `--adapter claude --adapter claude` →
  `adapters: [claude]`.
- При `--all`: список `id` всех нескрытых адаптеров
  (с `hidden !== true`) из реестра в порядке их определения
  в реестре.

Файл ДОЛЖЕН содержать комментарии для onboarding:

```yaml
# Agloom configuration
# List of adapters to use by default when no --adapter or --all flag is provided.
# Run 'agloom adapters --all' to see all available adapters.
adapters:
  - <id>
```

При `--force` существующий файл перезаписывается. Без `--force`
шаг создания конфига достижим только если директория `.agloom/`
не существует (проверка на шаге 4 предотвращает перезапись).

При отсутствии `--adapter` и `--all` (режим конфига)
файл `.agloom/config.yml` уже существует и НЕ модифицируется.

**Вывод:**

Вывод подчиняется правилам фильтрации по `--verbose`:

- Без `--verbose`: строки с 0 скопированных файлов и без ошибок
  скрываются. Если все строки скрыты и нет ошибок —
  отображается `"Nothing to import."`.
- С `--verbose`: все строки отображаются, включая 0 скопированных файлов.

Заголовок `"✓ Initializing..."` отображается, если есть хотя бы один
видимый результат (ошибки, ненулевое количество файлов, или `--verbose`).
Символ `✓` в заголовке СЛЕДУЕТ отображать зелёным цветом.
Далее отображаются результаты копирования overlay-файлов.

Результат копирования overlay-файлов (успех, для каждого агента):

```text
  ✓ {copiedCount} files copied to .agloom/overlays/{agentId}/
```

Вариант «успех» (--adapter claude):

```text
✓ Initializing...
  ✓ {copiedCount} files copied to .agloom/overlays/claude/

Done. {totalCopied} files copied.
```

Вариант «успех» (--all):

```text
✓ Initializing...
  ✓ {copiedCount} files copied to .agloom/overlays/claude/
  ✓ {copiedCount} files copied to .agloom/overlays/opencode/
  ✓ {copiedCount} files copied to .agloom/overlays/agentsmd/

Done. {totalCopied} files copied.
```

Вариант «ошибки» (при наличии ошибок в `errors` любого из outcome):

```text
✓ Initializing...
  ✗ {errors[0]}

Done. {totalCopied} files copied.
```

Символ `✓` СЛЕДУЕТ отображать зелёным цветом.
Символ `✗` СЛЕДУЕТ отображать красным цветом.

Итоговая строка `"Done. {totalCopied} files copied."` отображается
всегда. Значение `totalCopied` — сумма `copiedCount` из всех
overlay-результатов.

**Exit codes:**

- `0` — все шаги завершились без ошибок (включая 0 файлов).
- `1` — `--adapter` и `--all` указаны одновременно; в `.agloom/config.yml`
  отсутствует поле `adapters` (или сам файл) при отсутствии `--adapter`
  и `--all`; ошибка конфига; неизвестный или скрытый агент;
  `.agloom/` уже существует без `--force`; директория
  `.agloom/overlays/` уже существует без `--force`; ошибка создания
  директории; или ошибка копирования.

## Справка

Команда `init` ДОЛЖНА быть добавлена в вывод `agloom --help`:

```text
  init         Import existing agent configs into .agloom/
```

Команда ДОЛЖНА поддерживать `agloom init --help`.
Вывод `agloom init --help`:

```text
Usage: agloom init [--adapter <adapterId>]... [--all] [--force] [--verbose]

Import existing agent configs into .agloom/

Options:
  --adapter <adapterId>  Adapter identifier (may be repeated)
  --all                  Initialize all supported agents
  --force                Overwrite existing files
  --verbose              Show all steps including 0-file ones
```

## Глобальные флаги

Команда `init` поддерживает три глобальных флага
(см. `docs/specs/cli-global-flags.md` § Флаги):

- `--project-dir <path>` — база для чтения существующих agent-файлов
  проекта (`overlayImportPaths` адаптеров) и корень, куда транспиляция
  впоследствии будет писать выходные файлы.
- `--agloom-dir <path>` — директория, в которой `init` создаёт новый
  `<resourcesRoot>/config.yml` и `<resourcesRoot>/overlays/<agentId>/`.
  При отсутствии флага значение каскадируется из `--project-dir`
  и даёт `<project-dir>/.agloom`.
- `--config <path|->` — принимается пайплайном и валидируется
  на существование согласно правилам
  `docs/specs/cli-global-flags.md` § Правила существования путей,
  но семантически `init` **не использует** содержимое загруженного
  конфига. Команда создаёт новый конфиг в `<resourcesRoot>/config.yml`
  по собственной логике (см. § Создание конфигурационного файла),
  а не копирует содержимое `--config`. Это сознательное no-op
  поведение, документированное как часть модели пайплайна
  (см. `docs/specs/cli-global-flags.md` § Семантика команд).

### Известная регрессия eager-загрузки

Front-end пайплайн эагерно загружает конфиг в Run CLI
(см. `docs/specs/cli-global-flags.md` § Процедура Run CLI, шаг 2).
Следствие: если дефолтный `<resourcesRoot>/config.yml` существует,
но содержит невалидный YAML или невалидное содержимое (неизвестный
адаптер, пустой массив `adapters` и т.п.), команда
`agloom init --adapter claude` завершается с ошибкой Load Config
на этапе Run CLI — до выполнения шагов самой команды init.
Это происходит, несмотря на то что init с `--adapter` создаёт новый
конфиг и семантически не нуждается в содержимом старого.

Данное поведение — сознательная регрессия, следующая из правила
единого пайплайна (см. `docs/specs/cli-global-flags.md`
§ Известные регрессии eager-загрузки). Обход для типичного workflow
«чинить сломанный проект» — использовать `--config -` с пустым stdin:

```text
echo -n | agloom init --adapter claude --config -
```

Это даёт Run CLI валидный пустой `loadedConfig`, не затрагивая
сломанный файл на диске.

## Вне scope

- Автоматическое создание канонических файлов из agent-специфичных
  (reverse transpile).
- Поле `projectFiles` в `AdapterRegistryEntry` — описывается
  в `docs/specs/adapter-registry-ext.md`.
- Поле `overlayImportPaths` в `AdapterRegistryEntry` — описывается
  в `docs/specs/adapter-registry-ext.md`.
