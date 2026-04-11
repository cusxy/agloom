/**
 * Run CLI — единая точка входа front-end пайплайна.
 *
 * Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
 */

import type { Readable, Writable } from "node:stream";
import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { resolveGlobalFlags } from "./resolve-global-flags.js";
import type { ResolvedPaths } from "./resolve-global-flags.js";
import { readConfigSource } from "./read-config-source.js";
import type { RawConfig, ReadFile } from "./read-config-source.js";
import { loadConfig } from "./config.js";
import type { LoadConfigResult } from "./config.js";

export interface RunCLIInput {
  argv: string[];
  cwd: string;
  stdin: Readable;
  /**
   * Опциональный внешний stdout. Когда передан (например, `process.stdout`
   * из production entry-point), Ink рендерит напрямую в переданный стрим
   * (с ANSI-цветами и прогрессивными обновлениями для async-команд).
   * Когда не передан — runCLI создаёт buffer-backed writable, и результат
   * возвращается в `result.stdout` как захваченная строка (текущий
   * тестовый контракт).
   */
  stdout?: Writable | NodeJS.WriteStream;
  /** Аналогично `stdout` для stderr. */
  stderr?: Writable | NodeJS.WriteStream;
  /** Test affordance: inject readFile to count configSource reads. */
  readFile?: ReadFile;
}

export interface RunCLIResult {
  exitCode: number;
  /**
   * Захваченный stdout. Содержит вывод только когда runCLI создавал
   * собственный buffer-writable. При передаче внешнего stdout (production
   * entry-point) строка пустая — вывод ушёл напрямую в переданный стрим.
   */
  stdout: string;
  /** Аналогично `stdout` для stderr. */
  stderr: string;
}

/**
 * Writable stream, собирающий вывод в строку. Используется в runCLI
 * для захвата stdout/stderr без воздействия на реальные процесс-стримы.
 */
class StringWritable {
  content: string = "";
  // Minimal stream-duck-typing that Ink's render() needs.
  write(chunk: string | Uint8Array): boolean {
    this.content += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8");
    return true;
  }
  end(): void {}
  on(): this {
    return this;
  }
  off(): this {
    return this;
  }
  once(): this {
    return this;
  }
  emit(): boolean {
    return false;
  }
  removeListener(): this {
    return this;
  }
  // Ink checks isTTY to decide rendering mode.
  isTTY = false;
  columns = 80;
  rows = 24;
}

/**
 * Процедура Run CLI.
 *
 * Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
 */
export async function runCLI(input: RunCLIInput): Promise<RunCLIResult> {
  // Buffer-backed writables используются, только если caller НЕ передал
  // внешние stdout/stderr. При передаче внешних стримов runCLI направляет
  // всю запись туда — это нужно production entry-point, чтобы пользователь
  // видел цветной интерактивный Ink-вывод в терминале.
  const bufferStdout = new StringWritable();
  const bufferStderr = new StringWritable();
  const stdout: Writable | NodeJS.WriteStream = input.stdout ?? (bufferStdout as unknown as NodeJS.WriteStream);
  const stderr: Writable | NodeJS.WriteStream = input.stderr ?? (bufferStderr as unknown as NodeJS.WriteStream);
  const externalStdout = input.stdout !== undefined;
  const externalStderr = input.stderr !== undefined;

  // Сохраняем и временно обнуляем process.exitCode, чтобы изоляция
  // вызовов runCLI внутри одного процесса не мешала друг другу.
  const savedExitCode = process.exitCode;
  process.exitCode = undefined;

  let paths: ResolvedPaths;
  try {
    // Шаг 1: Resolve Global Flags
    paths = resolveGlobalFlags({ argv: input.argv, cwd: input.cwd, stdin: input.stdin });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stderr.write(message + "\n");
    const exitCode = 1;
    process.exitCode = savedExitCode;
    return {
      exitCode,
      stdout: externalStdout ? "" : bufferStdout.content,
      stderr: externalStderr ? "" : bufferStderr.content,
    };
  }

  // Шаг 2: Read Config Source + Load Config (eager, C6)
  let rawConfig: RawConfig;
  let loadedConfig: LoadConfigResult | null;
  try {
    rawConfig = await readConfigSource({
      configSource: paths.configSource,
      stdin: input.stdin,
      readFile: input.readFile,
    });
    loadedConfig = loadConfig(rawConfig);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stderr.write(message + "\n");
    process.exitCode = savedExitCode;
    return {
      exitCode: 1,
      stdout: externalStdout ? "" : bufferStdout.content,
      stderr: externalStderr ? "" : bufferStderr.content,
    };
  }

  // Шаг 3-4: рендер App с предвычисленным пайплайном.
  //
  // Для buffer-backed writables используем Ink `debug: true` режим, который
  // делает рендер синхронным и пишет финальный фрейм сразу — это нужно
  // тестам, собирающим вывод в строку. Для external process-streams
  // (`process.stdout`/`process.stderr`) debug-режим отключаем, чтобы
  // пользователь в production получал нативный интерактивный Ink-вывод:
  // цвета, spinner'ы, прогрессивные обновления для transpile/format.
  //
  // Все static views (HelpView, AdaptersView, InitView, CacheCleanView,
  // error-паты через StaticExit wrapper) завершаются детерминистично через
  // `useExitOnMount`-хук в app.tsx. Async views (TranspileView, FormatView)
  // вызывают `useApp().exit()` в useEffect после завершения работы.
  // Поэтому `waitUntilExit()` резолвится без race-против-таймаута.
  const instance = render(
    React.createElement(App, {
      args: input.argv,
      paths,
      rawConfig,
      loadedConfig,
    }),
    {
      stdout: stdout as NodeJS.WriteStream,
      stderr: stderr as NodeJS.WriteStream,
      debug: !externalStdout,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  );

  await instance.waitUntilExit();

  const exitCode = typeof process.exitCode === "number" ? process.exitCode : 0;
  process.exitCode = savedExitCode;

  return {
    exitCode,
    stdout: externalStdout ? "" : bufferStdout.content,
    stderr: externalStderr ? "" : bufferStderr.content,
  };
}
