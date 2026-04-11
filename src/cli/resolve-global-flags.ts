/**
 * Resolve Global Flags — front-end пайплайн для глобальных CLI-флагов.
 *
 * Spec: docs/specs/cli-global-flags.md § Процедура Resolve Global Flags
 * Spec: docs/specs/cli-global-flags.md § Правила каскада
 * Spec: docs/specs/cli-global-flags.md § Правила существования путей
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Readable } from "node:stream";

/**
 * Дескриптор источника конфигурационного файла.
 *
 * Spec: docs/specs/cli-global-flags.md § Тип ConfigSource
 */
export type ConfigSource = { kind: "file"; path: string; baseDir: string } | { kind: "stdin"; baseDir: string };

/**
 * Результат front-end пайплайна — итоговый набор путей.
 *
 * Spec: docs/specs/cli-global-flags.md § Тип ResolvedPaths
 */
export interface ResolvedPaths {
  writeRoot: string;
  resourcesRoot: string;
  configSource: ConfigSource;
  explicit: {
    projectDir: boolean;
    agloomDir: boolean;
    config: boolean;
  };
}

interface ResolveGlobalFlagsInput {
  argv: string[];
  cwd: string;
  stdin: Readable;
}

interface ParsedFlag {
  projectDir?: string;
  agloomDir?: string;
  config?: string;
}

/**
 * Парсит три глобальных флага из argv.
 *
 * Spec: docs/specs/cli-global-flags.md § Процедура Resolve Global Flags § Поведение шаг 1
 * Spec: docs/specs/cli-global-flags.md § Процедура Resolve Global Flags § Расширения 1a/1b
 */
function parseFlags(argv: string[]): ParsedFlag {
  const result: ParsedFlag = {};
  const seen = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--project-dir" || arg === "--agloom-dir" || arg === "--config") {
      if (seen.has(arg)) {
        throw new Error(`${arg} specified more than once.`);
      }
      seen.add(arg);
      if (i + 1 >= argv.length) {
        throw new Error(`Missing value for ${arg}.`);
      }
      const value = argv[i + 1];
      if (arg === "--project-dir") result.projectDir = value;
      else if (arg === "--agloom-dir") result.agloomDir = value;
      else result.config = value;
      i++;
    }
  }

  return result;
}

/**
 * Удаляет три глобальных флага из argv. Используется runCLI, чтобы
 * передать дальнейшим парсерам argv уже без глобальных флагов.
 */
export function stripGlobalFlags(argv: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--project-dir" || arg === "--agloom-dir" || arg === "--config") {
      // Skip flag + its value. resolveGlobalFlags already validated syntax,
      // so we can assume a value is present. Defensive check: only skip if
      // next token exists.
      if (i + 1 < argv.length) i++;
      continue;
    }
    result.push(arg);
  }
  return result;
}

/**
 * Процедура Resolve Global Flags.
 *
 * Spec: docs/specs/cli-global-flags.md § Процедура Resolve Global Flags
 */
export function resolveGlobalFlags(input: ResolveGlobalFlagsInput): ResolvedPaths {
  const { argv, cwd } = input;

  // Шаг 1: распарсить флаги
  const parsed = parseFlags(argv);
  const explicit = {
    projectDir: parsed.projectDir !== undefined,
    agloomDir: parsed.agloomDir !== undefined,
    config: parsed.config !== undefined,
  };

  // Шаг 2: projectDirResolved
  const projectDirResolved = explicit.projectDir ? path.resolve(cwd, parsed.projectDir!) : cwd;

  // Шаг 3: agloomDirResolved
  const agloomDirResolved = explicit.agloomDir
    ? path.resolve(cwd, parsed.agloomDir!)
    : path.join(projectDirResolved, ".agloom");

  // Шаг 4: configSource
  let configSource: ConfigSource;
  if (explicit.config && parsed.config === "-") {
    configSource = { kind: "stdin", baseDir: cwd };
  } else if (explicit.config) {
    const configPath = path.resolve(cwd, parsed.config!);
    configSource = { kind: "file", path: configPath, baseDir: path.dirname(configPath) };
  } else {
    const configPath = path.join(agloomDirResolved, "config.yml");
    configSource = { kind: "file", path: configPath, baseDir: agloomDirResolved };
  }

  // Шаг 5: validate projectDir
  if (explicit.projectDir) {
    validateDirectory(projectDirResolved);
  }

  // Шаг 6: validate agloomDir
  if (explicit.agloomDir) {
    validateDirectory(agloomDirResolved);
  }

  // Шаг 7: validate configSource file
  if (explicit.config && configSource.kind === "file") {
    validateFile(configSource.path);
  }

  return {
    writeRoot: projectDirResolved,
    resourcesRoot: agloomDirResolved,
    configSource,
    explicit,
  };
}

function validateDirectory(dirPath: string): void {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(dirPath);
  } catch {
    throw new Error(`Directory does not exist: ${dirPath}.`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dirPath}.`);
  }
}

function validateFile(filePath: string): void {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    throw new Error(`File does not exist: ${filePath}.`);
  }
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${filePath}.`);
  }
}
