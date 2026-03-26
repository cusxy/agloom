/**
 * App — Ink-компонент CLI.
 * Spec: docs/specs/cli.md § Команда transpile, § Команда adapters, § Глобальные опции
 * Spec: docs/specs/clean-command.md § Команда clean, § Расширение команды transpile
 * Spec: docs/specs/init-command.md § Команда init
 */

import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";
import Spinner from "ink-spinner";
import * as fs from "node:fs";
import * as path from "node:path";
import { adapterRegistry } from "./adapter-registry.js";
import { runTranspileStep } from "./transpile-step.js";
import { runOverlayStep } from "./overlay-step.js";
import { cleanFiles } from "./clean-files.js";
import { initFiles } from "./init-files.js";
import type {
  TranspilerStepOutcome,
  CleanOutcome,
  InitOutcome,
} from "./types.js";
import { createInstructionsTranspiler } from "../instructions-transpiler/index.js";
import { createSkillsTranspiler } from "../skills-transpiler/index.js";
import { createAgentsTranspiler } from "../agents-transpiler/index.js";

interface AppProps {
  args: string[];
  projectRoot?: string;
}

/**
 * Парсит аргументы командной строки.
 */
function parseArgs(args: string[]): {
  command: string | null;
  adapter: string | null;
  help: boolean;
  version: boolean;
  clean: boolean;
  force: boolean;
} {
  let command: string | null = null;
  let adapter: string | null = null;
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
    } else if (arg === "--adapter" && i + 1 < args.length) {
      adapter = args[i + 1];
      i++;
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
    }
  }

  return { command, adapter, help, version, clean, force };
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
        agent-sds — CLI for transpiling canonical Agent SDS configurations into
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
        {"  "}init {"        "}Import existing agent configs into
        .agents/overlays/
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
      <Text>Usage: agent-sds transpile --adapter &lt;adapterId&gt;</Text>
      <Text> </Text>
      <Text>
        Transpile canonical configs for all transpilers using the specified
        adapter.
      </Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--adapter {"   "}Adapter ID from the registry (required)
      </Text>
    </Box>
  );
}

function AdaptersHelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Usage: agent-sds adapters</Text>
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
      <Text>Usage: agent-sds clean --adapter &lt;adapterId&gt;</Text>
      <Text> </Text>
      <Text>
        Remove generated agent-specific files for the specified adapter.
      </Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--adapter {"   "}Adapter ID from the registry (required)
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
      <Text>Usage: agent-sds init --adapter &lt;adapterId&gt; [--force]</Text>
      <Text> </Text>
      <Text>Import existing agent configs into .agents/overlays/</Text>
      <Text> </Text>
      <Text>Options:</Text>
      <Text>
        {"  "}--adapter &lt;adapterId&gt;{"  "}Adapter identifier (required)
      </Text>
      <Text>
        {"  "}--force {"               "}Overwrite existing files
      </Text>
      <Text>
        {"  "}--help {"                "}Show help
      </Text>
    </Box>
  );
}

