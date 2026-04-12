---
type: research
summary: >-
  Детальное сравнение подходов к управлению MCP в Ruler и Agloom:
  конфигурация, фильтрация, трансформации, клиентский API.
description: >-
  Анализ MCP Server Propagation в обоих проектах: конфигурационные
  форматы, capability-based filtering, merge/overwrite стратегии,
  agent-specific трансформации, per-agent paths и ключи, примеры
  конфигурации и результирующих файлов.
relates:
  - docs/researches/ruler-comparison/RESEARCH.md
---

# MCP Server Propagation

## Конфигурация пользователя

### Ruler

MCP-серверы определяются inline в `ruler.toml`:

```toml
[mcpServers.my-db]
type = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres"]

[mcpServers.remote-api]
type = "remote"
url = "https://api.example.com/mcp"
headers = { Authorization = "Bearer ${TOKEN}" }
timeout = 30
```

Альтернативно -- legacy `.ruler/mcp.json` (deprecated).
Стратегия записи настраивается глобально и per-agent:

```toml
[mcp]
enabled = true
strategy = "merge"
[agents.claude.mcp]
enabled = true
strategy = "overwrite"
```

### Agloom

Канонический файл `.agloom/mcp.yml`:

```yaml
mcpServers:
  my-db:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-postgres"]
  remote-api:
    type: http
    url: https://api.example.com/mcp
    headers:
      Authorization: "Bearer ${env:TOKEN}"
  legacy-sse:
    type: sse
    url: https://api.example.com/sse
    includeTools: [query, insert]
```

Валидация через `validateCanonicalContent()`: проверка типов полей,
допустимых транспортов (`stdio`, `http`, `sse`), взаимоисключение
`includeTools`/`excludeTools`, запрет смешивания полей (url для stdio).

## Модели обработки

### Ruler: capability-based filtering + inline transforms

Каждый агент декларирует capabilities через boolean-методы:

- `supportsMcpStdio()` -- поддержка STDIO-серверов
- `supportsMcpRemote()` -- поддержка remote-серверов (url)
- `supportsMcpTimeout()` -- поддержка timeout

Функция `filterMcpConfigForAgent()` фильтрует серверы:

- STDIO-сервер (`command` без `url`) -- включается если `supportsStdio`.
- Remote-сервер (`url` без `command`) -- включается если `supportsRemote`.
- Remote без поддержки remote, но с поддержкой stdio -- **автоматический
  fallback на `mcp-remote`**: сервер трансформируется в stdio-вызов
  `npx -y mcp-remote@latest <url>`.

Agent-specific трансформации вшиты в `apply-engine.ts` (не в агенте):

| Агент         | Трансформация                                  |
| ------------- | ---------------------------------------------- |
| Claude        | `remote` -> `http` или `sse` (по `/sse` в URL) |
| KiloCode      | `remote` -> `streamable-http`                  |
| Firebase      | удаление поля `type`                           |
| Gemini        | удаление поля `type`                           |
| Codex         | запись в TOML, ключ `mcp_servers`              |
| OpenHands     | запись в TOML `config.toml`                    |
| OpenCode      | отдельная функция `propagateMcpToOpenCode()`   |
| Factory Droid | `remote` -> `http`                             |

MCP-ключ в JSON: `mcpServers` (default), переопределяется через
`getMcpServerKey()`. Codex использует `mcp_servers`, Copilot -- `servers`.

### Agloom: adapter-per-agent трансформация

Каждый агент имеет отдельный `McpAdapter` с методом `transpile()`.
Трансформация инкапсулирована в адаптере:

| Адаптер              | Output файл             | Трансформация типов             |
| -------------------- | ----------------------- | ------------------------------- |
| `ClaudeMcpAdapter`   | `.mcp.json`             | stdio/http/sse -- без изменений |
| `OpenCodeMcpAdapter` | `opencode.json`         | http -> `remote`, sse -- skip   |
| `CodexMcpAdapter`    | `.codex/config.toml`    | TOML, http -> url, sse -- skip  |
| `KilocodeMcpAdapter` | `kilo.jsonc`            | http -> `streamable-http`       |
| `GeminiMcpAdapter`   | `.gemini/settings.json` | http -> `httpUrl`, sse -> `url` |

Shared-процедуры `buildStdioServerConfig()` и `buildRemoteServerConfig()`
вынесены в `shared.ts` -- адаптеры композируют из них.

## Per-agent MCP paths

### Ruler (17 агентов с MCP)

| Агент         | MCP-файл                    |
| ------------- | --------------------------- |
| Claude Code   | `.mcp.json`                 |
| Copilot       | `.vscode/mcp.json`          |
| Cursor        | `.cursor/mcp.json`          |
| Windsurf      | `.windsurf/mcp_config.json` |
| Codex CLI     | `.codex/config.toml`        |
| OpenHands     | `config.toml`               |
| Gemini CLI    | `.gemini/settings.json`     |
| Junie         | `.junie/mcp/mcp.json`       |
| KiloCode      | `.kilocode/mcp.json`        |
| OpenCode      | `opencode.json`             |
| Firebase      | `.idx/mcp.json`             |
| Factory Droid | `.factory/mcp.json`         |
| Zed           | `.zed/settings.json`        |
| Kiro          | `.kiro/settings/mcp.json`   |
| Qwen Code     | `.qwen/settings.json`       |
| Aider         | `.mcp.json`                 |
| Crush         | `.crush.json` (internal)    |

