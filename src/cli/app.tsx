/**
 * App — Ink-компонент CLI.
 * Spec: docs/specs/cli.md § Команда transpile, § Команда adapters, § Глобальные опции
 * Spec: docs/specs/clean-command.md § Команда clean, § Расширение команды transpile
 * Spec: docs/specs/init-command.md § Команда init
 * Spec: docs/specs/adapter-registry-ext.md § Процедура Resolve Adapter
 * Spec: docs/specs/help-command.md § Команда help
 */

import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import Spinner from "ink-spinner";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { marked } from "marked";
// @ts-expect-error marked-terminal has no type declarations
import { markedTerminal } from "marked-terminal";
import { Chalk } from "chalk";
import { adapterRegistry } from "./adapter-registry.js";
import { runTranspileStep } from "./transpile-step.js";
import { runOverlayStep } from "./overlay-step.js";
import { cleanFiles } from "./clean-files.js";
import { initFiles, createConfigFile } from "./init-files.js";
import { resolveAdaptersFromCLIArgs, loadConfig } from "./config.js";
import type {
  AdapterRegistryEntry,
  TranspilerStepOutcome,
  CleanOutcome,
  InitOutcome,
} from "./types.js";
import { createInstructionsTranspiler } from "../instructions-transpiler/index.js";
import { createSkillsTranspiler } from "../skills-transpiler/index.js";
import { createAgentsTranspiler } from "../agents-transpiler/index.js";
import {
  createResourceTranspiler,
  createResourceAdapter,
} from "../docs-transpiler/index.js";
import type { ResourceType } from "../docs-transpiler/index.js";
import { buildVariables, loadDotenv } from "../interpolation/index.js";
import { resolvePlugins } from "./resolve-plugins.js";
import type { ResolvedPlugin } from "./resolve-plugins.js";
import {
  resolvePluginValues,
  resolveLocalValues,
} from "./resolve-plugin-values.js";
import { buildLayers } from "./plugin-layers.js";
import { aggregateOutcomes } from "./plugin-aggregate.js";

// Re-export resolveDeps for backward compatibility (tests import from app.js)
export { resolveDeps } from "./resolve-deps.js";

interface AppProps {
  args: string[];
  projectRoot?: string;
}

/**
 * Парсит аргументы командной строки.
 */
function parseArgs(args: string[]): {
  command: string | null;
  helpTopic: string | null;
  unknownCommand: string | null;
  unknownFlag: string | null;
  agent: string | null;
  all: boolean;
  help: boolean;
  version: boolean;
  clean: boolean;
  force: boolean;
  verbose: boolean;
  refresh: boolean;
} {
  let command: string | null = null;
  let helpTopic: string | null = null;
  let unknownCommand: string | null = null;
  let unknownFlag: string | null = null;
  let agent: string | null = null;
  let all = false;
  let help = false;
  let version = false;
  let clean = false;
  let force = false;
  let verbose = false;
  let refresh = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help") {
      help = true;
    } else if (arg === "--version" || arg === "version") {
      version = true;
    } else if (
      (arg === "--agent" || arg === "--adapter") &&
      i + 1 < args.length
    ) {
      agent = args[i + 1];
      i++;
    } else if (arg === "--all") {
      all = true;
    } else if (arg === "--clean") {
      clean = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--verbose") {
      verbose = true;
    } else if (arg === "--refresh") {
      refresh = true;
    } else if (command === "help" && !arg.startsWith("-")) {
      // После распознавания help как команды, позиционный аргумент — topic
      helpTopic = arg;
    } else if (command === "cache" && arg === "clean") {
      // Subcommand: cache clean
      command = "cache-clean";
    } else if (
      arg === "transpile" ||
      arg === "adapters" ||
      arg === "clean" ||
      arg === "init" ||
      arg === "help" ||
      arg === "cache"
    ) {
      command = arg;
    } else if (arg.startsWith("-")) {
      unknownFlag = arg;
    } else {
      unknownCommand = arg;
    }
  }

  return {
    command,
    helpTopic,
    unknownCommand,
    unknownFlag,
    agent,
    all,
    help,
    version,
    clean,
    force,
    verbose,
    refresh,
  };
}

function getVersion(): string {
  const packageJsonPath = path.resolve(
    import.meta.dirname,
    "../../package.json",
  );
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  return packageJson.version;
}

function HelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>
        agloom — CLI for transpiling canonical Agloom configurations into
        agent-specific files.
      </Text>
      <Text> </Text>
      <Text>Commands:</Text>
      <Text>
        {"  "}adapters {"    "}List available adapters
      </Text>
      <Text>
        {"  "}clean {"       "}Remove generated agent-specific files
      </Text>
      <Text>
        {"  "}help {"        "}Show help topics or display a specific help topic
      </Text>
      <Text>
        {"  "}init {"        "}Import existing agent configs into .agloom/
      </Text>
      <Text>
        {"  "}transpile {"   "}Transpile canonical configs for a target adapter
      </Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--help {"      "}Show help
      </Text>
      <Text>
        {"  "}--version {"   "}Show version
      </Text>
    </Box>
  );
}

function TranspileHelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>
        Usage: agloom transpile [--adapter &lt;adapterId&gt; | --all] [--clean]
        [--verbose]
      </Text>
      <Text> </Text>
      <Text>
        Transpile canonical configs for all transpilers using the specified
        adapter.
      </Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--adapter &lt;adapterId&gt;{"  "}Adapter ID from the registry
      </Text>
      <Text>
        {"  "}--all {"                 "}Transpile for all supported agents
      </Text>
      <Text>
        {"  "}--clean {"               "}Clean before transpiling
      </Text>
      <Text>
        {"  "}--verbose {"             "}Show all steps including 0-file ones
      </Text>
    </Box>
  );
}

function AdaptersHelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Usage: agloom adapters [--all]</Text>
      <Text> </Text>
      <Text>Show active adapters from config, or all available adapters.</Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--all{"  "}Show all available adapters (not just those in config)
      </Text>
    </Box>
  );
}

function HelpCommandHelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Usage: agloom help [&lt;topic&gt;]</Text>
      <Text> </Text>
      <Text>Show help topics or display a specific help topic.</Text>
      <Text> </Text>
      <Text>Arguments:</Text>
      <Text>
        {"  "}&lt;topic&gt;{"  "}Help topic name (e.g., configuration,
        transpile)
      </Text>
    </Box>
  );
}

/**
 * Вычисляет абсолютный путь к директории документации.
 * Spec: docs/specs/help-command.md § Поведение шаг 2
 */
function getDocsDir(): string {
  return path.resolve(import.meta.dirname, "../../docs/usage");
}

interface TopicEntry {
  name: string;
  description: string;
}

/**
 * Извлекает описание из Markdown-файла: первая непустая строка после H1.
 */
function extractDescription(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let pastH1 = false;
    for (const line of lines) {
      if (line.startsWith("# ")) {
        pastH1 = true;
        continue;
      }
      if (pastH1 && line.trim() !== "") {
        return line.trim();
      }
    }
  } catch {
    // Ошибка чтения — описание недоступно
  }
  return "";
}

/**
 * Читает и возвращает отсортированный список topics из docs/usage/.
 * Spec: docs/specs/help-command.md § Поведение шаги 3-6
 */
function loadTopics(docsDir: string): TopicEntry[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(docsDir);
  } catch {
    // Расширение 3a: директория не существует → пустой список
    return [];
  }
  return entries
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      name: f.slice(0, -3),
      description: extractDescription(path.join(docsDir, f)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Форматирует вывод списка topics.
 * Spec: docs/specs/help-command.md § Вывод списка topics
 */
function formatTopicsList(topics: TopicEntry[]): string {
  const maxName = Math.max(...topics.map((t) => t.name.length));
  const lines = [
    "Available help topics:",
    "",
    ...topics.map((t) => `  ${t.name.padEnd(maxName + 3)}${t.description}`),
    "",
    "Run 'agloom help <topic>' to learn more.",
  ];
  return lines.join("\n");
}

function HelpCommandView({
  topic,
}: {
  topic: string | null;
}): React.ReactElement {
  const [output] = useState(() => {
    const docsDir = getDocsDir();
    const topics = loadTopics(docsDir);

    // § Поведение шаг 7: <topic> не указан — отобразить список topics
    if (topic === null) {
      // Расширение 7a: пустой список
      if (topics.length === 0) {
        process.exitCode = 1;
        return "No help topics available.";
      }
      return formatTopicsList(topics);
    }

    // § Поведение шаг 8: найти topic
    if (!topics.some((t) => t.name === topic)) {
      process.exitCode = 1;
      // Расширение 8b: пустой список
      if (topics.length === 0) {
        return `Unknown help topic: ${topic}.`;
      }
      // Расширение 8a: непустой список
      return `Unknown help topic: ${topic}.\n\n${formatTopicsList(topics)}`;
    }

    // § Поведение шаг 9: прочитать файл
    let content: string;
    try {
      content = fs.readFileSync(path.join(docsDir, `${topic}.md`), "utf-8");
    } catch {
      // Расширение 9a: ошибка чтения
      process.exitCode = 1;
      return `Failed to read help topic: ${topic}.`;
    }

    // § Поведение шаг 10: отрендерить Markdown
    try {
      const forcedChalk = new Chalk({ level: 1 });
      marked.use(
        markedTerminal({
          showSectionPrefix: false,
          firstHeading: forcedChalk.bold.underline,
          heading: forcedChalk.bold,
          code: forcedChalk.yellow,
          blockquote: forcedChalk.gray.italic,
          html: forcedChalk.gray,
          strong: forcedChalk.bold,
          em: forcedChalk.italic,
          codespan: forcedChalk.yellow,
          del: forcedChalk.dim.gray.strikethrough,
          link: forcedChalk.blue,
          href: forcedChalk.blue.underline,
        }),
      );
      return marked.parse(content, { async: false }).trimEnd();
    } catch {
      // Расширение 10a: ошибка рендеринга
      process.exitCode = 1;
      return `Failed to render help topic: ${topic}.`;
    }
  });

  return <Text>{output}</Text>;
}

function AdaptersView({
  projectRoot,
  all,
}: {
  projectRoot: string;
  all: boolean;
}): React.ReactElement {
  const [state] = useState(() => {
    let heading = "Available adapters:";
    let entries: AdapterRegistryEntry[];

    if (all) {
      // --all: все нескрытые адаптеры
      entries = adapterRegistry.filter((e) => !e.hidden);
    } else {
      // Без --all: Load Config
      try {
        const configResult = loadConfig(projectRoot);
        if (configResult !== null) {
          // Конфиг найден — показать активные
          heading = "Active adapters:";
          entries = configResult.adapterIds
            .map((id) => adapterRegistry.find((e) => e.id === id)!)
            .filter(Boolean);
        } else {
          // Конфиг отсутствует — показать все нескрытые
          entries = adapterRegistry.filter((e) => !e.hidden);
        }
      } catch (err) {
        // Load Config вернул ошибку → расширение 3a
        const message = err instanceof Error ? err.message : String(err);
        process.exitCode = 1;
        return {
          heading: "",
          entries: [] as AdapterRegistryEntry[],
          error: message,
        };
      }
    }

    return { heading, entries, error: null as string | null };
  });

  if (state.error) {
    return <Text>{state.error}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text>{state.heading}</Text>
      <Text> </Text>
      {state.entries.map((entry) => (
        <Text key={entry.id}>
          {"  "}
          {entry.id.padEnd(13)}
          {entry.description}
        </Text>
      ))}
    </Box>
  );
}

function CleanHelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>
        Usage: agloom clean [--adapter &lt;adapterId&gt; | --all] [--verbose]
      </Text>
      <Text> </Text>
      <Text>
        Remove generated agent-specific files for the specified adapter.
      </Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--adapter &lt;adapterId&gt;{"  "}Adapter ID from the registry
      </Text>
      <Text>
        {"  "}--all {"                 "}Clean for all supported adapters
      </Text>
      <Text>
        {"  "}--verbose {"             "}Show details even when 0 files removed
      </Text>
    </Box>
  );
}

