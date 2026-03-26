/**
 * App — Ink-компонент CLI.
 * Spec: docs/specs/cli.md § Команда transpile, § Команда adapters, § Глобальные опции
 */

import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";
import Spinner from "ink-spinner";
import * as fs from "node:fs";
import * as path from "node:path";
import { adapterRegistry } from "./adapter-registry.js";
import { runTranspileStep } from "./transpile-step.js";
import type { TranspilerStepOutcome } from "./types.js";
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
} {
  let command: string | null = null;
  let adapter: string | null = null;
  let help = false;
  let version = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "help") {
      help = true;
    } else if (arg === "--version" || arg === "version") {
      version = true;
    } else if (arg === "--adapter" && i + 1 < args.length) {
      adapter = args[i + 1];
      i++;
    } else if (arg === "transpile" || arg === "adapters") {
      command = arg;
    }
  }

  return { command, adapter, help, version };
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

function TranspileView({
  adapterId,
  projectRoot,
}: {
  adapterId: string;
  projectRoot: string;
}): React.ReactElement {
  const [outcomes, setOutcomes] = useState<TranspilerStepOutcome[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const entry = adapterRegistry.find((e) => e.id === adapterId);
    if (!entry) {
      return;
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

    setOutcomes(steps);

    // Шаг 13: exit code
    const hasErrors = steps.some((s) => s.errors.length > 0);
    if (hasErrors) {
      process.exitCode = 1;
    }

    setDone(true);
  }, [adapterId, projectRoot]);

  // Шаг 11: totalWritten
  const totalWritten = outcomes.reduce((sum, o) => sum + o.writtenCount, 0);

  return (
    <Box flexDirection="column">
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

    return <TranspileView adapterId={parsed.adapter} projectRoot={root} />;
  }

  return <HelpView />;
}
