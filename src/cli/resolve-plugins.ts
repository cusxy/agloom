/**
 * Процедура Resolve Plugins — разрешение и валидация списка плагинов.
 * Spec: docs/specs/plugin-loading.md § Процедура Resolve Plugins
 * Spec: docs/specs/git-plugin-loading.md § Процедура Parse Plugin Entry
 * Spec: docs/specs/git-plugin-loading.md § Алгоритм хеширования URL
 * Spec: docs/specs/git-plugin-loading.md § Процедура Resolve Git Ref
 * Spec: docs/specs/git-plugin-loading.md § Процедура Clone Git Repository
 * Spec: docs/specs/git-plugin-loading.md § Расширение процедуры Resolve Plugins
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import * as childProcess from "node:child_process";
import yaml from "js-yaml";
import { loadPluginManifest } from "./plugin-manifest.js";
import type { PluginManifest } from "./plugin-manifest.js";

// =====================================================================
// Types
// =====================================================================

/** Разрешённый плагин. */
export interface ResolvedPlugin {
  /** Имя плагина из манифеста. */
  name: string;
  /** Абсолютный путь к директории плагина. */
  path: string;
  /** Распарсированный манифест плагина. */
  manifest: PluginManifest;
  /** Полный commit SHA для git-плагинов, null для локальных. */
  resolvedSha: string | null;
  /** URL git-репозитория для git-плагинов, null для локальных. */
  gitUrl: string | null;
  /** Исходный ref из конфига для git-плагинов, null для локальных. */
  gitRef: string | null;
}

/** Результат процедуры Parse Plugin Entry. */
export interface ParsedPluginEntry {
  type: "local" | "git";
  path: string | null;
  url: string | null;
  ref: string | null;
}

// =====================================================================
// parsePluginEntry
// Spec: docs/specs/git-plugin-loading.md § Процедура Parse Plugin Entry
// =====================================================================

/**
 * Разбор элемента массива plugins из raw entry в ParsedPluginEntry.
 */
export function parsePluginEntry(
  entry: string | Record<string, unknown> | unknown,
): ParsedPluginEntry {
  // Шаг 1: определить тип entry
  if (typeof entry === "string") {
    // Шаг 2: проверить наличие #
    if (!entry.includes("#")) {
      // Шаг 3: нет # → local
      return { type: "local", path: entry, url: null, ref: null };
    }

    // Шаг 4: есть # → разбить по последнему #
    const lastHashIndex = entry.lastIndexOf("#");
    const urlPart = entry.slice(0, lastHashIndex);
    const ref = entry.slice(lastHashIndex + 1);

    // Расширение 4a: пустой ref
    if (ref === "") {
      throw new Error(
        `Invalid config: git plugin ref must not be empty in '${entry}'.`,
      );
    }

    // Расширение 4b: пустой URL
    if (urlPart === "") {
      throw new Error(
        `Invalid config: git plugin URL must not be empty in '${entry}'.`,
      );
    }

    // Шаг 4.1: проверить наличие // (исключая :// в протоколе)
    let gitUrl: string;
    let subpath: string | null = null;

    // Ищем // после протокола (после ://)
    const protocolEnd = urlPart.indexOf("://");
    const searchStart = protocolEnd >= 0 ? protocolEnd + 3 : 0;
    const doubleSlashIndex = urlPart.indexOf("//", searchStart);

    if (doubleSlashIndex >= 0) {
      // Шаг 4.2: разбить по //
      gitUrl = urlPart.slice(0, doubleSlashIndex);
      subpath = urlPart.slice(doubleSlashIndex + 2);
    } else {
      // Шаг 4.3: нет //
      gitUrl = urlPart;
    }

    // Шаг 4.4: вернуть git entry
    return { type: "git", url: gitUrl, ref, path: subpath };
  }

  if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
    const obj = entry as Record<string, unknown>;

    // Шаг 6: объект с полем git → git (checked before path since GitPluginEntry also has optional path)
    if ("git" in obj) {
      return {
        type: "git",
        url: obj.git as string,
        ref: (obj.ref as string) ?? null,
        path: (obj.path as string) ?? null,
      };
    }

    // Шаг 5: объект с полем path → local
    if ("path" in obj) {
      return {
        type: "local",
        path: obj.path as string,
        url: null,
        ref: null,
      };
    }
  }

  // Расширение 1a: невалидный вход
  throw new Error(
    "Invalid config: each 'plugins' entry must be a string, an object with 'path' field, or an object with 'git' and 'ref' fields.",
  );
}

