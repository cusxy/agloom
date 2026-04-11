/**
 * Read Config Source — единая точка I/O над configSource.
 *
 * Spec: docs/specs/config.md § Процедура Read Config Source
 */

import * as fs from "node:fs";
import type { Readable } from "node:stream";
import yaml from "js-yaml";
import type { ConfigSource } from "./resolve-global-flags.js";

/**
 * Результат Read Config Source.
 *
 * Spec: docs/specs/config.md § Процедура Read Config Source § Результат
 */
export type RawConfig = { kind: "missing" } | { kind: "parsed"; value: Record<string, unknown> };

/** Сигнатура injectable readFile-хука для тестов single-I/O инварианта. */
export type ReadFile = (filePath: string, encoding?: BufferEncoding) => Promise<string>;

interface ReadConfigSourceInput {
  configSource: ConfigSource;
  stdin: Readable;
  /** Injectable readFile — default fs.promises.readFile. */
  readFile?: ReadFile;
}

async function readStdinAsString(stdin: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk as Buffer);
    }
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Разбирает YAML-содержимое конфига: парсинг, нормализация
 * пустого источника и проверка top-level object.
 *
 * Spec: docs/specs/config.md § Процедура Read Config Source § Поведение шаги 2-4
 */
function parseConfigContent(content: string): RawConfig {
  // Шаг 2: распарсить YAML
  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid config file: ${message}`);
  }

  // Шаг 3: нормализация пустого источника
  if (parsed === null || parsed === undefined) {
    return { kind: "parsed", value: {} };
  }

  // Шаг 4 / расширение 4a: top-level должен быть object
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid config: 'adapters' must be an array of strings.");
  }

  return { kind: "parsed", value: parsed as Record<string, unknown> };
}

/**
 * Процедура Read Config Source.
 *
 * Spec: docs/specs/config.md § Процедура Read Config Source
 */
export async function readConfigSource(input: ReadConfigSourceInput): Promise<RawConfig> {
  const { configSource, stdin } = input;
  const readFile: ReadFile =
    input.readFile ?? ((filePath, encoding) => fs.promises.readFile(filePath, encoding ?? "utf-8") as Promise<string>);

  // Шаг 1: получить содержимое
  let content: string;
  if (configSource.kind === "file") {
    // Расширение 1a: файл не существует → missing (только для дефолтного пути;
    // для явного --config существование уже проверено в Resolve Global Flags).
    if (!fs.existsSync(configSource.path)) {
      return { kind: "missing" };
    }
    content = await readFile(configSource.path);
  } else {
    content = await readStdinAsString(stdin);
  }

  return parseConfigContent(content);
}
