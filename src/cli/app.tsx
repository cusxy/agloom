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
import { initFiles, backupProjectFiles } from "./init-files.js";
import type {
  TranspilerStepOutcome,
  CleanOutcome,
  InitOutcome,
} from "./types.js";
import { createInstructionsTranspiler } from "../instructions-transpiler/index.js";
import { createSkillsTranspiler } from "../skills-transpiler/index.js";
import { createAgentsTranspiler } from "../agents-transpiler/index.js";
import type { ProjectBackupOutcome } from "./init-files.js";

/**
 * Разрешение зависимостей: собрать упорядоченный список записей
 * в топологическом порядке (зависимости перед зависящими).
 * Spec: docs/specs/cli.md § Разрешение зависимостей
 */
export function resolveDeps(
  entryId: string,
  registry: typeof adapterRegistry,
): typeof adapterRegistry {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const result: typeof adapterRegistry = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    if (inStack.has(id)) throw new Error("Circular dependency detected");
    const entry = registry.find((e) => e.id === id);
    if (!entry) throw new Error(`Unknown dependency: ${id}`);
    inStack.add(id);
    for (const dep of entry.dependsOn) visit(dep);
    inStack.delete(id);
    visited.add(id);
    result.push(entry);
  }

  visit(entryId);
  return result;
}

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
} {
  let command: string | null = null;
  let unknownCommand: string | null = null;
  let agent: string | null = null;
  let all = false;
  let help = false;
  let version = false;
  let clean = false;
  let force = false;

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

  return { command, unknownCommand, agent, all, help, version, clean, force };
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
        Usage: agloom transpile (--agent &lt;agentId&gt; | --all) [--clean]
      </Text>
      <Text> </Text>
      <Text>
        Transpile canonical configs for all transpilers using the specified
        adapter.
      </Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--agent, --adapter &lt;agentId&gt;{"  "}Agent ID from the registry
        (required unless --all)
      </Text>
      <Text>
        {"  "}--all {"                        "}Transpile for all supported
        agents
      </Text>
      <Text>
        {"  "}--clean {"                      "}Clean before transpiling
      </Text>
    </Box>
  );
}

function AdaptersHelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Usage: agloom adapters</Text>
      <Text> </Text>
      <Text>List all available adapters from the registry.</Text>
    </Box>
  );
}