Paths определяются в `paths/mcp.ts` через `switch` по `adapterName`.

### Agloom (5 адаптеров с MCP)

| Адаптер  | MCP-файл                |
| -------- | ----------------------- |
| Claude   | `.mcp.json`             |
| OpenCode | `opencode.json`         |
| Codex    | `.codex/config.toml`    |
| KiloCode | `kilo.jsonc`            |
| Gemini   | `.gemini/settings.json` |

Paths определяются в адаптере (`transpile()` возвращает `relativePath`).

## Merge/overwrite стратегии

### Ruler

`mergeMcp()` поддерживает две стратегии:

- **merge** (default): `{ ...baseServers, ...incomingServers }`. Incoming
  серверы перезаписывают одноимённые, остальные сохраняются.
- **overwrite**: incoming полностью заменяет base.

Стратегия настраивается на трёх уровнях (приоритет: CLI > per-agent > global):
CLI `--mcp-overwrite`, per-agent `[agents.X.mcp].strategy`, global `[mcp].strategy`.

### Agloom

`McpTranspiler.writeResults()` при записи JSON-файлов выполняет
`deepMerge()` с существующим файлом на диске. Это эквивалент стратегии
`merge`, но без возможности выбора `overwrite`.

Deep merge рекурсивен (вложенные объекты мержатся, не перезаписываются),
что отличается от shallow merge в Ruler.

## Результирующие файлы: примеры

Для серверов `my-db` (stdio) и `remote-api` (http):

- **Claude** (`.mcp.json`): `{ "mcpServers": { "my-db": { "type": "stdio", "command": "npx" }, "remote-api": { "type": "http", "url": "..." } } }` -- идентичен в обоих проектах.
- **Codex** (`.codex/config.toml`): `[mcp_servers.my-db]` с `command`/`args`, `[mcp_servers.remote-api]` с `url` -- идентичен в обоих проектах.
- **Cursor** (`.cursor/mcp.json`): аналогичен Claude -- только Ruler (Agloom не поддерживает).

## Tool filtering

### Ruler

Нет поддержки `includeTools`/`excludeTools`. Все инструменты сервера
доступны всем агентам.

### Agloom

Канонический формат поддерживает `includeTools` и `excludeTools` --
whitelist/blacklist инструментов MCP-сервера. Поля взаимоисключающие.
Codex и Gemini адаптеры транслируют их в native-поля
(`enabled_tools`/`disabled_tools` и `includeTools`/`excludeTools`).
Для агентов без native-поддержки (Claude, OpenCode, KiloCode) --
предупреждение и рекомендация использовать permissions transpiler.

## Плюсы Ruler

- 17 агентов с MCP vs 5 у Agloom -- значительно шире покрытие.
- `mcp-remote` fallback: агент без поддержки remote получает stdio-обёртку.
- Configurable merge/overwrite на трёх уровнях.
- Backup/restore MCP-файлов при revert.
- MCP inline в `ruler.toml` -- один файл для всего.

## Минусы Ruler

- Agent-specific трансформации в `apply-engine.ts` (800+ строк с 8+
  ветвлениями по `agent.getIdentifier()`). Нарушает Open-Closed principle.
- Тип `remote` в конфиге -- абстракция Ruler, не MCP-стандарт.
  Трансформация `remote` -> `http`/`sse` по regexp `/sse(\/|$)/` хрупка.
- Нет tool filtering.
- `getMcpServerKey()` + `getNativeMcpPath()` + inline transforms =
  знание о формате агента размазано по 3 модулям.

## Плюсы Agloom

- Инкапсуляция: вся трансформация в адаптере. Engine не знает о деталях.
- Стандартные транспорты (`stdio`, `http`, `sse`) -- без абстракции `remote`.
- Tool filtering (`includeTools`/`excludeTools`) с native трансляцией.
- Strict validation канонического файла (типы, взаимоисключения).
- Deep merge при записи JSON (рекурсивный, не shallow).

## Минусы Agloom

- 5 MCP-адаптеров vs 17 у Ruler. Cursor, Windsurf, Copilot, Junie не покрыты.
- Нет configurable overwrite стратегии (только deep merge).
- Нет `mcp-remote` fallback для агентов без remote-поддержки.
- MCP в отдельном файле (`mcp.yml`), а не inline в основном конфиге.

## Рекомендации

- **Merge/overwrite стратегия** -- средний приоритет. Добавить опцию
  `strategy: merge | overwrite` в `config.yml` или `mcp.yml`.
- **Расширение MCP-покрытия** -- высокий приоритет. Cursor (`.cursor/mcp.json`)
  и Windsurf (`.windsurf/mcp_config.json`) -- наиболее востребованные gaps.
- **mcp-remote fallback** -- низкий приоритет. Полезен, но привносит
  runtime-зависимость от `npx` и внешнего пакета. Рассмотреть как opt-in.