// =====================================================================
// hashGitUrl
// Spec: docs/specs/git-plugin-loading.md § Алгоритм хеширования URL
// =====================================================================

/**
 * Вычисляет хеш git URL для использования в структуре кеша.
 * Нормализация: trailing /, .git суффикс, lowercase.
 * SHA-256, первые 16 hex-символов.
 */
export function hashGitUrl(url: string): string {
  let normalized = url;

  // 1. Удалить trailing /
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // 2. Удалить суффикс .git
  if (normalized.endsWith(".git")) {
    normalized = normalized.slice(0, -4);
  }

  // 3. Привести к нижнему регистру
  normalized = normalized.toLowerCase();

  // 4. SHA-256
  const hash = crypto
    .createHash("sha256")
    .update(normalized, "utf-8")
    .digest("hex");

  // 5. Первые 16 hex-символов
  return hash.slice(0, 16);
}

// =====================================================================
// Git environment helpers
// Spec: docs/specs/git-plugin-loading.md § Авторизация Git
// =====================================================================

/**
 * Результат buildGitEnv: env-переменные + путь к askpass-скрипту для cleanup.
 */
interface GitEnvResult {
  env: Record<string, string>;
  askpassScript: string | null;
}

/**
 * Формирует переменные окружения для git-команд.
 * GIT_TERMINAL_PROMPT=0 для подавления интерактивного ввода.
 * GIT_ASKPASS при наличии AGLOOM_GIT_TOKEN.
 */
function buildGitEnv(): GitEnvResult {
  const env: Record<string, string> = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
  } as Record<string, string>;

  let askpassScript: string | null = null;

  const token = process.env.AGLOOM_GIT_TOKEN;
  if (token) {
    askpassScript = createAskpassScript();
    env.GIT_ASKPASS = askpassScript;
  }

  return { env, askpassScript };
}

/**
 * Создаёт временный скрипт для GIT_ASKPASS.
 * Скрипт читает токен из env var AGLOOM_GIT_TOKEN, а не хардкодит значение.
 * Это исключает shell injection и утечку токена на диск.
 */
function createAskpassScript(): string {
  const tmpDir = os.tmpdir();
  const scriptPath = path.join(tmpDir, `agloom-askpass-${process.pid}.sh`);
  fs.writeFileSync(scriptPath, '#!/bin/sh\necho "$AGLOOM_GIT_TOKEN"\n', {
    mode: 0o700,
  });
  return scriptPath;
}

/**
 * Удаляет askpass-скрипт после git-операции (best-effort cleanup).
 */
function cleanupAskpassScript(scriptPath: string | null): void {
  if (scriptPath) {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      // best-effort: файл мог быть уже удалён
    }
  }
}

// =====================================================================
// TTL settings
// Spec: docs/specs/git-plugin-loading.md § Настройка TTL
// =====================================================================

/**
 * Парсит TTL строку в миллисекунды.
 * Формат: число с суффиксом (h — часы, m — минуты, s — секунды).
 * Значение "0" — 0 мс (всегда re-resolve).
 */