function CleanResultView({
  adapterId,
  outcome,
}: {
  adapterId: string;
  outcome: CleanOutcome;
}): React.ReactElement {
  const hasErrors = outcome.errors.length > 0;

  return (
    <Box flexDirection="column">
      <Text>Cleaning for {adapterId}...</Text>
      {hasErrors ? (
        <Text>
          {"  "}
          <Text color="red">✗</Text> {outcome.errors[0]}
        </Text>
      ) : (
        <Text>
          {"  "}
          <Text color="green">✓</Text> {outcome.removedCount} files removed
        </Text>
      )}
    </Box>
  );
}

function CleanEntriesView({
  entries,
  projectRoot,
  verbose,
}: {
  entries: AdapterRegistryEntry[];
  projectRoot: string;
  verbose?: boolean;
}): React.ReactElement {
  const [results] = useState(() => {
    const outcomes: { adapterId: string; outcome: CleanOutcome }[] = [];
    let hasErrors = false;

    for (const entry of entries) {
      const result = cleanFiles(entry, projectRoot);
      outcomes.push({ adapterId: entry.id, outcome: result });
      if (result.errors.length > 0) {
        hasErrors = true;
      }
    }

    if (hasErrors) {
      process.exitCode = 1;
    }

    return outcomes;
  });

  const totalRemoved = results.reduce(
    (sum, r) => sum + r.outcome.removedCount,
    0,
  );
  const hasAnyErrors = results.some((r) => r.outcome.errors.length > 0);

  return (
    <Box flexDirection="column">
      {results.map((r) => {
        const hasErrors = r.outcome.errors.length > 0;
        const hasVisible = hasErrors || r.outcome.removedCount > 0 || verbose;
        if (!hasVisible) return null;
        return (
          <React.Fragment key={r.adapterId}>
            <Text>
              <Text color="green">✓</Text> Cleaning for {r.adapterId}...
            </Text>
            {hasErrors && (
              <Text>
                {"  "}
                <Text color="red">✗</Text> {r.outcome.errors[0]}
              </Text>
            )}
            {!hasErrors && (verbose || r.outcome.removedCount > 0) && (
              <Text>
                {"  "}
                <Text color="green">✓</Text> {r.outcome.removedCount} files
                removed
              </Text>
            )}
          </React.Fragment>
        );
      })}
      {!verbose && !hasAnyErrors && totalRemoved === 0 && (
        <Text>Nothing to clean.</Text>
      )}
      <Text> </Text>
      <Text>Done. {totalRemoved} files removed.</Text>
    </Box>
  );
}

function InitHelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>
        Usage: agloom init [--adapter &lt;adapterId&gt; | --all] [--force]
        [--verbose]
      </Text>
      <Text> </Text>
      <Text>Import existing agent configs into .agloom/</Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--adapter &lt;adapterId&gt;{"  "}Adapter identifier
      </Text>
      <Text>
        {"  "}--all {"                 "}Initialize all supported agents
      </Text>
      <Text>
        {"  "}--force {"               "}Overwrite existing files
      </Text>
      <Text>
        {"  "}--verbose {"             "}Show all steps including 0-file ones
      </Text>
    </Box>
  );
}

function InitView({
  entries,
  projectRoot,
  force,
  createConfig,
  configAdapterIds,
  verbose,
}: {
  entries: AdapterRegistryEntry[];
  projectRoot: string;
  force: boolean;
  createConfig: boolean;
  configAdapterIds: string[];
  verbose?: boolean;
}): React.ReactElement {
  // Все операции синхронные — вычисляем при инициализации состояния
  const [state] = useState(() => {
    // Pre-check: .agloom/ уже существует → fail без --force
    if (!force) {
      const agloomDir = path.join(projectRoot, ".agloom");
      if (fs.existsSync(agloomDir)) {
        process.exitCode = 1;
        return {
          error: ".agloom/ already exists. Use --force to reinitialize.",
          overlayResults: [] as {
            entryId: string;
            outcome: InitOutcome | string;
          }[],
        };
      }
    }

    // Шаг 5: создать config.yml при --adapter или --all
    if (createConfig) {
      try {
        createConfigFile(projectRoot, configAdapterIds);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.exitCode = 1;
        return {
          error: message,
          overlayResults: [] as {
            entryId: string;
            outcome: InitOutcome | string;
          }[],
        };
      }
    }

    const results: { entryId: string; outcome: InitOutcome | string }[] = [];
    let hasError = false;

    for (const entry of entries) {
      const result = initFiles(entry, projectRoot, force);
      results.push({ entryId: entry.id, outcome: result });

      if (typeof result === "string") {
        hasError = true;
        // Расширение 6a: строка-сообщение → exit code 1
        break;
      } else if (result.errors.length > 0) {
        hasError = true;
      }
    }

    // Set exit code
    if (hasError) {
      process.exitCode = 1;
    }

    return {
      error: null as string | null,
      overlayResults: results,
    };
  });

  const { error, overlayResults } = state;

  // Блокирующая ошибка (pre-check или config)
  if (error) {
    return <Text>{error}</Text>;
  }

  // Вычислить общее количество overlay-файлов
  const totalCopied = overlayResults.reduce((sum, r) => {
    if (typeof r.outcome !== "string") {
      return sum + r.outcome.copiedCount;
    }
    return sum;
  }, 0);

  const hasAnyErrors = overlayResults.some(
    (r) =>
      typeof r.outcome === "string" ||
      (typeof r.outcome !== "string" && r.outcome.errors.length > 0),
  );

  const hasVisibleResults = hasAnyErrors || totalCopied > 0 || verbose;

  return (
    <Box flexDirection="column">
      {hasVisibleResults && (
        <Text>
          <Text color="green">✓</Text> Initializing...
        </Text>
      )}
      {overlayResults.map((r) => {
        if (typeof r.outcome === "string") {
          return (
            <Text key={r.entryId}>
              {"  "}
              <Text color="red">✗</Text> {r.outcome}
            </Text>
          );
        }
        if (r.outcome.errors.length > 0) {
          return (
            <Text key={r.entryId}>
              {"  "}
              <Text color="red">✗</Text> {r.outcome.errors[0]}
            </Text>
          );
        }
        if (!verbose && r.outcome.copiedCount === 0) {
          return null;
        }
        return (
          <Text key={r.entryId}>
            {"  "}
            <Text color="green">✓</Text> {r.outcome.copiedCount} files copied to
            .agloom/overlays/{r.entryId}/
          </Text>
        );
      })}
      {!verbose && !hasAnyErrors && totalCopied === 0 && (
        <Text>Nothing to import.</Text>
      )}
      <Text> </Text>
      <Text>Done. {totalCopied} files copied.</Text>
    </Box>
  );
}

/**
 * Создаёт фабричную функцию транспилера ресурсов, привязанную к типу ресурса.
 * Spec: docs/specs/docs-transpiler.md § Расширение шага транспиляции
 */
function createResourceTranspilerFactory(resourceType: ResourceType) {
  return (config: {
    projectRoot: string;
    adapters: unknown[];
    agloomDir?: string;
  }) =>
    createResourceTranspiler({
      projectRoot: config.projectRoot,
      adapters: config.adapters as Parameters<
        typeof createResourceTranspiler
      >[0]["adapters"],
      resourceType,
      agloomDir: config.agloomDir,
    });
}

