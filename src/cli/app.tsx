/**
 * App — Ink-компонент CLI.
 * Spec: docs/specs/cli.md § Команда transpile, § Команда adapters, § Глобальные опции
 * Spec: docs/specs/clean-command.md § Команда clean, § Расширение команды transpile
 * Spec: docs/specs/init-command.md § Команда init
 * Spec: docs/specs/adapter-registry-ext.md § Процедура Resolve Adapter
 */

import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import Spinner from "ink-spinner";
import * as fs from "node:fs";
import * as path from "node:path";
import { adapterRegistry } from "./adapter-registry.js";
import { runTranspileStep } from "./transpile-step.js";
import { runOverlayStep } from "./overlay-step.js";
import { cleanFiles } from "./clean-files.js";
import {
  initFiles,
  backupProjectFiles,
  createConfigFile,
} from "./init-files.js";
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
import type { ProjectBackupOutcome } from "./init-files.js";

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
  unknownCommand: string | null;
  agent: string | null;
  all: boolean;
  help: boolean;
  version: boolean;
  clean: boolean;
  force: boolean;
  verbose: boolean;
} {
  let command: string | null = null;
  let unknownCommand: string | null = null;
  let agent: string | null = null;
  let all = false;
  let help = false;
  let version = false;
  let clean = false;
  let force = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "help") {
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
    } else if (
      arg === "transpile" ||
      arg === "adapters" ||
      arg === "clean" ||
      arg === "init"
    ) {
      command = arg;
    } else if (!arg.startsWith("-")) {
      unknownCommand = arg;
    }
  }

  return {
    command,
    unknownCommand,
    agent,
    all,
    help,
    version,
    clean,
    force,
    verbose,
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
        {"  "}transpile {"   "}Transpile canonical configs for a target adapter
      </Text>
      <Text>
        {"  "}clean {"       "}Remove generated agent-specific files
      </Text>
      <Text>
        {"  "}init {"        "}Import existing agent configs into .agloom/
      </Text>
      <Text>
        {"  "}adapters {"    "}List available adapters
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
        const adapterIds = loadConfig(projectRoot);
        if (adapterIds !== null) {
          // Конфиг найден — показать активные
          heading = "Active adapters:";
          entries = adapterIds
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
          backupOutcome:
            ".agloom/ already exists. Use --force to reinitialize." as
              | ProjectBackupOutcome
              | string,
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
          backupOutcome: message as ProjectBackupOutcome | string,
          overlayResults: [] as {
            entryId: string;
            outcome: InitOutcome | string;
          }[],
        };
      }
    }

    // Шаг 6: выполнить Backup Project Files
    const backupResult = backupProjectFiles(projectRoot, force);

    // Расширение 6a: Backup Project Files вернула строку — блокирующая ошибка
    if (typeof backupResult === "string") {
      process.exitCode = 1;
      return {
        backupOutcome: backupResult as ProjectBackupOutcome | string,
        overlayResults: [] as {
          entryId: string;
          outcome: InitOutcome | string;
        }[],
      };
    }

    const results: { entryId: string; outcome: InitOutcome | string }[] = [];
    let hasError = false;

    for (const entry of entries) {
      const result = initFiles(entry, projectRoot, force);
      results.push({ entryId: entry.id, outcome: result });

      if (typeof result === "string") {
        hasError = true;
        // Расширение 7a: строка-сообщение → exit code 1
        break;
      } else if (result.errors.length > 0) {
        hasError = true;
      }
    }

    // Set exit code
    if (hasError || backupResult.errors.length > 0) {
      process.exitCode = 1;
    }

    return {
      backupOutcome: backupResult as ProjectBackupOutcome | string,
      overlayResults: results,
    };
  });

  const { backupOutcome, overlayResults } = state;

  // Расширение 5a: строковое сообщение от Backup Project Files
  if (typeof backupOutcome === "string") {
    return <Text>{backupOutcome}</Text>;
  }

  // Вычислить общее количество overlay-файлов для вывода с ошибками
  const totalOverlayCopied = overlayResults.reduce((sum, r) => {
    if (typeof r.outcome !== "string") {
      return sum + r.outcome.copiedCount;
    }
    return sum;
  }, 0);

  const hasAnyErrors =
    (backupOutcome && backupOutcome.errors.length > 0) ||
    overlayResults.some(
      (r) =>
        typeof r.outcome === "string" ||
        (typeof r.outcome !== "string" && r.outcome.errors.length > 0),
    );

  const hasVisibleResults =
    hasAnyErrors ||
    totalOverlayCopied > 0 ||
    (backupOutcome && backupOutcome.copiedCount > 0) ||
    verbose;

  return (
    <Box flexDirection="column">
      {hasVisibleResults && (
        <Text>
          <Text color="green">✓</Text> Initializing...
        </Text>
      )}
      {backupOutcome && backupOutcome.errors.length > 0 && (
        <Text>
          {"  "}
          <Text color="red">✗</Text> {backupOutcome.errors[0]}
        </Text>
      )}
      {backupOutcome &&
        backupOutcome.errors.length === 0 &&
        (verbose || backupOutcome.copiedCount > 0) && (
          <Text>
            {"  "}
            <Text color="green">✓</Text> {backupOutcome.copiedCount} project
            files backed up to .agloom/instructions/
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
      {!verbose &&
        !hasAnyErrors &&
        totalOverlayCopied === 0 &&
        (!backupOutcome || backupOutcome.copiedCount === 0) && (
          <Text>Nothing to import.</Text>
        )}
      <Text> </Text>
      <Text>
        Done.{" "}
        {totalOverlayCopied + (backupOutcome ? backupOutcome.copiedCount : 0)}{" "}
        files copied.
      </Text>
    </Box>
  );
}

function TranspileView({
  entries,
  projectRoot,
  clean,
  verbose,
  singleAdapter,
}: {
  entries: AdapterRegistryEntry[];
  projectRoot: string;
  clean?: boolean;
  verbose?: boolean;
  singleAdapter?: string;
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

    const results: {
      adapterId: string;
      outcomes: TranspilerStepOutcome[];
    }[] = [];

    // Шаг 5: для каждой записи из упорядоченного списка
    for (const entry of entries) {
      const steps: TranspilerStepOutcome[] = [];

      // Instructions
      steps.push(
        runTranspileStep({
          transpilerFactory: createInstructionsTranspiler as Parameters<
            typeof runTranspileStep
          >[0]["transpilerFactory"],
          adapter: entry.instructions,
          projectRoot,
          name: "Instructions",
        }),
      );

      // Skills
      steps.push(
        runTranspileStep({
          transpilerFactory: createSkillsTranspiler as Parameters<
            typeof runTranspileStep
          >[0]["transpilerFactory"],
          adapter: entry.skills,
          projectRoot,
          name: "Skills",
        }),
      );

      // Agents
      steps.push(
        runTranspileStep({
          transpilerFactory: createAgentsTranspiler as Parameters<
            typeof runTranspileStep
          >[0]["transpilerFactory"],
          adapter: entry.agents,
          projectRoot,
          name: "Agents",
        }),
      );

      // Overlay
      steps.push(runOverlayStep({ entry, projectRoot }));

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
        return (
          <React.Fragment key={r.adapterId}>
            <Text>
              {done ? <Text color="green">✓</Text> : <Spinner type="dots" />}{" "}
              Transpiling for {r.adapterId}...
            </Text>
            {visibleOutcomes.map((outcome) => (
              <Text key={`${r.adapterId}-${outcome.name}`}>
                {"  "}
                {outcome.errors.length === 0 ? (
                  <>
                    <Text color="green">✓</Text> {outcome.name.padEnd(14)}
                    {String(outcome.writtenCount).padStart(4)} files
                  </>
                ) : (
                  <>
                    <Text color="red">✗</Text> {outcome.name.padEnd(14)}
                    {outcome.errors[0]}
                  </>
                )}
              </Text>
            ))}
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
          <Text>Done. {totalWritten} files written.</Text>
        </>
      )}
    </Box>
  );
}

export function App({ args, projectRoot }: AppProps): React.ReactElement {
  const parsed = parseArgs(args);
  const root = projectRoot ?? process.cwd();

  // § --version
  if (parsed.version) {
    return <Text>{getVersion()}</Text>;
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

    return (
      <TranspileView
        entries={entries}
        projectRoot={root}
        clean={parsed.clean}
        verbose={parsed.verbose}
        singleAdapter={parsed.agent ?? undefined}
      />
    );
  }

  return <HelpView />;
}