function parseTtl(ttlStr: string): number {
  if (ttlStr === "0") return 0;

  const match = ttlStr.match(/^(\d+)([hms])$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    case "s":
      return value * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

/**
 * Загружает TTL из ~/.agloom/settings.yml.
 * По умолчанию: 24h.
 */
function loadTtl(): number {
  const settingsPath = path.join(os.homedir(), ".agloom", "settings.yml");

  try {
    if (!fs.existsSync(settingsPath)) {
      return 24 * 60 * 60 * 1000; // 24h default
    }

    const content = fs.readFileSync(settingsPath, "utf-8");
    const parsed = yaml.load(content) as Record<string, unknown> | null;

    if (
      parsed &&
      typeof parsed === "object" &&
      "cache" in parsed &&
      parsed.cache &&
      typeof parsed.cache === "object"
    ) {
      const cache = parsed.cache as Record<string, unknown>;
      if ("ttl" in cache && cache.ttl != null) {
        return parseTtl(String(cache.ttl));
      }
    }
  } catch {
    // Ошибка чтения — используем значение по умолчанию
  }

  return 24 * 60 * 60 * 1000; // 24h default
}

// =====================================================================
// resolveGitRef
// Spec: docs/specs/git-plugin-loading.md § Процедура Resolve Git Ref
// =====================================================================

interface RefsEntry {
  sha: string;
  resolvedAt: string;
  mutable: boolean;
}

interface RefsYml {
  refs: Record<string, RefsEntry>;
}

/**
 * Разрешение Git ref в commit SHA с учётом кеша и TTL.
 */
export function resolveGitRef(params: {
  gitUrl: string;
  ref: string;
  forceRefresh: boolean;
}): { resolvedSha: string; cachePath: string } {
  const { gitUrl, ref, forceRefresh } = params;

  // Шаг 1: вычислить urlHash
  const urlHash = hashGitUrl(gitUrl);

  const cacheBase = path.join(
    os.homedir(),
    ".agloom",
    "cache",
    "plugins",
    urlHash,
  );

  // Шаг 2: определить тип ref
  const SHA_REGEX = /^[0-9a-f]{40}$/;
  if (SHA_REGEX.test(ref)) {
    // Шаг 2.1: immutable — commit SHA
    const resolvedSha = ref;
    const cachePath = path.join(cacheBase, resolvedSha);

    // Шаг 7-8: проверить наличие кеша
    if (fs.existsSync(cachePath)) {
      return { resolvedSha, cachePath };
    }

    // Шаг 9: clone
    const cloneResult = cloneGitRepository({
      gitUrl,
      resolvedSha,
      ref,
      urlHash,
    });
    return { resolvedSha, cachePath: cloneResult.cachePath };
  }

  // Шаг 3: прочитать refs.yml
  const refsPath = path.join(cacheBase, "refs.yml");
  let refsData: RefsYml | null = null;

  try {
    if (fs.existsSync(refsPath)) {
      const content = fs.readFileSync(refsPath, "utf-8");
      refsData = yaml.load(content) as RefsYml;
    }
  } catch {
    // Расширение 3a: refs.yml не существует или ошибка чтения
    refsData = null;
  }

  // Шаг 4: проверить кеш
  if (refsData?.refs?.[ref]) {
    const entry = refsData.refs[ref];

    // Шаг 4.1: immutable cached ref
    if (!entry.mutable) {
      const resolvedSha = entry.sha;
      const cachePath = path.join(cacheBase, resolvedSha);
      if (fs.existsSync(cachePath)) {
        return { resolvedSha, cachePath };
      }
      // Кеш-директория отсутствует — нужен clone, но SHA известен
      const cloneResult = cloneGitRepository({
        gitUrl,
        resolvedSha,
        ref,
        urlHash,
      });
      return { resolvedSha, cachePath: cloneResult.cachePath };
    }

    // Шаг 4.2: mutable ref
    if (!forceRefresh) {
      // Шаг 4.2-4.3: проверить TTL
      const ttl = loadTtl();
      const resolvedAt = new Date(entry.resolvedAt).getTime();
      const now = Date.now();

      if (ttl > 0 && resolvedAt + ttl > now) {
        // TTL не истёк
        const resolvedSha = entry.sha;
        const cachePath = path.join(cacheBase, resolvedSha);
        if (fs.existsSync(cachePath)) {
          return { resolvedSha, cachePath };
        }
      }
      // Шаг 4.4: TTL истёк — перейти к шагу 5
    }
    // forceRefresh === true — перейти к шагу 5
  }

  // Шаг 5: git ls-remote
  const { env: gitEnv, askpassScript } = buildGitEnv();
  let lsRemoteOutput: string;

  try {
    const result = childProcess.execSync(`git ls-remote ${gitUrl} ${ref}`, {
      env: gitEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });
    lsRemoteOutput =
      typeof result === "string" ? result : result.toString("utf-8");
  } catch (err) {
    cleanupAskpassScript(askpassScript);
    const error = err as Error & { stderr?: Buffer | string };
    const stderr = error.stderr
      ? typeof error.stderr === "string"
        ? error.stderr
        : error.stderr.toString()
      : error.message;

    // Расширение 5a: ошибка аутентификации
    if (
      stderr.toLowerCase().includes("authentication") ||
      stderr.toLowerCase().includes("could not read")
    ) {
      throw new Error(
        `Authentication failed for '${gitUrl}': ${stderr.trim()}`,
      );
    }

    throw new Error(
      `Failed to resolve ref '${ref}' for '${gitUrl}': ${stderr.trim()}`,
    );
  }

  cleanupAskpassScript(askpassScript);

  // Расширение 5b: ref не найден
  if (!lsRemoteOutput.trim()) {
    throw new Error(`Ref '${ref}' not found in '${gitUrl}': no matching refs`);
  }

  // Шаг 6: определить mutability
  const lines = lsRemoteOutput.trim().split("\n");
  const firstLine = lines[0];
  const resolvedSha = firstLine.split("\t")[0];

  // Шаг 6.1-6.2: проверить refs/tags
  const isTag = lines.some((line) => line.includes(`refs/tags/${ref}`));
  const mutable = !isTag;

  // Шаг 6.4: записать refs.yml
  fs.mkdirSync(cacheBase, { recursive: true });

  const existingRefs: RefsYml = refsData ?? { refs: {} };
  if (!existingRefs.refs) {
    existingRefs.refs = {};
  }
  existingRefs.refs[ref] = {
    sha: resolvedSha,
    resolvedAt: new Date().toISOString(),
    mutable,
  };

  fs.writeFileSync(refsPath, yaml.dump(existingRefs));

  // Шаг 7-8: проверить наличие кеша
  const cachePath = path.join(cacheBase, resolvedSha);
  if (fs.existsSync(cachePath)) {
    return { resolvedSha, cachePath };
  }

  // Шаг 9: clone
  const cloneResult = cloneGitRepository({
    gitUrl,
    resolvedSha,
    ref,
    urlHash,
  });

  // Шаг 10: вернуть результат
  return { resolvedSha, cachePath: cloneResult.cachePath };
}

// =====================================================================
// cloneGitRepository
// Spec: docs/specs/git-plugin-loading.md § Процедура Clone Git Repository
// =====================================================================

/**
 * Клонирование git-репозитория в кеш.
 */
export function cloneGitRepository(params: {
  gitUrl: string;
  resolvedSha: string;
  ref: string;
  urlHash: string;
}): { cachePath: string } {
  const { gitUrl, resolvedSha, ref, urlHash } = params;

  // Шаг 1: определить целевой путь
  const cachePath = path.join(
    os.homedir(),
    ".agloom",
    "cache",
    "plugins",
    urlHash,
    resolvedSha,
  );

  // Шаг 2: кеш hit
  if (fs.existsSync(cachePath)) {
    return { cachePath };
  }

  const { env: gitEnv, askpassScript } = buildGitEnv();
  const SHA_REGEX = /^[0-9a-f]{40}$/;
  const isSha = SHA_REGEX.test(ref);

  // Шаг 3: создать временную директорию
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agloom-clone-"));

  try {
    if (!isSha) {
      // Шаг 4.1: тег/ветка → --depth 1 --branch
      try {
        childProcess.execSync(
          `git clone --depth 1 --branch ${ref} ${gitUrl} ${tmpDir}`,
          {
            env: gitEnv,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
      } catch (err) {
        // Расширение 4.1a: clone ошибка
        const error = err as Error & { stderr?: Buffer | string };
        const stderr = error.stderr
          ? typeof error.stderr === "string"
            ? error.stderr
            : error.stderr.toString()
          : error.message;
        // Удалить временную директорию
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // best effort
        }
        throw new Error(`Failed to clone '${gitUrl}': ${stderr.trim()}`);
      }
    } else {
      // Шаг 4.2: SHA → --filter=blob:none
      try {
        childProcess.execSync(
          `git clone --filter=blob:none ${gitUrl} ${tmpDir}`,
          {
            env: gitEnv,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
      } catch {
        // Расширение 4.2a: fallback full clone
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // best effort
        }
        fs.mkdirSync(tmpDir, { recursive: true });

        try {
          childProcess.execSync(`git clone ${gitUrl} ${tmpDir}`, {
            env: gitEnv,
            stdio: ["pipe", "pipe", "pipe"],
          });
        } catch (err2) {
          // Расширение 4.2a.1: fallback clone ошибка
          const error = err2 as Error & { stderr?: Buffer | string };
          const stderr = error.stderr
            ? typeof error.stderr === "string"
              ? error.stderr
              : error.stderr.toString()
            : error.message;
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch {
            // best effort
          }
          throw new Error(`Failed to clone '${gitUrl}': ${stderr.trim()}`);
        }

        // Checkout after fallback clone
        try {
          childProcess.execSync(`git -C ${tmpDir} checkout ${resolvedSha}`, {
            env: gitEnv,
            stdio: ["pipe", "pipe", "pipe"],
          });
        } catch (err3) {
          // Расширение 4.2a.2: checkout ошибка после fallback
          const error = err3 as Error & { stderr?: Buffer | string };
          const stderr = error.stderr
            ? typeof error.stderr === "string"
              ? error.stderr
              : error.stderr.toString()
            : error.message;
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch {
            // best effort
          }
          throw new Error(
            `Failed to checkout '${resolvedSha}' from '${gitUrl}': ${stderr.trim()}`,
          );
        }

        // Перейти к шагу 6 (пропустить шаг 5 — checkout уже выполнен)
        fs.mkdirSync(path.dirname(cachePath), { recursive: true });
        fs.renameSync(tmpDir, cachePath);
        return { cachePath };
      }

      // Шаг 5: checkout после partial clone
      try {
        childProcess.execSync(`git -C ${tmpDir} checkout ${resolvedSha}`, {
          env: gitEnv,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err) {
        // Расширение 5a: checkout ошибка
        const error = err as Error & { stderr?: Buffer | string };
        const stderr = error.stderr
          ? typeof error.stderr === "string"
            ? error.stderr
            : error.stderr.toString()
          : error.message;
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // best effort
        }
        throw new Error(
          `Failed to checkout '${resolvedSha}' from '${gitUrl}': ${stderr.trim()}`,
        );
      }
    }

    // Шаг 6: создать промежуточные каталоги
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    // Шаг 7: переместить в целевой путь
    fs.renameSync(tmpDir, cachePath);
  } catch (err) {
    // Шаг 8: удалить временную директорию при ошибке
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // best effort
    }
    throw err;
  } finally {
    cleanupAskpassScript(askpassScript);
  }

  return { cachePath };
}

// =====================================================================
// resolvePlugins (расширенная версия)
// Spec: docs/specs/plugin-loading.md § Процедура Resolve Plugins
// Spec: docs/specs/git-plugin-loading.md § Расширение процедуры Resolve Plugins
// =====================================================================

/**
 * Разрешает и валидирует список плагинов из конфигурации.
 *
 * Поддерживает два варианта вызова:
 * 1. Legacy: { pluginPaths, projectRoot } — для обратной совместимости.
 * 2. Extended: { pluginEntries, projectRoot, forceRefresh } — для git-плагинов.
 */
export function resolvePlugins(
  params:
    | { pluginPaths: string[]; projectRoot: string }
    | {
        pluginEntries: ParsedPluginEntry[];
        projectRoot: string;
        forceRefresh: boolean;
      },
): ResolvedPlugin[] {
  const { projectRoot } = params;

  // Определить режим вызова
  let entries: ParsedPluginEntry[];
  let forceRefresh = false;

  if ("pluginEntries" in params) {
    entries = params.pluginEntries;
    forceRefresh = params.forceRefresh;
  } else {
    // Legacy mode: преобразовать pluginPaths в ParsedPluginEntry
    entries = params.pluginPaths.map((p) => ({
      type: "local" as const,
      path: p,
      url: null,
      ref: null,
    }));
  }

  // Шаг 1: инициализировать resolved и nameToPath
  const resolved: ResolvedPlugin[] = [];
  const nameToPath: Record<string, string> = {};

  // Шаг 2: для каждого entry
  for (const entry of entries) {
    if (entry.type === "local") {
      // Шаг 2.0a: обработать как локальный плагин
      const pluginPath = entry.path!;

      // Шаг 2.1: разрешить путь
      const absolutePath = path.isAbsolute(pluginPath)
        ? pluginPath
        : path.resolve(projectRoot, pluginPath);

      // Шаг 2.2: проверить существование
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Plugin path not found: '${absolutePath}'.`);
      }

      const stat = fs.statSync(absolutePath);
      if (!stat.isDirectory()) {
        throw new Error(`Plugin path is not a directory: '${absolutePath}'.`);
      }

      // Шаг 2.3: проверить наличие plugin.yml
      const manifestPath = path.join(absolutePath, "plugin.yml");
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Plugin manifest not found: '${manifestPath}'.`);
      }

      // Шаги 2.4-2.5: парсинг и валидация манифеста
      let manifest: PluginManifest;
      try {
        manifest = loadPluginManifest(absolutePath);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith("Invalid plugin manifest:")) {
          const detail = message.slice("Invalid plugin manifest: ".length);
          throw new Error(
            `Invalid plugin manifest at '${manifestPath}': ${detail}`,
          );
        }
        throw new Error(
          `Invalid plugin manifest at '${manifestPath}': ${message}`,
        );
      }

      // Шаг 2.6-2.8: проверить дубликаты
      const name = manifest.name;
      if (name in nameToPath) {
        throw new Error(
          `Duplicate plugin name '${name}': declared at '${nameToPath[name]}' and '${absolutePath}'.`,
        );
      }
      nameToPath[name] = absolutePath;

      // Шаг 2.9: добавить в resolved
      resolved.push({
        name,
        path: absolutePath,
        manifest,
        resolvedSha: null,
        gitUrl: null,
        gitRef: null,
      });
    } else {
      // Шаг 2.0b: обработать как git-плагин

      // Шаг 2.10: Resolve Git Ref
      const gitRefResult = resolveGitRef({
        gitUrl: entry.url!,
        ref: entry.ref!,
        forceRefresh,
      });

      // Шаг 2.11: определить корень плагина
      let pluginRoot: string;
      if (entry.path) {
        pluginRoot = path.join(gitRefResult.cachePath, entry.path);
      } else {
        pluginRoot = gitRefResult.cachePath;
      }

      // Шаг 2.12: проверить существование
      if (!fs.existsSync(pluginRoot)) {
        throw new Error(
          `Plugin subpath '${entry.path}' not found in repository '${entry.url}' at ref '${entry.ref}'.`,
        );
      }

      const stat = fs.statSync(pluginRoot);
      if (!stat.isDirectory()) {
        throw new Error(
          `Plugin subpath '${entry.path}' is not a directory in repository '${entry.url}'.`,
        );
      }

      // Шаг 2.13: загрузить манифест
      const manifestPath = path.join(pluginRoot, "plugin.yml");
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Plugin manifest not found: '${manifestPath}'.`);
      }

      let manifest: PluginManifest;
      try {
        manifest = loadPluginManifest(pluginRoot);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith("Invalid plugin manifest:")) {
          const detail = message.slice("Invalid plugin manifest: ".length);
          throw new Error(
            `Invalid plugin manifest at '${manifestPath}': ${detail}`,
          );
        }
        throw new Error(
          `Invalid plugin manifest at '${manifestPath}': ${message}`,
        );
      }

      // Шаг 2.14: проверить уникальность имени
      const name = manifest.name;
      if (name in nameToPath) {
        throw new Error(
          `Duplicate plugin name '${name}': declared at '${nameToPath[name]}' and '${pluginRoot}'.`,
        );
      }
      nameToPath[name] = pluginRoot;

      // Шаг 2.15: добавить в resolved
      resolved.push({
        name,
        path: pluginRoot,
        manifest,
        resolvedSha: gitRefResult.resolvedSha,
        gitUrl: entry.url,
        gitRef: entry.ref,
      });
    }
  }

  // Шаг 3: вернуть resolved
  return resolved;
}