function TranspileView({
  entries,
  projectRoot,
  clean,
  verbose,
  singleAdapter,
  plugins = [],
  localValues = {},
}: {
  entries: AdapterRegistryEntry[];
  projectRoot: string;
  clean?: boolean;
  verbose?: boolean;
  singleAdapter?: string;
  plugins?: (ResolvedPlugin & { resolvedValues?: Record<string, string> })[];
  localValues?: Record<string, string>;
}): React.ReactElement {
  const { exit } = useApp();
  const [cleanOutcome, setCleanOutcome] = useState<CleanOutcome | null>(null);
  const [entryResults, setEntryResults] = useState<
    { adapterId: string; outcomes: TranspilerStepOutcome[] }[]
  >([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) exit();
  }, [done, exit]);

  useEffect(() => {
    // Шаг 4 (clean-command): При наличии флага --clean выполнить Clean Files
    let cleanResult: CleanOutcome | null = null;
    if (clean && singleAdapter) {
      const mainEntry = entries[entries.length - 1];
      cleanResult = cleanFiles(mainEntry, projectRoot);
      setCleanOutcome(cleanResult);
    } else if (clean) {
      // --all or config mode: clean silently
      for (const entry of entries) {
        const result = cleanFiles(entry, projectRoot);
        if (result.errors.length > 0) {
          cleanResult = cleanResult ?? { removedCount: 0, errors: [] };
          cleanResult.errors.push(...result.errors);
        }
      }
    }

    // Spec: docs/specs/interpolation.md § Расширение команды transpile шаг 2a
    // Загрузка .env один раз перед циклом по адаптерам
    loadDotenv(projectRoot);

    const results: {
      adapterId: string;
      outcomes: TranspilerStepOutcome[];
    }[] = [];

    // Шаг 5: для каждой записи из упорядоченного списка
    for (const entry of entries) {
      // Spec: docs/specs/interpolation.md § Расширение команды transpile
      // Построить карту переменных для текущей записи
      const variables = buildVariables(entry, adapterRegistry, projectRoot);

      // Установить переменные на адаптерах instructions и agents
      const instrAdapter = entry.instructions as {
        variables?: Record<string, string>;
        values?: Record<string, string>;
      };
      instrAdapter.variables = variables;
      if (entry.agents) {
        const agentsAdapter = entry.agents as {
          variables?: Record<string, string>;
          values?: Record<string, string>;
        };
        agentsAdapter.variables = variables;
      }

      // variablesByAgentId для skills transpiler
      const variablesByAgentId: Record<string, Record<string, string>> = {
        [entry.id]: variables,
      };

      // § plugin-loading.md § Расширение команды transpile шаги 4.2-4.5
      // § docs-transpiler.md § Расширение команды transpile шаги 4.2.4-4.2.5, 4.6-4.7
      // Собрать outcomes по типам шагов для агрегации
      const outcomeGroups: TranspilerStepOutcome[][] = [];

      // § docs-transpiler.md § Создание адаптеров в команде transpile
      // Создать docsAdapter и schemasAdapter один раз перед циклом по плагинам
      const docsAdapter = createResourceAdapter(entry, "docs");
      const schemasAdapter = createResourceAdapter(entry, "schemas");
      const docsFactory = createResourceTranspilerFactory("docs");
      const schemasFactory = createResourceTranspilerFactory("schemas");

      // Шаг 4.2: для каждого плагина
      for (const plugin of plugins) {
        const pluginOutcomes: TranspilerStepOutcome[] = [];

        // § plugin-values.md: per-plugin valuesByAgentId
        const pluginValuesByAgentId: Record<
          string,
          Record<string, string>
        > = plugin.resolvedValues ? { [entry.id]: plugin.resolvedValues } : {};

        // Установить values на адаптерах для текущего плагина
        instrAdapter.values = plugin.resolvedValues;
        if (entry.agents) {
          const agentsAdapterValues = entry.agents as {
            values?: Record<string, string>;
          };
          agentsAdapterValues.values = plugin.resolvedValues;
        }

        // 4.2.1: Instructions
        pluginOutcomes.push(
          runTranspileStep({
            transpilerFactory: createInstructionsTranspiler as Parameters<
              typeof runTranspileStep
            >[0]["transpilerFactory"],
            adapter: entry.instructions,
            projectRoot,
            name: "Instructions",
            sourceRoot: plugin.path,
          }),
        );

        // 4.2.2: Skills
        if (entry.skills) {
          pluginOutcomes.push(
            runTranspileStep({
              transpilerFactory: createSkillsTranspiler as Parameters<
                typeof runTranspileStep
              >[0]["transpilerFactory"],
              adapter: entry.skills,
              projectRoot,
              name: "Skills",
              variablesByAgentId,
              valuesByAgentId: pluginValuesByAgentId,
              sourceRoot: plugin.path,
            }),
          );
        }

        // 4.2.3: Agents
        if (entry.agents) {
          pluginOutcomes.push(
            runTranspileStep({
              transpilerFactory: createAgentsTranspiler as Parameters<
                typeof runTranspileStep
              >[0]["transpilerFactory"],
              adapter: entry.agents,
              projectRoot,
              name: "Agents",
              sourceRoot: plugin.path,
            }),
          );
        }

        // 4.2.4: Docs (plugin)
        if (docsAdapter !== null) {
          pluginOutcomes.push(
            runTranspileStep({
              transpilerFactory: docsFactory as Parameters<
                typeof runTranspileStep
              >[0]["transpilerFactory"],
              adapter: docsAdapter,
              projectRoot,
              name: "Docs",
              variablesByAgentId,
              valuesByAgentId: pluginValuesByAgentId,
              sourceRoot: plugin.path,
            }),
          );
        }

        // 4.2.5: Schemas (plugin)
        if (schemasAdapter !== null) {
          pluginOutcomes.push(
            runTranspileStep({
              transpilerFactory: schemasFactory as Parameters<
                typeof runTranspileStep
              >[0]["transpilerFactory"],
              adapter: schemasAdapter,
              projectRoot,
              name: "Schemas",
              variablesByAgentId,
              valuesByAgentId: pluginValuesByAgentId,
              sourceRoot: plugin.path,
            }),
          );
        }

        outcomeGroups.push(pluginOutcomes);
      }

      // Шаги 4.3-4.5: локальный проект
      const localOutcomes: TranspilerStepOutcome[] = [];

      // § plugin-values.md: local valuesByAgentId
      const localValuesByAgentId: Record<
        string,
        Record<string, string>
      > = Object.keys(localValues).length > 0
        ? { [entry.id]: localValues }
        : {};

      // Установить values на адаптерах для локального проекта
      instrAdapter.values = localValues;
      if (entry.agents) {
        const agentsAdapterValues = entry.agents as {
          values?: Record<string, string>;
        };
        agentsAdapterValues.values = localValues;
      }

      // 4.3: Instructions
      localOutcomes.push(
        runTranspileStep({
          transpilerFactory: createInstructionsTranspiler as Parameters<
            typeof runTranspileStep
          >[0]["transpilerFactory"],
          adapter: entry.instructions,
          projectRoot,
          name: "Instructions",
        }),
      );

      // 4.4: Skills
      if (entry.skills) {
        localOutcomes.push(
          runTranspileStep({
            transpilerFactory: createSkillsTranspiler as Parameters<
              typeof runTranspileStep
            >[0]["transpilerFactory"],
            adapter: entry.skills,
            projectRoot,
            name: "Skills",
            variablesByAgentId,
            valuesByAgentId: localValuesByAgentId,
          }),
        );
      }

      // 4.5: Agents
      if (entry.agents) {
        localOutcomes.push(
          runTranspileStep({
            transpilerFactory: createAgentsTranspiler as Parameters<
              typeof runTranspileStep
            >[0]["transpilerFactory"],
            adapter: entry.agents,
            projectRoot,
            name: "Agents",
          }),
        );
      }

      // 4.6: Docs (local project)
      if (docsAdapter !== null) {
        localOutcomes.push(
          runTranspileStep({
            transpilerFactory: docsFactory as Parameters<
              typeof runTranspileStep
            >[0]["transpilerFactory"],
            adapter: docsAdapter,
            projectRoot,
            name: "Docs",
            variablesByAgentId,
            valuesByAgentId: localValuesByAgentId,
          }),
        );
      }

      // 4.7: Schemas (local project)
      if (schemasAdapter !== null) {
        localOutcomes.push(
          runTranspileStep({
            transpilerFactory: schemasFactory as Parameters<
              typeof runTranspileStep
            >[0]["transpilerFactory"],
            adapter: schemasAdapter,
            projectRoot,
            name: "Schemas",
            variablesByAgentId,
            valuesByAgentId: localValuesByAgentId,
          }),
        );
      }

      outcomeGroups.push(localOutcomes);

      // Агрегация outcomes по типу шага
      const steps = aggregateOutcomes(outcomeGroups);

      // Шаг 4.6-4.7: формирование layers и overlay
      const layers = buildLayers({
        plugins: plugins.map((p) => ({
          name: p.name,
          path: p.path,
          resolvedValues: p.resolvedValues,
        })),
        projectRoot,
        entryId: entry.id,
        localValues,
      });
      steps.push(runOverlayStep({ entry, projectRoot, variables, layers }));

      results.push({ adapterId: entry.id, outcomes: steps });
    }

    setEntryResults(results);

    // Exit code
    const hasTranspileErrors = results.some((r) =>
      r.outcomes.some((s) => s.errors.length > 0),
    );
    const hasCleanErrors = cleanResult ? cleanResult.errors.length > 0 : false;
    if (hasTranspileErrors || hasCleanErrors) {
      process.exitCode = 1;
    }

    setDone(true);
  }, [entries, projectRoot, clean]);

  // totalWritten
  const totalWritten = entryResults.reduce(
    (sum, r) => sum + r.outcomes.reduce((s, o) => s + o.writtenCount, 0),
    0,
  );

  return (
    <Box flexDirection="column">
      {cleanOutcome && singleAdapter && (
        <>
          <CleanResultView adapterId={singleAdapter} outcome={cleanOutcome} />
          <Text> </Text>
        </>
      )}
      {entryResults.map((r) => {
        const visibleOutcomes = verbose
          ? r.outcomes
          : r.outcomes.filter((o) => o.writtenCount > 0 || o.errors.length > 0);
        if (!verbose && visibleOutcomes.length === 0) return null;
        const hasErrors = visibleOutcomes.some((o) => o.errors.length > 0);
        return (
          <React.Fragment key={r.adapterId}>
            <Text>
              {done ? (
                hasErrors ? (
                  <Text color="red">✗</Text>
                ) : (
                  <Text color="green">✓</Text>
                )
              ) : (
                <Spinner type="dots" />
              )}{" "}
              Transpiling for {r.adapterId}...
            </Text>
            {visibleOutcomes.map((outcome) =>
              outcome.errors.length === 0 ? (
                <Text key={`${r.adapterId}-${outcome.name}`}>
                  {"  "}
                  <Text color="green">✓</Text> {outcome.name.padEnd(14)}
                  {String(outcome.writtenCount).padStart(4)} files
                </Text>
              ) : (
                <React.Fragment key={`${r.adapterId}-${outcome.name}`}>
                  {outcome.errors.map((err, i) => (
                    <Text key={`${r.adapterId}-${outcome.name}-${i}`}>
                      {"  "}
                      {i === 0 ? (
                        <>
                          <Text color="red">✗</Text> {outcome.name.padEnd(14)}
                          {err}
                        </>
                      ) : (
                        <>
                          {"    "}
                          {err}
                        </>
                      )}
                    </Text>
                  ))}
                </React.Fragment>
              ),
            )}
          </React.Fragment>
        );
      })}
      {done &&
        !verbose &&
        totalWritten === 0 &&
        !entryResults.some((r) =>
          r.outcomes.some((o) => o.errors.length > 0),
        ) && <Text>Nothing to transpile.</Text>}
      {done && (
        <>
          <Text> </Text>
          <Text>
            {entryResults.some((r) =>
              r.outcomes.some((o) => o.errors.length > 0),
            )
              ? "Failed."
              : "Done."}{" "}
            {totalWritten} files written.
          </Text>
        </>
      )}
    </Box>
  );
}

