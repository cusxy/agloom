/**
 * App — Ink-компонент CLI.
 * Spec: docs/specs/cli.md § Команда transpile, § Команда adapters, § Глобальные опции
 * Spec: docs/specs/clean-command.md § Команда clean, § Расширение команды transpile
 * Spec: docs/specs/init-command.md § Команда init
 * Spec: docs/specs/adapter-registry-ext.md § Процедура Resolve Adapter
 * Spec: docs/specs/help-command.md § Команда help
 * Spec: docs/specs/format.md § Команда format
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
import matter from "gray-matter";
import { Chalk } from "chalk";
import { adapterRegistry } from "./adapter-registry.js";
import { runTranspileStep } from "./transpile-step.js";
import { runOverlayStep } from "./overlay-step.js";
import { cleanFiles } from "./clean-files.js";
import { initFiles, createConfigFile } from "./init-files.js";
import { resolveAdaptersFromCLIArgs } from "./config.js";
import type { LoadConfigResult } from "./config.js";
import { stripGlobalFlags } from "./resolve-global-flags.js";
import type { ResolvedPaths } from "./resolve-global-flags.js";
import type { RawConfig } from "./read-config-source.js";
import type { AdapterRegistryEntry, TranspilerStepOutcome, CleanOutcome, InitOutcome } from "./types.js";
import { createInstructionsTranspiler } from "../instructions-transpiler/index.js";
import { createSkillsTranspiler } from "../skills-transpiler/index.js";
import { createAgentsTranspiler } from "../agents-transpiler/index.js";
import { createCommandsTranspiler } from "../commands-transpiler/index.js";
import { createResourceTranspiler, createResourceAdapter } from "../docs-transpiler/index.js";
import { createMcpTranspiler } from "../mcp-transpiler/index.js";
import { createPermissionsTranspiler } from "../permissions-transpiler/index.js";
import type { ResourceType } from "../docs-transpiler/index.js";
import { buildVariables, loadDotenv } from "../interpolation/index.js";
import { resolvePlugins } from "./resolve-plugins.js";
import type { ResolvedPlugin } from "./resolve-plugins.js";
import { resolvePluginValues, resolveLocalValues } from "./resolve-plugin-values.js";
import { buildLayers } from "./plugin-layers.js";
import { aggregateOutcomes } from "./plugin-aggregate.js";
import { createMarkdownTools } from "@agloom/markdown-tools";
import type { FormatResult, CheckResult } from "@agloom/markdown-tools";
import fg from "fast-glob";
import { normalizeGlobPatterns } from "./normalize-glob-patterns.js";

// Re-export resolveDeps for backward compatibility (tests import from app.js)
export { resolveDeps } from "./resolve-deps.js";

interface AppProps {
  args: string[];
  /**
   * Front-end pipeline result computed by `runCLI`. Always injected —
   * `App` is a pure rendering component and does not resolve paths by
   * itself.
   *
   * Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
   */
  paths: ResolvedPaths;
  /**
   * Raw config captured by `runCLI` via Read Config Source. Passed down
   * to command handlers (e.g. `format`) that need direct access to
   * fields outside of Load Config's surface area, while respecting the
   * single-I/O invariant (no re-reads of `configSource`).
   */
  rawConfig: RawConfig;
  /**
   * Loaded config result produced by `runCLI`. `null` indicates Load
   * Config was skipped (e.g. when `rawConfig.kind === "missing"` is
   * normalized to an empty result).
   */
  loadedConfig: LoadConfigResult | null;
}

/**
 * Парсит аргументы командной строки.
 *
 * Spec: docs/specs/cli.md § Команда transpile § Аргументы — `--adapter`
 *   повторяемый, значения накапливаются в массив `adapterIds` в порядке
 *   появления.
 */