function AdaptersView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Available adapters:</Text>
      <Text> </Text>
      {adapterRegistry.map((entry) => (
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
      <Text>Usage: agloom clean --adapter &lt;agentId&gt;</Text>
      <Text> </Text>
      <Text>
        Remove generated agent-specific files for the specified adapter.
      </Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--adapter &lt;agentId&gt;{"  "}Adapter ID from the registry
        (required)
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

function CleanView({
  adapterId,
  projectRoot,
}: {
  adapterId: string;
  projectRoot: string;
}): React.ReactElement {
  // cleanFiles — синхронная операция, вычисляем результат при инициализации состояния
  const [outcome] = useState<CleanOutcome>(() => {
    const entry = adapterRegistry.find((e) => e.id === adapterId)!;
    const result = cleanFiles(entry, projectRoot);
    if (result.errors.length > 0) {
      process.exitCode = 1;
    }
    return result;
  });

  const hasErrors = outcome.errors.length > 0;

  return (
    <Box flexDirection="column">
      <CleanResultView adapterId={adapterId} outcome={outcome} />
      <Text> </Text>
      {hasErrors ? (
        <Text>Done. {outcome.removedCount} files removed.</Text>
      ) : (
        <Text>Done.</Text>
      )}
    </Box>
  );
}

function InitHelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>
        Usage: agloom init (--agent &lt;agentId&gt; | --all) [--force]
      </Text>
      <Text> </Text>
      <Text>Import existing agent configs into .agloom/</Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--agent &lt;agentId&gt;{"  "}Agent identifier (required unless
        --all)
      </Text>
      <Text>
        {"  "}--all {"              "}Initialize all supported agents
      </Text>
      <Text>
        {"  "}--force {"            "}Overwrite existing files
      </Text>
      <Text>
        {"  "}--help {"             "}Show help
      </Text>
    </Box>
  );
}

function InitView({
  agentId,
  projectRoot,
  force,
  all,
}: {
  agentId: string | null;
  projectRoot: string;
  force: boolean;
  all: boolean;
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

    // Шаг 5: выполнить Backup Project Files
    const backupResult = backupProjectFiles(projectRoot, force);

    // Расширение 5a: Backup Project Files вернула строку — блокирующая ошибка
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

    // Определить записи для инициализации
    let entries: typeof adapterRegistry;
    if (all) {
      // Шаг 8: для каждой записи реестра
      entries = adapterRegistry;
    } else {
      // Шаг 6-7: Resolve Adapter и Init Overlay Files для одного агента
      const entry = adapterRegistry.find((e) => e.id === agentId);
      if (!entry) {
        process.exitCode = 1;
        return {
          backupOutcome: backupResult as ProjectBackupOutcome | string,
          overlayResults: [] as {
            entryId: string;
            outcome: InitOutcome | string;
          }[],
        };
      }
      entries = [entry];
    }

    const results: { entryId: string; outcome: InitOutcome | string }[] = [];
    let hasError = false;

    for (const entry of entries) {
      const result = initFiles(entry, projectRoot, force);
      results.push({ entryId: entry.id, outcome: result });

      if (typeof result === "string") {
        hasError = true;
        // Расширение 7a/8a: строка-сообщение → exit code 1
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

  return (
    <Box flexDirection="column">
      <Text>Initializing...</Text>
      {backupOutcome && backupOutcome.errors.length > 0 && (
        <Text>
          {"  "}
          <Text color="red">✗</Text> {backupOutcome.errors[0]}
        </Text>
      )}
      {backupOutcome && backupOutcome.errors.length === 0 && backupOutcome.copiedCount > 0 && (
        <Text>
          {"  "}
          <Text color="green">✓</Text> {backupOutcome.copiedCount} project
          files backed up to .agloom/project/
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
        if (r.outcome.copiedCount === 0) {
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
      {!hasAnyErrors &&
        totalOverlayCopied === 0 &&
        (!backupOutcome || backupOutcome.copiedCount === 0) && (
          <Text>{"  "}Nothing to import.</Text>
        )}
      <Text> </Text>
      {hasAnyErrors ? (
        <Text>Done. {totalOverlayCopied} files copied.</Text>
      ) : (
        <Text>Done.</Text>
      )}
    </Box>
  );
}

function TranspileView({
  adapterId,
  projectRoot,
  clean,
}: {
  adapterId: string;
  projectRoot: string;
  clean?: boolean;
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
    // Шаг 4: разрешить зависимости
    const entries = resolveDeps(adapterId, adapterRegistry);

    // Шаг 4 (clean-command): При наличии флага --clean выполнить Clean Files
    let cleanResult: CleanOutcome | null = null;
    if (clean) {
      const mainEntry = entries[entries.length - 1];
      cleanResult = cleanFiles(mainEntry, projectRoot);
      setCleanOutcome(cleanResult);
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
  }, [adapterId, projectRoot, clean]);

  // totalWritten
  const totalWritten = entryResults.reduce(
    (sum, r) => sum + r.outcomes.reduce((s, o) => s + o.writtenCount, 0),
    0,
  );

  return (
    <Box flexDirection="column">
      {cleanOutcome && (
        <>
          <CleanResultView adapterId={adapterId} outcome={cleanOutcome} />
          <Text> </Text>
        </>
      )}
      {entryResults.map((r) => (
        <React.Fragment key={r.adapterId}>
          <Text>
            {done ? <Text color="green">✓</Text> : <Spinner type="dots" />} Transpiling for {r.adapterId}...
          </Text>
          {r.outcomes.map((outcome) => (
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
      ))}
      {done && (
        <>
          <Text> </Text>
          <Text>Done. {totalWritten} files written.</Text>
        </>
      )}
    </Box>
  );
}

function TranspileAllView({
  projectRoot,
  clean,
}: {
  projectRoot: string;
  clean?: boolean;
}): React.ReactElement {
  const { exit } = useApp();
  const [allResults, setAllResults] = useState<
    { adapterId: string; outcomes: TranspilerStepOutcome[] }[]
  >([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) exit();
  }, [done, exit]);

  useEffect(() => {
    const results: {
      adapterId: string;
      outcomes: TranspilerStepOutcome[];
    }[] = [];
    let hasErrors = false;

    for (const entry of adapterRegistry) {
      // Clean if needed
      if (clean) {
        const cleanResult = cleanFiles(entry, projectRoot);
        if (cleanResult.errors.length > 0) {
          hasErrors = true;
        }
      }

      const steps: TranspilerStepOutcome[] = [];

      // Instructions
      const instructionsOutcome = runTranspileStep({
        transpilerFactory: createInstructionsTranspiler as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: entry.instructions,
        projectRoot,
        name: "Instructions",
      });
      steps.push(instructionsOutcome);

      // Skills
      const skillsOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: entry.skills,
        projectRoot,
        name: "Skills",
      });
      steps.push(skillsOutcome);

      // Agents
      const agentsOutcome = runTranspileStep({
        transpilerFactory: createAgentsTranspiler as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: entry.agents,
        projectRoot,
        name: "Agents",
      });
      steps.push(agentsOutcome);

      // Overlay
      const overlayOutcome = runOverlayStep({ entry, projectRoot });
      steps.push(overlayOutcome);

      if (steps.some((s) => s.errors.length > 0)) {
        hasErrors = true;
      }

      results.push({ adapterId: entry.id, outcomes: steps });
    }

    setAllResults(results);

    if (hasErrors) {
      process.exitCode = 1;
    }

    setDone(true);
  }, [projectRoot, clean]);

  const totalWritten = allResults.reduce(
    (sum, r) => sum + r.outcomes.reduce((s, o) => s + o.writtenCount, 0),
    0,
  );

  return (
    <Box flexDirection="column">
      {allResults.map((r) => (
        <React.Fragment key={r.adapterId}>
          <Text>
            {done ? <Text color="green">✓</Text> : <Spinner type="dots" />} Transpiling for {r.adapterId}...
          </Text>
          {r.outcomes.map((outcome) => (
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
      ))}
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
    return <AdaptersView />;
  }

  // § Команда init
  if (parsed.command === "init") {
    // Расширение 2a: ни --agent, ни --all не указан
    if (!parsed.agent && !parsed.all) {
      process.exitCode = 1;
      return (
        <Text>
          Error: --agent or --all is required. Usage: agloom init (--agent
          &lt;agentId&gt; | --all) [--force]
        </Text>
      );
    }

    // Расширение 3a: --agent и --all указаны одновременно
    if (parsed.agent && parsed.all) {
      process.exitCode = 1;
      return <Text>--agent and --all are mutually exclusive.</Text>;
    }

    // Расширение 6a: адаптер не найден (Resolve Adapter § 1a)
    if (parsed.agent) {
      const entry = adapterRegistry.find((e) => e.id === parsed.agent);
      if (!entry) {
        process.exitCode = 1;
        return (
          <Text>
            Unknown agent: {parsed.agent}. Run &apos;agloom adapters&apos; to
            see available adapters.
          </Text>
        );
      }
    }

    return (
      <InitView
        agentId={parsed.agent}
        projectRoot={root}
        force={parsed.force}
        all={parsed.all}
      />
    );
  }

  // § Команда clean
  if (parsed.command === "clean") {
    // Расширение 1a: --adapter не указан
    if (!parsed.agent) {
      process.exitCode = 1;
      return (
        <Text>
          Error: --adapter is required. Usage: agloom clean --adapter
          &lt;adapterId&gt;
        </Text>
      );
    }

    // Расширение: адаптер не найден (Resolve Adapter § 1a)
    const entry = adapterRegistry.find((e) => e.id === parsed.agent);
    if (!entry) {
      process.exitCode = 1;
      return (
        <Text>
          Unknown agent: {parsed.agent}. Run &apos;agloom adapters&apos; to see
          available adapters.
        </Text>
      );
    }

    return <CleanView adapterId={parsed.agent} projectRoot={root} />;
  }

  // § Команда transpile
  if (parsed.command === "transpile") {
    // Расширение 1a: ни --agent, ни --all не указаны
    if (!parsed.agent && !parsed.all) {
      process.exitCode = 1;
      return (
        <Text>
          Error: --agent or --all is required. Usage: agloom transpile (--agent
          &lt;agentId&gt; | --all) [--clean]
        </Text>
      );
    }

    // Расширение 1b: --agent и --all указаны одновременно
    if (parsed.agent && parsed.all) {
      process.exitCode = 1;
      return <Text>--agent and --all are mutually exclusive.</Text>;
    }

    // Режим --all
    if (parsed.all) {
      return <TranspileAllView projectRoot={root} clean={parsed.clean} />;
    }

    // Расширение 2a: адаптер не найден
    const entry = adapterRegistry.find((e) => e.id === parsed.agent);
    if (!entry) {
      process.exitCode = 1;
      return (
        <Text>
          Unknown agent: {parsed.agent}. Run &apos;agloom adapters&apos; to see
          available adapters.
        </Text>
      );
    }

    return (
      <TranspileView
        adapterId={parsed.agent!}
        projectRoot={root}
        clean={parsed.clean}
      />
    );
  }

  return <HelpView />;
}