function InitView({
  adapterId,
  projectRoot,
  force,
}: {
  adapterId: string;
  projectRoot: string;
  force: boolean;
}): React.ReactElement {
  const [outcome] = useState<InitOutcome | string>(() => {
    const entry = adapterRegistry.find((e) => e.id === adapterId)!;
    const result = initFiles(entry, projectRoot, force);
    // Set exit code for error cases
    if (typeof result === "string") {
      process.exitCode = 1;
    } else if (result.errors.length > 0) {
      process.exitCode = 1;
    }
    return result;
  });

  // Расширение 5a, 6a: строковое сообщение об ошибке
  if (typeof outcome === "string") {
    return <Text>{outcome}</Text>;
  }

  const hasErrors = outcome.errors.length > 0;
  const noFiles = outcome.copiedCount === 0 && !hasErrors;

  return (
    <Box flexDirection="column">
      <Text>Initializing for {adapterId}...</Text>
      {hasErrors ? (
        <Text>
          {"  "}
          <Text color="red">✗</Text> {outcome.errors[0]}
        </Text>
      ) : noFiles ? (
        <Text>{"  "}No files found.</Text>
      ) : (
        <Text>
          {"  "}
          <Text color="green">✓</Text> {outcome.copiedCount} files copied to
          .agents/overlays/{adapterId}/
        </Text>
      )}
      <Text> </Text>
      {hasErrors ? (
        <Text>Done. {outcome.copiedCount} files copied.</Text>
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
  const [cleanOutcome, setCleanOutcome] = useState<CleanOutcome | null>(null);
  const [outcomes, setOutcomes] = useState<TranspilerStepOutcome[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const entry = adapterRegistry.find((e) => e.id === adapterId);
    if (!entry) {
      return;
    }

    // Шаг 4 (clean-command): При наличии флага --clean выполнить Clean Files
    let cleanResult: CleanOutcome | null = null;
    if (clean) {
      cleanResult = cleanFiles(entry, projectRoot);
      setCleanOutcome(cleanResult);
    }

    const steps: TranspilerStepOutcome[] = [];

    // Шаг 5-6: Instructions
    const instructionsOutcome = runTranspileStep({
      transpilerFactory: createInstructionsTranspiler as Parameters<
        typeof runTranspileStep
      >[0]["transpilerFactory"],
      adapter: entry.instructions,
      projectRoot,
      name: "Instructions",
    });
    steps.push(instructionsOutcome);

    // Шаг 7-8: Skills
    const skillsOutcome = runTranspileStep({
      transpilerFactory: createSkillsTranspiler as Parameters<
        typeof runTranspileStep
      >[0]["transpilerFactory"],
      adapter: entry.skills,
      projectRoot,
      name: "Skills",
    });
    steps.push(skillsOutcome);

    // Шаг 9-10: Agents
    const agentsOutcome = runTranspileStep({
      transpilerFactory: createAgentsTranspiler as Parameters<
        typeof runTranspileStep
      >[0]["transpilerFactory"],
      adapter: entry.agents,
      projectRoot,
      name: "Agents",
    });
    steps.push(agentsOutcome);

    // Шаг 8: Overlay (после всех транспилерных шагов)
    const overlayOutcome = runOverlayStep({ entry, projectRoot });
    steps.push(overlayOutcome);

    setOutcomes(steps);

    // Шаг 13: exit code — ошибки clean ИЛИ transpile
    const hasTranspileErrors = steps.some((s) => s.errors.length > 0);
    const hasCleanErrors = cleanResult ? cleanResult.errors.length > 0 : false;
    if (hasTranspileErrors || hasCleanErrors) {
      process.exitCode = 1;
    }

    setDone(true);
  }, [adapterId, projectRoot, clean]);

  // Шаг 11: totalWritten
  const totalWritten = outcomes.reduce((sum, o) => sum + o.writtenCount, 0);

  return (
    <Box flexDirection="column">
      {cleanOutcome && (
        <>
          <CleanResultView adapterId={adapterId} outcome={cleanOutcome} />
          <Text> </Text>
        </>
      )}
      <Text>
        <Spinner type="dots" /> Transpiling for {adapterId}...
      </Text>
      {outcomes.map((outcome) => (
        <Text key={outcome.name}>
          {"  "}
          {outcome.errors.length === 0 ? (
            <>
              <Text color="green">✓</Text> {outcome.name}
              {"        "}
              {outcome.writtenCount} files
            </>
          ) : (
            <>
              <Text color="red">✗</Text> {outcome.name}
              {"        "}
              {outcome.errors[0]}
            </>
          )}
        </Text>
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
    // Расширение 1a: --adapter не указан
    if (!parsed.adapter) {
      process.exitCode = 1;
      return (
        <Text>
          Error: --adapter is required. Usage: agent-sds init --adapter
          &lt;adapterId&gt;
        </Text>
      );
    }

    // Расширение: адаптер не найден (Resolve Adapter § 1a)
    const entry = adapterRegistry.find((e) => e.id === parsed.adapter);
    if (!entry) {
      process.exitCode = 1;
      return (
        <Text>
          Unknown adapter: {parsed.adapter}. Run &apos;agent-sds adapters&apos;
          to see available adapters.
        </Text>
      );
    }

    return (
      <InitView
        adapterId={parsed.adapter}
        projectRoot={root}
        force={parsed.force}
      />
    );
  }

  // § Команда clean
  if (parsed.command === "clean") {
    // Расширение 1a: --adapter не указан
    if (!parsed.adapter) {
      process.exitCode = 1;
      return (
        <Text>
          Error: --adapter is required. Usage: agent-sds clean --adapter
          &lt;adapterId&gt;
        </Text>
      );
    }

    // Расширение: адаптер не найден (Resolve Adapter § 1a)
    const entry = adapterRegistry.find((e) => e.id === parsed.adapter);
    if (!entry) {
      process.exitCode = 1;
      return (
        <Text>
          Unknown adapter: {parsed.adapter}. Run &apos;agent-sds adapters&apos;
          to see available adapters.
        </Text>
      );
    }

    return <CleanView adapterId={parsed.adapter} projectRoot={root} />;
  }

  // § Команда transpile
  if (parsed.command === "transpile") {
    // Расширение 1a: --adapter не указан
    if (!parsed.adapter) {
      process.exitCode = 1;
      return (
        <Text>
          Error: --adapter is required. Usage: agent-sds transpile --adapter
          &lt;adapterId&gt;
        </Text>
      );
    }

    // Расширение 2a: адаптер не найден
    const entry = adapterRegistry.find((e) => e.id === parsed.adapter);
    if (!entry) {
      process.exitCode = 1;
      return (
        <Text>
          Unknown adapter: {parsed.adapter}. Run &apos;agent-sds adapters&apos;
          to see available adapters.
        </Text>
      );
    }

    return (
      <TranspileView
        adapterId={parsed.adapter}
        projectRoot={root}
        clean={parsed.clean}
      />
    );
  }

  return <HelpView />;
}