export function parseArgs(args: string[]): {
  command: string | null;
  helpTopic: string | null;
  unknownCommand: string | null;
  unknownFlag: string | null;
  adapterIds: string[];
  globs: string[];
  all: boolean;
  help: boolean;
  version: boolean;
  clean: boolean;
  force: boolean;
  verbose: boolean;
  refresh: boolean;
  check: boolean;
} {
  let command: string | null = null;
  let helpTopic: string | null = null;
  let unknownCommand: string | null = null;
  let unknownFlag: string | null = null;
  const adapterIds: string[] = [];
  const globs: string[] = [];
  let all = false;
  let help = false;
  let version = false;
  let clean = false;
  let force = false;
  let verbose = false;
  let refresh = false;
  let check = false;

  // Глобальные флаги (--project-dir/--agloom-dir/--config) резолвятся
  // front-end пайплайном (resolveGlobalFlags). Вырезаем их единой точкой
  // логики из resolve-global-flags.ts, чтобы не дублировать синтаксис
  // глобальных флагов в parseArgs.
  // Spec: docs/specs/cli-global-flags.md § Процедура Resolve Global Flags
  const localArgs = stripGlobalFlags(args);

  for (let i = 0; i < localArgs.length; i++) {
    const arg = localArgs[i];
    if (arg === "--help") {
      help = true;
    } else if (arg === "--version" || arg === "version") {
      version = true;
    } else if ((arg === "--agent" || arg === "--adapter") && i + 1 < localArgs.length) {
      adapterIds.push(localArgs[i + 1]);
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
    } else if (arg === "--check") {
      check = true;
    } else if (command === "help" && !arg.startsWith("-")) {
      // После распознавания help как команды, позиционный аргумент — topic
      helpTopic = arg;
    } else if (command === "format" && !arg.startsWith("-")) {
      // После распознавания format как команды, позиционный аргумент — glob
      globs.push(arg);
    } else if (command === "cache" && arg === "clean") {
      // Subcommand: cache clean
      command = "cache-clean";
    } else if (
      arg === "transpile" ||
      arg === "adapters" ||
      arg === "clean" ||
      arg === "init" ||
      arg === "help" ||
      arg === "cache" ||
      arg === "format"
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
    adapterIds,
    globs,
    all,
    help,
    version,
    clean,
    force,
    verbose,
    refresh,
    check,
  };
}

function getVersion(): string {
  const packageJsonPath = path.resolve(import.meta.dirname, "../../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  return packageJson.version;
}

/**
 * Хук, детерминистично завершающий Ink render после первого commit.
 * Используется всеми static views (HelpView, AdaptersView, InitView,
 * CacheCleanView, error-views), чтобы `runCLI.waitUntilExit()` резолвился
 * без race против таймаута. Async views (TranspileView, FormatView) имеют
 * собственный `exit()` в useEffect после завершения асинхронной работы —
 * этот хук им не нужен.
 *
 * Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
 */
function useExitOnMount(): void {
  const { exit } = useApp();
  useEffect(() => {
    exit();
  }, [exit]);
}

/**
 * Wrapper-компонент, вызывающий `useExitOnMount` перед рендером children.
 * Позволяет применять детерминистичный выход к static JSX inline в App-
 * level диспатче без оборачивания каждого listed return в отдельный
 * компонент.
 */
function StaticExit({ children }: { children: React.ReactNode }): React.ReactElement {
  useExitOnMount();
  return <>{children}</>;
}

function HelpView(): React.ReactElement {
  useExitOnMount();
  return (
    <Box flexDirection="column">
      <Text>agloom — CLI for transpiling canonical Agloom configurations into agent-specific files.</Text>
      <Text> </Text>
      <Text>Commands:</Text>
      <Text>
        {"  "}adapters {"    "}List available adapters
      </Text>
      <Text>
        {"  "}clean {"       "}Remove generated agent-specific files
      </Text>
      <Text>
        {"  "}format {"      "}Format and lint project files
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
  useExitOnMount();
  return (
    <Box flexDirection="column">
      <Text>Usage: agloom transpile [--adapter &lt;adapterId&gt;]... [--all] [--clean] [--verbose]</Text>
      <Text> </Text>
      <Text>Transpile canonical configs for all transpilers using the specified adapter.</Text>
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
  useExitOnMount();
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
  useExitOnMount();
  return (
    <Box flexDirection="column">
      <Text>Usage: agloom help [&lt;topic&gt;]</Text>
      <Text> </Text>
      <Text>Show help topics or display a specific help topic.</Text>
      <Text> </Text>
      <Text>Arguments:</Text>
      <Text>
        {"  "}&lt;topic&gt;{"  "}Help topic name (e.g., guide/getting-started, reference/cli)
      </Text>
    </Box>
  );
}

/**
 * Вычисляет абсолютный путь к базовой директории документации.
 * Spec: docs/specs/help-command.md § Поведение шаг 2
 *
 * Env var `AGLOOM_DOCS_DIR` переопределяет путь — используется тестами
 * для изоляции от реальной директории `docs/` (избегает кросс-воркерной
 * пересечения с другими spec-файлами, которые читают help topics).
 */
function getBaseDocsDir(): string {
  const override = process.env.AGLOOM_DOCS_DIR;
  if (override !== undefined && override !== "") {
    return path.resolve(override);
  }
  return path.resolve(import.meta.dirname, "../../docs");
}

/**
 * Spec: docs/specs/help-command.md § DocCategory
 */
interface DocCategory {
  id: string;
  label: string;
  order: number;
}

const DOC_CATEGORIES: DocCategory[] = [
  { id: "guide", label: "Guide", order: 1 },
  { id: "reference", label: "Reference", order: 2 },
];

/**
 * Spec: docs/specs/help-command.md § TopicEntry
 */
interface TopicEntry {
  name: string;
  description: string;
  prev: string | undefined;
  next: string | undefined;
  category: string;
}

/**
 * Resolves a doubly-linked list of topics into sorted order.
 * Each topic has `prev` and `next` fields pointing to slugs in the same category.
 * Head = topic with no `prev`. Tail = topic with no `next`.
 * Topics not reachable from the chain are appended as orphans sorted alphabetically.
 *
 * Spec: docs/specs/help-command.md § Команда help § Поведение шаг 7
 * Extensions: 7a (no head), 7b (multiple heads), 7c (broken next ref)
 */
function resolveLinkedList(topics: TopicEntry[]): TopicEntry[] {
  if (topics.length === 0) return [];

  // Build map: slug → topic
  const bySlug = new Map<string, TopicEntry>();
  for (const t of topics) {
    const slug = t.name.split("/")[1];
    bySlug.set(slug, t);
  }

  // Find heads: topics with prev === undefined
  const heads = topics.filter((t) => t.prev === undefined);

  // Extension 7a: no head found → all topics are orphans, sorted alphabetically
  if (heads.length === 0) {
    return [...topics].sort((a, b) => {
      const slugA = a.name.split("/")[1];
      const slugB = b.name.split("/")[1];
      return slugA.localeCompare(slugB);
    });
  }

  // Extension 7b: multiple heads → pick alphabetically first slug as head
  let head: TopicEntry;
  if (heads.length === 1) {
    head = heads[0];
  } else {
    heads.sort((a, b) => {
      const slugA = a.name.split("/")[1];
      const slugB = b.name.split("/")[1];
      return slugA.localeCompare(slugB);
    });
    head = heads[0];
  }

  // Walk next pointers to build chain
  const sorted: TopicEntry[] = [];
  const visited = new Set<string>();
  let current: TopicEntry | undefined = head;

  while (current) {
    const slug = current.name.split("/")[1];
    if (visited.has(slug)) break; // Guard against cycles
    sorted.push(current);
    visited.add(slug);

    // Extension 7c: next references non-existent slug → stop walk
    if (current.next === undefined) break;
    current = bySlug.get(current.next);
  }

  // Collect orphans (not in chain), sorted alphabetically by slug
  const orphans = topics
    .filter((t) => !visited.has(t.name.split("/")[1]))
    .sort((a, b) => {
      const slugA = a.name.split("/")[1];
      const slugB = b.name.split("/")[1];
      return slugA.localeCompare(slugB);
    });

  sorted.push(...orphans);
  return sorted;
}

/**
 * Читает и возвращает отсортированный список topics из docs/guide/ и docs/reference/.
 * Spec: docs/specs/help-command.md § Поведение шаги 3-7
 */
function loadTopics(baseDocsDir: string): TopicEntry[] {
  const allTopics: TopicEntry[] = [];

  for (const category of DOC_CATEGORIES) {
    const categoryDir = path.join(baseDocsDir, category.id);
    let entries: string[];
    try {
      entries = fs.readdirSync(categoryDir);
    } catch {
      // Расширение 3a: директория не существует → пустой список для этой категории
      continue;
    }

    const mdFiles = entries.filter((f) => f.endsWith(".md"));

    const categoryTopics: TopicEntry[] = [];
    for (const file of mdFiles) {
      const slug = file.slice(0, -3);
      let content: string;
      try {
        content = fs.readFileSync(path.join(categoryDir, file), "utf-8");
      } catch {
        // Файл не может быть прочитан (например, нет прав) —
        // включить в список с defaults, ошибка проявится при шаге 10
        categoryTopics.push({
          name: `${category.id}/${slug}`,
          description: "",
          prev: undefined,
          next: undefined,
          category: category.id,
        });
        continue;
      }

      // Расширение 5a: файл без валидного YAML frontmatter → skip
      const parsed = matter(content);
      if (!parsed.data || Object.keys(parsed.data).length === 0) {
        continue;
      }

      categoryTopics.push({
        name: `${category.id}/${slug}`,
        // Расширение 5b: без description → ""
        description: typeof parsed.data.description === "string" ? parsed.data.description : "",
        // Расширение 5c: без prev/next → undefined (orphan)
        prev: typeof parsed.data.prev === "string" ? parsed.data.prev : undefined,
        next: typeof parsed.data.next === "string" ? parsed.data.next : undefined,
        category: category.id,
      });
    }

    // Шаг 7: resolve linked list order
    const sorted = resolveLinkedList(categoryTopics);
    allTopics.push(...sorted);
  }

  return allTopics;
}

/**
 * Форматирует категоризированный вывод списка topics.
 * Spec: docs/specs/help-command.md § Вывод списка topics
 */
function formatTopicsList(topics: TopicEntry[]): string {
  const maxName = Math.max(...topics.map((t) => t.name.length));
  const lines: string[] = ["Available help topics:", ""];

  // Группировка по категориям в порядке DOC_CATEGORIES
  let firstCategory = true;
  for (const category of DOC_CATEGORIES) {
    const categoryTopics = topics.filter((t) => t.category === category.id);
    if (categoryTopics.length === 0) continue;

    if (!firstCategory) {
      lines.push("");
    }
    firstCategory = false;

    lines.push(`  ${category.label}:`);
    for (const t of categoryTopics) {
      lines.push(`    ${t.name.padEnd(maxName + 2)}${t.description}`);
    }
  }

  lines.push("");
  lines.push("Run 'agloom help <topic>' to learn more.");
  return lines.join("\n");
}

/**
 * Разрешает имя topic.
 * Spec: docs/specs/help-command.md § Разрешение имени topic
 */
function resolveTopic(topicArg: string, topics: TopicEntry[]): { entry: TopicEntry } | { error: string } {
  if (topicArg.includes("/")) {
    // Шаг 1: интерпретировать как {category}/{slug}
    const found = topics.find((t) => t.name === topicArg);
    if (found) {
      return { entry: found };
    }
    // Расширение 1a/1b
    if (topics.length === 0) {
      return { error: `Unknown help topic: ${topicArg}.` };
    }
    return {
      error: `Unknown help topic: ${topicArg}.\n\n${formatTopicsList(topics)}`,
    };
  }

  // Шаг 2: без "/" — поиск по slug
  const matches = topics.filter((t) => t.name.split("/")[1] === topicArg);

  if (matches.length === 1) {
    return { entry: matches[0] };
  }

  if (matches.length > 1) {
    // Расширение 2a: ambiguous
    const namesList = matches.map((m) => `  ${m.name}`).join("\n");
    return {
      error: `Ambiguous help topic: ${topicArg}. Did you mean one of these?\n\n${namesList}`,
    };
  }

  // Расширение 2b/2c: не найден
  if (topics.length === 0) {
    return { error: `Unknown help topic: ${topicArg}.` };
  }
  return {
    error: `Unknown help topic: ${topicArg}.\n\n${formatTopicsList(topics)}`,
  };
}

function HelpCommandView({ topic }: { topic: string | null }): React.ReactElement {
  useExitOnMount();
  const [output] = useState(() => {
    const baseDocsDir = getBaseDocsDir();
    const topics = loadTopics(baseDocsDir);

    // § Поведение шаг 8: <topic> не указан — отобразить список topics
    if (topic === null) {
      // Расширение 8a: пустой список
      if (topics.length === 0) {
        process.exitCode = 1;
        return "No help topics available.";
      }
      return formatTopicsList(topics);
    }

    // § Поведение шаг 9: разрешить topic
    const resolved = resolveTopic(topic, topics);
    if ("error" in resolved) {
      process.exitCode = 1;
      return resolved.error;
    }

    const entry = resolved.entry;
    const slug = entry.name.split("/")[1];
    const filePath = path.join(baseDocsDir, entry.category, `${slug}.md`);

    // § Поведение шаг 10: прочитать файл
    let rawContent: string;
    try {
      rawContent = fs.readFileSync(filePath, "utf-8");
    } catch {
      // Расширение 10a: ошибка чтения
      process.exitCode = 1;
      return `Failed to read help topic: ${topic}.`;
    }

    // § Поведение шаг 11: strip frontmatter
    const parsed = matter(rawContent);
    const content = parsed.content;

    // § Поведение шаг 12: отрендерить Markdown
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
      // Расширение 12a: ошибка рендеринга
      process.exitCode = 1;
      return `Failed to render help topic: ${topic}.`;
    }
  });

  return <Text>{output}</Text>;
}

function AdaptersView({
  loadedConfig,
  all,
}: {
  loadedConfig: LoadConfigResult | null;
  all: boolean;
}): React.ReactElement {
  useExitOnMount();
  const [state] = useState(() => {
    let heading = "Available adapters:";
    let entries: AdapterRegistryEntry[];

    if (all) {
      // --all: все нескрытые адаптеры
      entries = adapterRegistry.filter((e) => !e.hidden);
    } else if (loadedConfig !== null && loadedConfig.adapterIds !== null) {
      // Конфиг найден и содержит поле adapters — показать активные
      heading = "Active adapters:";
      entries = loadedConfig.adapterIds.map((id) => adapterRegistry.find((e) => e.id === id)!).filter(Boolean);
    } else {
      // Конфиг отсутствует или поле adapters отсутствует — показать все нескрытые
      entries = adapterRegistry.filter((e) => !e.hidden);
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
  useExitOnMount();
  return (
    <Box flexDirection="column">
      <Text>Usage: agloom clean [--adapter &lt;adapterId&gt;]... [--all] [--verbose]</Text>
      <Text> </Text>
      <Text>Remove generated agent-specific files for the specified adapter(s).</Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--adapter &lt;adapterId&gt;{"  "}Adapter ID from the registry (may be repeated)
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

function CleanResultView({ adapterId, outcome }: { adapterId: string; outcome: CleanOutcome }): React.ReactElement {
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
  useExitOnMount();
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

  const totalRemoved = results.reduce((sum, r) => sum + r.outcome.removedCount, 0);
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
                <Text color="green">✓</Text> {r.outcome.removedCount} files removed
              </Text>
            )}
          </React.Fragment>
        );
      })}
      {!verbose && !hasAnyErrors && totalRemoved === 0 && <Text>Nothing to clean.</Text>}
      <Text> </Text>
      <Text>Done. {totalRemoved} files removed.</Text>
    </Box>
  );
}

/**
 * Spec: docs/specs/format.md § Расширение --help
 */
function FormatHelpView(): React.ReactElement {
  useExitOnMount();
  return (
    <Box flexDirection="column">
      <Text>Usage: agloom format [--check] [--all] [&lt;file|glob&gt;...]</Text>
      <Text> </Text>
      <Text>Format and lint project files (Markdown, JSON, YAML, TOML).</Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--check{"  "}Check files without modifying (exit code 1 if unformatted)
      </Text>
      <Text>
        {"  "}--all{"    "}Format all supported files in the project
      </Text>
    </Box>
  );
}

/**
 * Spec: docs/specs/format.md § Команда format, § TUI-отображение, § Exit codes
 */
function FormatView({
  projectRoot,
  resourcesRoot,
  rawConfig,
  check,
  globs,
  all,
}: {
  projectRoot: string;
  resourcesRoot: string;
  rawConfig: RawConfig;
  check: boolean;
  globs: string[];
  all: boolean;
}): React.ReactElement {
  const { exit } = useApp();
  // § Расширение 1a: --all и <file|glob>... взаимоисключающие (sync check)
  const conflictError = all && globs.length > 0 ? "Cannot use --all with file arguments." : null;

  const [status, setStatus] = useState<
    | { phase: "running" }
    | { phase: "done"; result: FormatResult | CheckResult; isCheck: boolean }
    | { phase: "error"; message: string }
    | { phase: "empty" }
  >(() => (conflictError ? { phase: "error", message: conflictError } : { phase: "running" }));

  // Exit after final render (same pattern as TranspileView)
  useEffect(() => {
    if (status.phase !== "running") exit();
  }, [status, exit]);

  // Set exit code synchronously for conflict error
  if (conflictError) {
    process.exitCode = 1;
  }

  useEffect(() => {
    if (conflictError) return;

    (async () => {
      try {
        // § Команда format шаг 3-4: определить glob-паттерны и раскрыть.
        // Дефолтный паттерн `.agloom/**/*` раскрывается относительно
        // resourcesRoot (а не projectRoot + '.agloom'), чтобы кастомная
        // директория от --agloom-dir обрабатывалась тем же паттерном.
        // Spec: docs/specs/format.md § Команда format шаг 4.
        const resourcesAgloomPattern = path.relative(projectRoot, resourcesRoot) || ".";
        const defaultPatterns = [`${resourcesAgloomPattern}/**/*.{md,mdx,json,yaml,yml,toml}`, "**/AGLOOM.md"];
        let patterns: string[];
        if (all) {
          patterns = ["**/*.{md,mdx,json,yaml,yml,toml}"];
        } else if (globs.length > 0) {
          patterns = globs;
        } else {
          patterns = defaultPatterns;
        }
        const ignore = [
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
          "**/coverage/**",
          "**/.next/**",
          "**/.turbo/**",
          "**/.cache/**",
        ];

        // § Команда format шаг 4: нормализация glob-паттернов
        const normalizedPatterns = normalizeGlobPatterns(patterns);

        const filePaths = await fg(normalizedPatterns, {
          cwd: projectRoot,
          absolute: true,
          ignore,
          dot: true,
        });

        // § Расширение 4a: нет файлов
        if (filePaths.length === 0) {
          setStatus({ phase: "empty" });
          return;
        }

        // § Команда format шаг 5: прочитать секции prettier/markdownlint
        // ИЗ rawConfig, полученного от run-cli (single-I/O инвариант).
        // Spec: docs/specs/format.md § Команда format шаг 5.
        let prettierOverrides: Record<string, unknown> = {};
        let markdownlintOverrides: Record<string, unknown> = {};
        if (rawConfig.kind === "parsed") {
          const parsed = rawConfig.value;
          if (parsed.prettier && typeof parsed.prettier === "object") {
            prettierOverrides = parsed.prettier as Record<string, unknown>;
          }
          if (parsed.markdownlint && typeof parsed.markdownlint === "object") {
            markdownlintOverrides = parsed.markdownlint as Record<string, unknown>;
          }
        }

        // § Команда format шаг 6: создать экземпляр
        const tools = createMarkdownTools({
          projectRoot,
          prettierOverrides,
          markdownlintOverrides,
        });

        // § Команда format шаг 7-8: вызвать check или format
        if (check) {
          const result = await tools.check(filePaths);
          const hasFailures = result.failures.length > 0 || result.errors.length > 0;
          if (hasFailures) process.exitCode = 1;
          setStatus({ phase: "done", result, isCheck: true });
        } else {
          const result = await tools.format(filePaths);
          // § Exit codes (C4): exit 1 если failures или errors непусты.
          if (result.failures.length > 0 || result.errors.length > 0) {
            process.exitCode = 1;
          }
          setStatus({ phase: "done", result, isCheck: false });
        }
      } catch (err) {
        process.exitCode = 1;
        setStatus({
          phase: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, [projectRoot, resourcesRoot, rawConfig, check, globs, all, conflictError]);

  if (status.phase === "running") {
    return (
      <Text>
        <Spinner type="dots" /> {check ? "Checking files…" : "Formatting files…"}
      </Text>
    );
  }

  if (status.phase === "empty") {
    return <Text>No files found.</Text>;
  }

  if (status.phase === "error") {
    return (
      <Text>
        <Text color="red">✗</Text> {status.message}
      </Text>
    );
  }

  // § TUI-отображение
  const { result, isCheck } = status;

  if (isCheck) {
    const r = result as CheckResult;
    const hasFailures = r.failures.length > 0;
    const hasErrors = r.errors.length > 0;

    if (!hasFailures && !hasErrors) {
      return (
        <Text>
          <Text color="green">✓</Text> All {r.checkedCount} files are formatted.
        </Text>
      );
    }

    return (
      <Box flexDirection="column">
        {hasFailures && (
          <>
            <Text>
              <Text color="red">✗</Text> {r.failures.length} files need formatting:
            </Text>
            {r.failures.map((f, i) => (
              <Text key={i}>
                {"  "}
                {f}
              </Text>
            ))}
          </>
        )}
        {hasErrors && (
          <>
            <Text> </Text>
            <Text>Errors:</Text>
            {r.errors.map((e, i) => (
              <Text key={i}>
                {"  "}
                {e}
              </Text>
            ))}
          </>
        )}
      </Box>
    );
  }

  // Format mode — § TUI-отображение § Режим format (C5)
  const r = result as FormatResult;
  const hasFailures = r.failures.length > 0;
  const hasErrors = r.errors.length > 0;

  // Case 1: полный успех
  if (!hasFailures && !hasErrors) {
    return (
      <Text>
        <Text color="green">✓</Text> Formatted {r.formattedCount} files.
      </Text>
    );
  }

  // Case 3: только errors (failures пуст)
  if (!hasFailures && hasErrors) {
    return (
      <Box flexDirection="column">
        <Text>
          <Text color="red">✗</Text> Formatted {r.formattedCount} files with {r.errors.length} errors.
        </Text>
        {r.errors.map((e, i) => (
          <Text key={i}>
            {"  "}
            {e}
          </Text>
        ))}
      </Box>
    );
  }

  // Case 2 (failures only) и Case 4 (failures + errors)
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="red">✗</Text> Formatted {r.formattedCount} files, but {r.failures.length} files still need
        attention:
      </Text>
      {r.failures.map((f, i) => (
        <Text key={i}>
          {"  "}
          {f}
        </Text>
      ))}
      {hasErrors && (
        <>
          <Text> </Text>
          <Text>Errors:</Text>
          {r.errors.map((e, i) => (
            <Text key={i}>
              {"  "}
              {e}
            </Text>
          ))}
        </>
      )}
    </Box>
  );
}

function InitHelpView(): React.ReactElement {
  useExitOnMount();
  return (
    <Box flexDirection="column">
      <Text>Usage: agloom init [--adapter &lt;adapterId&gt;]... [--all] [--force] [--verbose]</Text>
      <Text> </Text>
      <Text>Import existing agent configs into .agloom/</Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--adapter &lt;adapterId&gt;{"  "}Adapter identifier (may be repeated)
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
  resourcesRoot,
  force,
  createConfig,
  configAdapterIds,
  verbose,
}: {
  entries: AdapterRegistryEntry[];
  projectRoot: string;
  resourcesRoot: string;
  force: boolean;
  createConfig: boolean;
  configAdapterIds: string[];
  verbose?: boolean;
}): React.ReactElement {
  useExitOnMount();
  // Все операции синхронные — вычисляем при инициализации состояния
  const [state] = useState(() => {
    // Шаг 4 (C5 smart check): resourcesRoot считается инициализированным,
    // если существует config.yml ИЛИ непустая overlays/.
    // Spec: docs/specs/init-command.md § Поведение шаг 4, расширения 4a-4d.
    if (!force) {
      const configFile = path.join(resourcesRoot, "config.yml");
      const overlaysDir = path.join(resourcesRoot, "overlays");

      let alreadyInitialized = false;
      if (fs.existsSync(configFile) && fs.statSync(configFile).isFile()) {
        alreadyInitialized = true;
      } else if (fs.existsSync(overlaysDir)) {
        try {
          const entries = fs.readdirSync(overlaysDir);
          if (entries.length > 0) alreadyInitialized = true;
        } catch {
          /* ignore */
        }
      }

      if (alreadyInitialized) {
        process.exitCode = 1;
        return {
          error: `${resourcesRoot} already initialized. Use --force to reinitialize.`,
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
        createConfigFile(resourcesRoot, configAdapterIds);
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
      const result = initFiles(entry, projectRoot, resourcesRoot, force);
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
    (r) => typeof r.outcome === "string" || (typeof r.outcome !== "string" && r.outcome.errors.length > 0),
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
            <Text color="green">✓</Text> {r.outcome.copiedCount} files copied to .agloom/overlays/{r.entryId}/
          </Text>
        );
      })}
      {!verbose && !hasAnyErrors && totalCopied === 0 && <Text>Nothing to import.</Text>}
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
  return (config: { projectRoot: string; adapters: unknown[]; agloomDir?: string }) =>
    createResourceTranspiler({
      projectRoot: config.projectRoot,
      adapters: config.adapters as Parameters<typeof createResourceTranspiler>[0]["adapters"],
      resourceType,
      agloomDir: config.agloomDir,
    });
}

export function TranspileView({
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
  const [entryResults, setEntryResults] = useState<{ adapterId: string; outcomes: TranspilerStepOutcome[] }[]>([]);
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
        const pluginValuesByAgentId: Record<string, Record<string, string>> = plugin.resolvedValues
          ? { [entry.id]: plugin.resolvedValues }
          : {};

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

        // 4.2.1.5: Commands
        if (entry.commands) {
          pluginOutcomes.push(
            runTranspileStep({
              transpilerFactory: createCommandsTranspiler as Parameters<
                typeof runTranspileStep
              >[0]["transpilerFactory"],
              adapter: entry.commands,
              projectRoot,
              name: "Commands",
              variablesByAgentId,
              valuesByAgentId: pluginValuesByAgentId,
              sourceRoot: plugin.path,
            }),
          );
        }

        // 4.2.2: Skills
        if (entry.skills) {
          pluginOutcomes.push(
            runTranspileStep({
              transpilerFactory: createSkillsTranspiler as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
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
              transpilerFactory: createAgentsTranspiler as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
              adapter: entry.agents,
              projectRoot,
              name: "Agents",
              sourceRoot: plugin.path,
            }),
          );
        }

        // 4.2.MCP: MCP (plugin)
        if (entry.mcp !== null) {
          pluginOutcomes.push(
            runTranspileStep({
              transpilerFactory: createMcpTranspiler as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
              adapter: entry.mcp,
              projectRoot,
              name: "MCP",
              variablesByAgentId,
              valuesByAgentId: pluginValuesByAgentId,
              sourceRoot: plugin.path,
            }),
          );
        }

        // 4.2.Permissions: Permissions (plugin)
        if (entry.permissions !== null) {
          pluginOutcomes.push(
            runTranspileStep({
              transpilerFactory: createPermissionsTranspiler as Parameters<
                typeof runTranspileStep
              >[0]["transpilerFactory"],
              adapter: entry.permissions,
              projectRoot,
              name: "Permissions",
              sourceRoot: plugin.path,
            }),
          );
        }

        // 4.2.4: Docs (plugin)
        if (docsAdapter !== null) {
          pluginOutcomes.push(
            runTranspileStep({
              transpilerFactory: docsFactory as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
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
              transpilerFactory: schemasFactory as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
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
      const localValuesByAgentId: Record<string, Record<string, string>> = Object.keys(localValues).length > 0
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

      // 4.3.5: Commands
      if (entry.commands) {
        localOutcomes.push(
          runTranspileStep({
            transpilerFactory: createCommandsTranspiler as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
            adapter: entry.commands,
            projectRoot,
            name: "Commands",
            variablesByAgentId,
            valuesByAgentId: localValuesByAgentId,
          }),
        );
      }

      // 4.4: Skills
      if (entry.skills) {
        localOutcomes.push(
          runTranspileStep({
            transpilerFactory: createSkillsTranspiler as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
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
            transpilerFactory: createAgentsTranspiler as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
            adapter: entry.agents,
            projectRoot,
            name: "Agents",
          }),
        );
      }

      // 4.5.5: MCP (local project)
      if (entry.mcp !== null) {
        localOutcomes.push(
          runTranspileStep({
            transpilerFactory: createMcpTranspiler as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
            adapter: entry.mcp,
            projectRoot,
            name: "MCP",
            variablesByAgentId,
            valuesByAgentId: localValuesByAgentId,
          }),
        );
      }

      // 4.6: Permissions (local project)
      if (entry.permissions !== null) {
        localOutcomes.push(
          runTranspileStep({
            transpilerFactory: createPermissionsTranspiler as Parameters<
              typeof runTranspileStep
            >[0]["transpilerFactory"],
            adapter: entry.permissions,
            projectRoot,
            name: "Permissions",
          }),
        );
      }

      // 4.6: Docs (local project)
      if (docsAdapter !== null) {
        localOutcomes.push(
          runTranspileStep({
            transpilerFactory: docsFactory as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
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
            transpilerFactory: schemasFactory as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
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
    const hasTranspileErrors = results.some((r) => r.outcomes.some((s) => s.errors.length > 0));
    const hasCleanErrors = cleanResult ? cleanResult.errors.length > 0 : false;
    if (hasTranspileErrors || hasCleanErrors) {
      process.exitCode = 1;
    }

    setDone(true);
  }, [entries, projectRoot, clean]);

  // totalWritten
  const totalWritten = entryResults.reduce((sum, r) => sum + r.outcomes.reduce((s, o) => s + o.writtenCount, 0), 0);

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
              {done ? hasErrors ? <Text color="red">✗</Text> : <Text color="green">✓</Text> : <Spinner type="dots" />}{" "}
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
        !entryResults.some((r) => r.outcomes.some((o) => o.errors.length > 0)) && <Text>Nothing to transpile.</Text>}
      {done && (
        <>
          <Text> </Text>
          <Text>
            {entryResults.some((r) => r.outcomes.some((o) => o.errors.length > 0)) ? "Failed." : "Done."} {totalWritten}{" "}
            files written.
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
  useExitOnMount();
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

export function App({ args, paths, rawConfig, loadedConfig }: AppProps): React.ReactElement {
  const parsed = parseArgs(args);

  // `runCLI` is the single entry-point: it runs Resolve Global Flags →
  // Read Config Source → Load Config and injects the results via
  // `paths`/`rawConfig`/`loadedConfig`. App never resolves anything by
  // itself.
  //
  // Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
  const root = paths.writeRoot;
  const resourcesRoot = paths.resourcesRoot;

  // § --version
  if (parsed.version) {
    return (
      <StaticExit>
        <Text>{getVersion()}</Text>
      </StaticExit>
    );
  }

  // § Неизвестный флаг
  if (parsed.unknownFlag && !parsed.help) {
    process.exitCode = 1;
    return (
      <StaticExit>
        <Text>Unknown option: {parsed.unknownFlag}. Run &apos;agloom --help&apos; to see available options.</Text>
      </StaticExit>
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

  // § format --help (Spec: docs/specs/format.md § Расширение --help)
  if (parsed.command === "format" && parsed.help) {
    return <FormatHelpView />;
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
  if (parsed.unknownCommand) {
    process.exitCode = 1;
    return (
      <StaticExit>
        <Text>Unknown command: {parsed.unknownCommand}. Run &apos;agloom --help&apos; to see available commands.</Text>
      </StaticExit>
    );
  }

  // § --help or no command
  if (parsed.help || parsed.command === null) {
    return <HelpView />;
  }

  // § Команда adapters
  if (parsed.command === "adapters") {
    return <AdaptersView loadedConfig={loadedConfig} all={parsed.all} />;
  }

  // § Команда init
  if (parsed.command === "init") {
    // Resolve Adapters from CLI Args
    let entries: AdapterRegistryEntry[];
    try {
      entries = resolveAdaptersFromCLIArgs({
        adapterIds: parsed.adapterIds,
        all: parsed.all,
        loadedConfig,
        command: "init",
      });
    } catch (err) {
      process.exitCode = 1;
      const message = err instanceof Error ? err.message : String(err);
      return (
        <StaticExit>
          <Text>{message}</Text>
        </StaticExit>
      );
    }

    // Determine config adapter ids for config creation
    const createConfig = parsed.adapterIds.length > 0 || parsed.all;
    let configAdapterIds: string[] = [];
    if (parsed.adapterIds.length > 0) {
      // Дедуплицировать с сохранением порядка первого появления
      // Spec: docs/specs/init-command.md § Создание конфигурационного файла
      const seen = new Set<string>();
      for (const id of parsed.adapterIds) {
        if (!seen.has(id)) {
          seen.add(id);
          configAdapterIds.push(id);
        }
      }
    } else if (parsed.all) {
      // All non-hidden adapters
      configAdapterIds = adapterRegistry.filter((e) => !e.hidden).map((e) => e.id);
    }

    return (
      <InitView
        entries={entries}
        projectRoot={root}
        resourcesRoot={resourcesRoot}
        force={parsed.force}
        createConfig={createConfig}
        configAdapterIds={configAdapterIds}
        verbose={parsed.verbose}
      />
    );
  }

  // § Команда format (Spec: docs/specs/format.md § Команда format)
  if (parsed.command === "format") {
    return (
      <FormatView
        projectRoot={root}
        resourcesRoot={resourcesRoot}
        rawConfig={rawConfig}
        check={parsed.check}
        globs={parsed.globs}
        all={parsed.all}
      />
    );
  }

  // § Команда clean
  if (parsed.command === "clean") {
    // Resolve Adapters from CLI Args
    let entries: AdapterRegistryEntry[];
    try {
      entries = resolveAdaptersFromCLIArgs({
        adapterIds: parsed.adapterIds,
        all: parsed.all,
        loadedConfig,
        command: "clean",
      });
    } catch (err) {
      process.exitCode = 1;
      const message = err instanceof Error ? err.message : String(err);
      return (
        <StaticExit>
          <Text>{message}</Text>
        </StaticExit>
      );
    }

    return <CleanEntriesView entries={entries} projectRoot={root} verbose={parsed.verbose} />;
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
      <StaticExit>
        <Text>Unknown command: cache. Run &apos;agloom --help&apos; to see available commands.</Text>
      </StaticExit>
    );
  }

  // § Команда transpile
  if (parsed.command === "transpile") {
    // Resolve Adapters from CLI Args
    let entries: AdapterRegistryEntry[];
    try {
      entries = resolveAdaptersFromCLIArgs({
        adapterIds: parsed.adapterIds,
        all: parsed.all,
        loadedConfig,
        command: "transpile",
      });
    } catch (err) {
      process.exitCode = 1;
      const message = err instanceof Error ? err.message : String(err);
      return (
        <StaticExit>
          <Text>{message}</Text>
        </StaticExit>
      );
    }

    // § plugin-loading.md § Расширение команды transpile шаги 3.1-3.3
    // § git-plugin-loading.md § Расширение команды transpile
    // Извлечь pluginEntries из уже загруженного loadedConfig (single-I/O
    // инвариант Run CLI — повторные чтения configSource запрещены).
    let plugins: ResolvedPlugin[] = [];
    const configResult = loadedConfig;
    const pluginEntries = configResult?.pluginEntries ?? null;

    // Относительные пути в конфиге резолвятся относительно
    // configSource.baseDir (см. docs/specs/cli-global-flags.md § Разрешение
    // относительных путей внутри YAML-конфига), а не относительно writeRoot.
    const configBaseDir = paths.configSource.baseDir;

    if (pluginEntries !== null && pluginEntries.length > 0) {
      // Шаг 3.2: Resolve Plugins с pluginEntries и forceRefresh
      try {
        plugins = resolvePlugins({
          pluginEntries,
          projectRoot: configBaseDir,
          forceRefresh: parsed.refresh,
        });
      } catch (err) {
        // Расширение 3.2a: ошибка → exit code 1
        process.exitCode = 1;
        const message = err instanceof Error ? err.message : String(err);
        return (
          <StaticExit>
            <Text>{message}</Text>
          </StaticExit>
        );
      }
    } else {
      // Backward compatibility: try pluginPaths
      const pluginPaths = configResult?.pluginPaths ?? null;
      if (pluginPaths !== null && pluginPaths.length > 0) {
        try {
          plugins = resolvePlugins({ pluginPaths, projectRoot: configBaseDir });
        } catch (err) {
          process.exitCode = 1;
          const message = err instanceof Error ? err.message : String(err);
          return (
            <StaticExit>
              <Text>{message}</Text>
            </StaticExit>
          );
        }
      }
    }

    // Загрузка .env перед разрешением значений плагинов,
    // чтобы ${env:*} ссылки в values могли использовать переменные из .env
    loadDotenv(root);

    // § plugin-values.md § Расширение команды transpile шаги 3.4-3.6
    // Resolve local values
    let localResolvedValues: Record<string, string> = {};
    const configVariables = configResult?.configVariables ?? null;
    try {
      localResolvedValues = resolveLocalValues(configVariables, process.env as Record<string, string | undefined>);
    } catch (err) {
      process.exitCode = 1;
      const message = err instanceof Error ? err.message : String(err);
      return (
        <StaticExit>
          <Text>{message}</Text>
        </StaticExit>
      );
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
      return (
        <StaticExit>
          <Text>{message}</Text>
        </StaticExit>
      );
    }

    return (
      <TranspileView
        entries={entries}
        projectRoot={root}
        clean={parsed.clean}
        verbose={parsed.verbose}
        singleAdapter={parsed.adapterIds.length === 1 ? parsed.adapterIds[0] : undefined}
        plugins={resolvedPlugins}
        localValues={localResolvedValues}
      />
    );
  }

  return <HelpView />;
}
