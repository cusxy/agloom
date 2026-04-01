// plugin-manifest.ts
// Spec: docs/specs/plugin-manifest.md § Процедура Load Plugin Manifest

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import semver from "semver";

/** Результат загрузки манифеста плагина. */
export interface PluginAuthor {
  name: string;
  email: string;
  url: string | null;
}

/** Валидированный манифест плагина. */
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  license: string | null;
  author: PluginAuthor;
  homepage: string | null;
  keywords: string[];
}

const NAME_REGEX = /^[a-z]([a-z0-9]|(-(?!-)))*[a-z0-9]$|^[a-z]$/;
const NAME_MAX_LENGTH = 214;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Загрузка, парсинг и валидация манифеста плагина.
 * @param pluginDir — абсолютный путь к корню директории плагина.
 */
export function loadPluginManifest(pluginDir: string): PluginManifest {
  // Step 1: определить путь к манифесту
  const manifestPath = path.join(pluginDir, "plugin.yml");

  // Step 2: прочитать содержимое файла манифеста
  let content: string;
  try {
    content = fs.readFileSync(manifestPath, "utf-8");
  } catch {
    throw new Error(`Plugin manifest not found: ${manifestPath}`);
  }

  // Step 3: распарсить содержимое как YAML
  let raw: unknown;
  try {
    raw = yaml.load(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid plugin manifest: ${message}`);
  }

  const data = raw as Record<string, unknown>;

  // Step 4: проверить name
  if (data.name == null || data.name === "") {
    throw new Error("Invalid plugin manifest: 'name' is required.");
  }

  const name = String(data.name);
  if (name.length > NAME_MAX_LENGTH || !NAME_REGEX.test(name)) {
    throw new Error(
      "Invalid plugin manifest: 'name' must contain only lowercase letters, digits, and hyphens, start with a letter, end with a letter or digit, and not contain consecutive hyphens.",
    );
  }

  // Step 5: проверить version
  if (data.version == null || data.version === "") {
    throw new Error("Invalid plugin manifest: 'version' is required.");
  }

  const versionStr = String(data.version);
  const cleaned = semver.valid(versionStr);
  if (
    cleaned === null ||
    (versionStr !== cleaned && !versionStr.startsWith(cleaned + "+"))
  ) {
    throw new Error(
      "Invalid plugin manifest: 'version' must be a valid semver string.",
    );
  }

  // Step 6: проверить description
  if (data.description == null) {
    throw new Error("Invalid plugin manifest: 'description' is required.");
  }
  if (!isNonEmptyString(data.description)) {
    throw new Error(
      "Invalid plugin manifest: 'description' must be a non-empty string.",
    );
  }

  // Step 7: проверить author
  if (data.author == null) {
    throw new Error("Invalid plugin manifest: 'author' is required.");
  }
  if (typeof data.author !== "object" || Array.isArray(data.author)) {
    throw new Error("Invalid plugin manifest: 'author' must be an object.");
  }

  const author = data.author as Record<string, unknown>;

  if (!isNonEmptyString(author.name)) {
    throw new Error(
      "Invalid plugin manifest: 'author.name' must be a non-empty string.",
    );
  }
  if (!isNonEmptyString(author.email)) {
    throw new Error(
      "Invalid plugin manifest: 'author.email' must be a non-empty string.",
    );
  }

  // Step 8: проверить author.url
  let authorUrl: string | null = null;
  if (author.url != null) {
    if (!isNonEmptyString(author.url) || !isValidUrl(author.url)) {
      throw new Error(
        "Invalid plugin manifest: 'author.url' must be a valid URL.",
      );
    }
    authorUrl = author.url;
  }

  // Step 9: проверить license
  let license: string | null = null;
  if (data.license != null) {
    if (!isNonEmptyString(data.license)) {
      throw new Error(
        "Invalid plugin manifest: 'license' must be a non-empty string.",
      );
    }
    license = data.license;
  }

  // Step 10: проверить homepage
  let homepage: string | null = null;
  if (data.homepage != null) {
    if (!isNonEmptyString(data.homepage) || !isValidUrl(data.homepage)) {
      throw new Error(
        "Invalid plugin manifest: 'homepage' must be a valid URL.",
      );
    }
    homepage = data.homepage;
  }

  // Step 11: проверить keywords
  let keywords: string[] = [];
  if (data.keywords != null) {
    if (!Array.isArray(data.keywords)) {
      throw new Error(
        "Invalid plugin manifest: 'keywords' must be an array of strings.",
      );
    }
    for (const kw of data.keywords) {
      if (!isNonEmptyString(kw)) {
        throw new Error(
          "Invalid plugin manifest: each keyword must be a non-empty string.",
        );
      }
    }
    keywords = data.keywords as string[];
  }

  return {
    name,
    version: versionStr,
    description: data.description,
    license,
    author: {
      name: author.name,
      email: author.email,
      url: authorUrl,
    },
    homepage,
    keywords,
  };
}
