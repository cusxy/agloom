---
type: research
summary: >-
  Сравнение CLI, конфигурации и инфраструктурных утилит: ruler.toml
  vs config.yml, gitignore, dry-run, global config.
description: >-
  Детальный анализ пяти возможностей Ruler, связанных с CLI
  и инфраструктурой: формат конфигурации, CLI-команды, gitignore
  автоматизация, dry-run mode, глобальная конфигурация.
relates:
  - docs/researches/ruler-comparison/RESEARCH.md
---

# CLI и инфраструктура

## 8. Конфигурация

### Ruler (`ruler.toml`)

TOML-формат. Zod-валидация. Секции:

```toml
default_agents = ["claude", "copilot", "cursor"]
[agents.claude]
enabled = true
output_path = "CLAUDE.md"
[agents.claude.mcp]
enabled = true
strategy = "merge"
[mcp]
enabled = true
[mcpServers.my-server]
type = "stdio"
command = "node"
args = ["server.js"]
[gitignore]
enabled = true
[skills]
enabled = true
nested = false
```

Ключевые особенности:

- Per-agent settings: `enabled`, `outputPath`, `mcp.enabled`, `mcp.strategy`.
- MCP-серверы определяются в том же файле (inline).
- Gitignore и skills -- top-level toggles.

### Agloom (`config.yml`)

YAML-формат. Структура:

```yaml
adapters: [claude, opencode, kilocode]
plugins:
  - local: ./plugins/custom-rules
variables:
  project_name: { description: "Project name", default: "my-project" }
```

Ключевые особенности:

- Список адаптеров вместо per-agent settings.
- Plugin system: local и git-плагины с values interpolation.
- Variables: typed переменные с description, required, default, sensitive.

### Плюсы Ruler

- Per-agent granularity: можно включить/выключить агента, переопределить
  output path, настроить MCP-стратегию.
- Всё в одном файле: правила, MCP-серверы, настройки агентов.
- Gitignore/skills toggles как top-level опции.

### Минусы Ruler

- Нет переменных и plugin system.
- TOML менее распространён в JS-экосистеме, чем YAML.

### Плюсы Agloom

- Plugin system: повторное использование конфигураций между проектами.
- Variables: параметризация инструкций через `${values:*}`.
- YAML: стандартный формат для JS/TS-проектов.

### Минусы Agloom

- Нет per-agent settings: невозможно переопределить output path,
  включить/выключить конкретного агента без удаления из списка.
- Нет inline MCP-серверов в конфиге.

## 9. CLI команды

### Ruler

Три команды (yargs-based):

| Команда  | Описание                            | Ключевые флаги                                           |
| -------- | ----------------------------------- | -------------------------------------------------------- |
| `init`   | Создаёт `.ruler/` с шаблоном        | `--global`                                               |
| `apply`  | Генерирует agent-файлы              | `--agents`, `--dry-run`, `--nested`, `--mcp`, `--backup` |
| `revert` | Восстанавливает из backup / удаляет | `--agents`, `--keep-backups`, `--dry-run`                |

`revert` восстанавливает файлы из `.bak`-копий или удаляет
сгенерированные файлы. Также очищает пустые директории и MCP-файлы.

### Agloom

Команды (Ink-based):

| Команда     | Описание                             | Ключевые флаги                              |
| ----------- | ------------------------------------ | ------------------------------------------- |
| `transpile` | Генерирует agent-файлы (default cmd) | `--project-dir`, `--agloom-dir`, `--config` |
| `init`      | Создаёт `.agloom/` с шаблоном        | --                                          |
| `clean`     | Удаляет сгенерированные файлы        | --                                          |
| `adapters`  | Список доступных адаптеров           | --                                          |
| `format`    | Форматирует Agloom-файлы             | --                                          |
| `help`      | Справка                              | --                                          |

`clean` -- аналог `revert`, но без backup-восстановления (только удаление).