/**
 * Spec: docs/specs/git-plugin-loading.md § Команда agloom cache clean
 */
function CacheCleanView(): React.ReactElement {
  const [output] = useState(() => {
    const cacheDir = path.join(os.homedir(), ".agloom", "cache", "plugins");

    // Шаг 2: проверить существование
    if (!fs.existsSync(cacheDir)) {
      // Расширение 2a
      return "Cache directory does not exist. Nothing to clean.";
    }

    // Шаг 3: рекурсивно удалить
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    } catch (err) {
      // Расширение 3a
      const message = err instanceof Error ? err.message : String(err);
      process.exitCode = 1;
      return `Failed to clean cache: ${message}`;
    }

    return "Cache cleaned: ~/.agloom/cache/plugins/";
  });

  return <Text>{output}</Text>;
}

export function App({ args, projectRoot }: AppProps): React.ReactElement {
  const parsed = parseArgs(args);
  const root = projectRoot ?? process.cwd();

  // § --version
  if (parsed.version) {
    return <Text>{getVersion()}</Text>;
  }

  // § Неизвестный флаг
  if (parsed.unknownFlag && !parsed.help) {
    process.exitCode = 1;
    return (
      <Text>
        Unknown option: {parsed.unknownFlag}. Run &apos;agloom --help&apos; to
        see available options.
      </Text>
    );
  }

  // § transpile --help
  if (parsed.command === "transpile" && parsed.help) {
    return <TranspileHelpView />;
  }

  // § clean --help
  if (parsed.command === "clean" && parsed.help) {
    return <CleanHelpView />;
  }

  // § init --help
  if (parsed.command === "init" && parsed.help) {
    return <InitHelpView />;
  }

  // § adapters --help
  if (parsed.command === "adapters" && parsed.help) {
    return <AdaptersHelpView />;
  }

  // § help --help (Spec: docs/specs/help-command.md § Справка)
  if (parsed.command === "help" && parsed.help) {
    return <HelpCommandHelpView />;
  }

  // § Команда help (Spec: docs/specs/help-command.md § Команда help)
  if (parsed.command === "help") {
    return <HelpCommandView topic={parsed.helpTopic} />;
  }

  // § Неизвестная команда
  if (parsed.unknownCommand && !parsed.help) {
    process.exitCode = 1;
    return (
      <Text>
        Unknown command: {parsed.unknownCommand}. Run &apos;agloom --help&apos;
        to see available commands.
      </Text>
    );
  }

  // § --help or no command
  if (parsed.help || parsed.command === null) {
    return <HelpView />;
  }

  // § Команда adapters
  if (parsed.command === "adapters") {
    return <AdaptersView projectRoot={root} all={parsed.all} />;
  }

  // § Команда init
  if (parsed.command === "init") {
    // Resolve Adapters from CLI Args
    let entries: AdapterRegistryEntry[];
    try {
      entries = resolveAdaptersFromCLIArgs({
        adapter: parsed.agent,
        all: parsed.all,
        projectRoot: root,
        command: "init",
      });
    } catch (err) {
      process.exitCode = 1;
      const message = err instanceof Error ? err.message : String(err);
      return <Text>{message}</Text>;
    }

    // Determine config adapter ids for config creation
    const createConfig = parsed.agent !== null || parsed.all;
    let configAdapterIds: string[] = [];
    if (parsed.agent) {
      configAdapterIds = [parsed.agent];
    } else if (parsed.all) {
      // All non-hidden adapters
      configAdapterIds = adapterRegistry
        .filter((e) => !e.hidden)
        .map((e) => e.id);
    }

    return (
      <InitView
        entries={entries}
        projectRoot={root}
        force={parsed.force}
        createConfig={createConfig}
        configAdapterIds={configAdapterIds}
        verbose={parsed.verbose}
      />
    );
  }

  // § Команда clean
  if (parsed.command === "clean") {
    // Resolve Adapters from CLI Args
    let entries: AdapterRegistryEntry[];
    try {
      entries = resolveAdaptersFromCLIArgs({
        adapter: parsed.agent,
        all: parsed.all,
        projectRoot: root,
        command: "clean",
      });
    } catch (err) {
      process.exitCode = 1;
      const message = err instanceof Error ? err.message : String(err);
      return <Text>{message}</Text>;
    }

    return (
      <CleanEntriesView
        entries={entries}
        projectRoot={root}
        verbose={parsed.verbose}
      />
    );
  }

  // § Команда cache clean
  // Spec: docs/specs/git-plugin-loading.md § Команда agloom cache clean
  if (parsed.command === "cache-clean") {
    return <CacheCleanView />;
  }

  // § Команда cache (без subcommand) → трактовать как неизвестную
  if (parsed.command === "cache") {
    process.exitCode = 1;
    return (
      <Text>
        Unknown command: cache. Run &apos;agloom --help&apos; to see available
        commands.
      </Text>
    );
  }

  // § Команда transpile
  if (parsed.command === "transpile") {
    // Resolve Adapters from CLI Args
    let entries: AdapterRegistryEntry[];
    try {
      entries = resolveAdaptersFromCLIArgs({
        adapter: parsed.agent,
        all: parsed.all,
        projectRoot: root,
        command: "transpile",
      });
    } catch (err) {
      process.exitCode = 1;
      const message = err instanceof Error ? err.message : String(err);
      return <Text>{message}</Text>;
    }

    // § plugin-loading.md § Расширение команды transpile шаги 3.1-3.3
    // § git-plugin-loading.md § Расширение команды transpile
    // Извлечь pluginEntries из результата Load Config
    let plugins: ResolvedPlugin[] = [];
    const configResult = loadConfig(root);
    const pluginEntries = configResult?.pluginEntries ?? null;

    if (pluginEntries !== null && pluginEntries.length > 0) {
      // Шаг 3.2: Resolve Plugins с pluginEntries и forceRefresh
      try {
        plugins = resolvePlugins({
          pluginEntries,
          projectRoot: root,
          forceRefresh: parsed.refresh,
        });
      } catch (err) {
        // Расширение 3.2a: ошибка → exit code 1
        process.exitCode = 1;
        const message = err instanceof Error ? err.message : String(err);
        return <Text>{message}</Text>;
      }
    } else {
      // Backward compatibility: try pluginPaths
      const pluginPaths = configResult?.pluginPaths ?? null;
      if (pluginPaths !== null && pluginPaths.length > 0) {
        try {
          plugins = resolvePlugins({ pluginPaths, projectRoot: root });
        } catch (err) {
          process.exitCode = 1;
          const message = err instanceof Error ? err.message : String(err);
          return <Text>{message}</Text>;
        }
      }
    }

    // § plugin-values.md § Расширение команды transpile шаги 3.4-3.6
    // Resolve local values
    let localResolvedValues: Record<string, string> = {};
    const configVariables = configResult?.configVariables ?? null;
    try {
      localResolvedValues = resolveLocalValues(
        configVariables,
        process.env as Record<string, string | undefined>,
      );
    } catch (err) {
      process.exitCode = 1;
      const message = err instanceof Error ? err.message : String(err);
      return <Text>{message}</Text>;
    }

    // Resolve plugin values
    let resolvedPlugins: (ResolvedPlugin & {
      resolvedValues: Record<string, string>;
    })[];
    try {
      resolvedPlugins = plugins.map((plugin) => {
        const resolvedValues = resolvePluginValues(
          plugin.manifest.variables,
          plugin.values,
          process.env as Record<string, string | undefined>,
        );
        return { ...plugin, resolvedValues };
      });
    } catch (err) {
      process.exitCode = 1;
      const message = err instanceof Error ? err.message : String(err);
      return <Text>{message}</Text>;
    }

    return (
      <TranspileView
        entries={entries}
        projectRoot={root}
        clean={parsed.clean}
        verbose={parsed.verbose}
        singleAdapter={parsed.agent ?? undefined}
        plugins={resolvedPlugins}
        localValues={localResolvedValues}
      />
    );
  }

  return <HelpView />;
}