### Плюсы Ruler

- `revert` с backup-восстановлением: если файл существовал до Ruler,
  он будет восстановлен из `.bak`.
- `--dry-run` для preview.
- `--agents` для выборочного apply/revert.

### Минусы Ruler

- Нет `format` команды.
- Нет `adapters` (список агентов).
- Backup-файлы (.bak) засоряют рабочую директорию.

### Плюсы Agloom

- `format` -- встроенное форматирование Markdown.
- `adapters` -- discovery доступных адаптеров.
- `clean` -- чистое удаление без `.bak`-файлов.
- Rich UI через Ink (progress, spinners).

### Минусы Agloom

- Нет `--dry-run`: невозможно preview изменений.
- `clean` не восстанавливает оригиналы: если `CLAUDE.md` существовал
  до Agloom, он будет удалён, а не восстановлен.
- Нет `--agents` для выборочного transpile.

## 10. Gitignore автоматизация

### Ruler

`GitignoreUtils.ts` (~160 строк) автоматически добавляет все
сгенерированные пути в `.gitignore` (или `.git/info/exclude`)
внутри managed block:

```gitignore
# START Ruler Generated Files
/CLAUDE.md
/AGENTS.md
/.mcp.json
# END Ruler Generated Files
```

Настраивается через `ruler.toml` и CLI (`--gitignore`, `--gitignore-local`).
Поддерживает `.git/info/exclude` как альтернативу `.gitignore`.

### Agloom

Отсутствует. Пользователь вручную добавляет сгенерированные файлы
в `.gitignore`.

### Плюсы Ruler

- Zero-friction: пользователь не задумывается о gitignore.
- Managed block: Ruler обновляет только свою секцию, не трогая остальное.
- Поддержка `.git/info/exclude` для тех, кто не хочет менять `.gitignore`.

### Минусы Ruler

- `.bak`-файлы тоже добавляются в gitignore, увеличивая managed block.

### Минусы Agloom

- Пользователь вручную добавляет файлы в `.gitignore` -- friction при onboarding.

## 11. Dry-run mode

### Ruler

CLI-флаг `--dry-run` для `apply` и `revert`. При активации:

- Файлы не записываются.
- Лог показывает, что было бы изменено (`DRY RUN: Would write...`).
- `--verbose` + `--dry-run` даёт детальный preview.

### Agloom

Отсутствует. `transpile` всегда записывает файлы.

### Плюсы Ruler

- Безопасный preview перед первым apply или после изменения конфигурации.
- Полезен в CI для валидации без side-effects.

### Минусы Ruler

- Увеличивает сложность каждой функции (параметр `dryRun` пробрасывается
  через весь call stack).

## 12. Global configuration

### Ruler

`ruler init --global` создаёт `.ruler/` в `$XDG_CONFIG_HOME/ruler/`
(по умолчанию `~/.config/ruler/`). При `apply` Ruler ищет правила
сначала локально, затем в global dir (если не `--local-only`).

### Agloom

Отсутствует. Частично покрывается plugin system (git-плагин).

### Плюсы Ruler

- Shared правила без настройки: XDG-путь стандартен.

### Минусы Ruler

- Неявность: пользователь может не знать, что global rules применяются.

### Плюсы Agloom (plugin system как альтернатива)

- Явное подключение и версионирование через git ref.

### Минусы Agloom

- Требует настройки plugin в каждом проекте.

## Рекомендации

- **Gitignore автоматизация** -- высокий приоритет. Реализация: managed
  block по аналогии с Ruler, активация по умолчанию, toggle в `config.yml`.
- **Dry-run** -- средний приоритет. Реализация: `--dry-run` флаг для
  `transpile`, возвращает список файлов без записи.
- **Per-agent config** -- средний приоритет. Расширить `config.yml`
  секцией per-adapter settings (enabled, output path override).
- **Global config** -- низкий приоритет. Plugin system покрывает
  основной use case.
