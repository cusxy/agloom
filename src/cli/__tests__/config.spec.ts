// config.spec.ts
// Спецификация: docs/specs/config.md § Процедура Load Config
// Спецификация: docs/specs/config.md § Процедура Resolve Adapters from Config
// Спецификация: docs/specs/config.md § Процедура Resolve Adapters from CLI Args

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfig, resolveAdaptersFromConfig, resolveAdaptersFromCLIArgs } from "../config.js";

describe("CLI", () => {
  // =====================================================================
  // § config.md § Процедура Load Config
  // Загрузка и валидация конфигурационного файла .agloom/config.yml.
  // =====================================================================
  describe("Процедура Load Config", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-config-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-4 ---
    // § config.md § Процедура Load Config § Поведение шаги 1-4:
    // Прочитать файл, распарсить YAML, валидировать adapters, проверить
    // что каждый adapter существует в реестре и не скрыт.
    it("при валидном config.yml с adapters: [claude] возвращает ['claude']", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\n");

      const result = loadConfig(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.adapterIds).toEqual(["claude"]);
      expect(result!.pluginPaths).toBeNull();
    });

    // --- Happy path: несколько адаптеров ---
    // § config.md § Процедура Load Config § Поведение шаги 1-4
    it("при валидном config.yml с adapters: [claude, opencode] возвращает ['claude', 'opencode']", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\n  - opencode\n");

      const result = loadConfig(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.adapterIds).toEqual(["claude", "opencode"]);
      expect(result!.pluginPaths).toBeNull();
    });

    // --- Расширение 1a: файл не существует → null ---
    // § config.md § Процедура Load Config § Расширения 1a
    it("при отсутствии config.yml возвращает null", () => {
      const result = loadConfig(tmpDir);
      expect(result).toBeNull();
    });

    // --- Расширение 2a: невалидный YAML ---
    // § config.md § Процедура Load Config § Расширения 2a:
    // Error("Invalid config file: {parseErrorMessage}")
    it('при невалидном YAML выбрасывает ошибку "Invalid config file: ..."', () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters: [invalid yaml\n  : : :\n");

      expect(() => loadConfig(tmpDir)).toThrow(/Invalid config file:/);
    });

    // --- Расширение 3a: поле adapters отсутствует ---
    // § config.md § Процедура Load Config § Расширения 3a:
    // Error("Invalid config: 'adapters' field is required.")
    it("при отсутствии поля adapters выбрасывает ошибку с требованием поля adapters", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "foo: bar\n");

      expect(() => loadConfig(tmpDir)).toThrow("Invalid config: 'adapters' field is required.");
    });

    // --- Расширение 3b: adapters не является массивом ---
    // § config.md § Процедура Load Config § Расширения 3b:
    // Error("Invalid config: 'adapters' must be an array of strings.")
    it("при adapters как строке выбрасывает ошибку о формате массива", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters: claude\n");

      expect(() => loadConfig(tmpDir)).toThrow("Invalid config: 'adapters' must be an array of strings.");
    });

    // --- Расширение 3b: массив содержит нестроковые элементы ---
    // § config.md § Процедура Load Config § Расширения 3b
    it("при нестроковых элементах в adapters выбрасывает ошибку о формате массива", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - 123\n");

      expect(() => loadConfig(tmpDir)).toThrow("Invalid config: 'adapters' must be an array of strings.");
    });

    // --- Расширение 3c: массив adapters пуст ---
    // § config.md § Процедура Load Config § Расширения 3c:
    // Error("Invalid config: 'adapters' must not be empty.")
    it("при пустом массиве adapters выбрасывает ошибку о непустом массиве", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters: []\n");

      expect(() => loadConfig(tmpDir)).toThrow("Invalid config: 'adapters' must not be empty.");
    });

    // --- Расширение 4a: неизвестный адаптер ---
    // § config.md § Процедура Load Config § Расширения 4a:
    // Error("Invalid config: unknown adapter '{id}'.")
    it("при неизвестном адаптере выбрасывает ошибку с id адаптера", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - foo\n");

      expect(() => loadConfig(tmpDir)).toThrow("Invalid config: unknown adapter 'foo'.");
    });

    // --- Расширение 4b: скрытый адаптер ---
    // § config.md § Процедура Load Config § Расширения 4b:
    // Error("Invalid config: adapter '{id}' cannot be specified in config.")
    it("при скрытом адаптере agentsmd в конфиге выбрасывает ошибку", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - agentsmd\n");

      expect(() => loadConfig(tmpDir)).toThrow("Invalid config: adapter 'agentsmd' cannot be specified in config.");
    });
  });

  // =====================================================================
  // § config.md § Процедура Resolve Adapters from Config
  // Разрешение списка адаптеров из конфига с учётом зависимостей.
  // =====================================================================
  describe("Процедура Resolve Adapters from Config", () => {
    // --- Happy path: [claude] → [claude] ---
    // § config.md § Процедура Resolve Adapters from Config § Пример:
    // adapterIds = ["claude"] → результат = [claude]
    it('при adapterIds ["claude"] возвращает список с записью claude', () => {
      const result = resolveAdaptersFromConfig(["claude"]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("claude");
    });

    // --- Happy path: [claude, opencode] → [claude, agentsmd, opencode] ---
    // § config.md § Процедура Resolve Adapters from Config § Пример:
    // adapterIds = ["claude", "opencode"] → [claude, agentsmd, opencode]
    it('при adapterIds ["claude", "opencode"] возвращает [claude, agentsmd, opencode] в топологическом порядке', () => {
      const result = resolveAdaptersFromConfig(["claude", "opencode"]);
      const ids = result.map((e) => e.id);
      expect(ids).toEqual(["claude", "agentsmd", "opencode"]);
    });

    // --- Трансформация: дедупликация ---
    // § config.md § Процедура Resolve Adapters from Config § Поведение шаг 2:
    // Каждая запись ДОЛЖНА присутствовать в результате не более одного раза.
    it("дедуплицирует записи при разрешении зависимостей", () => {
      const result = resolveAdaptersFromConfig(["claude", "opencode"]);
      const ids = result.map((e) => e.id);
      // agentsmd включён через зависимость opencode, не дублируется
      expect(ids.filter((id) => id === "agentsmd")).toHaveLength(1);
    });
  });

  // =====================================================================
  // § config.md § Процедура Resolve Adapters from CLI Args
  // Общая процедура разрешения списка адаптеров из аргументов CLI.
  // =====================================================================
  describe("Процедура Resolve Adapters from CLI Args", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-resolve-args-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: --adapter ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Поведение шаг 2:
    // adapter указан → Resolve Adapter + Разрешение зависимостей.
    it('при adapter="claude" возвращает список записей с claude', () => {
      const result = resolveAdaptersFromCLIArgs({
        adapter: "claude",
        all: false,
        projectRoot: tmpDir,
        command: "transpile",
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("claude");
    });

    // --- Happy path: --all ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Поведение шаг 3:
    // all === true → вернуть все записи реестра.
    it("при all=true возвращает все записи реестра", () => {
      const result = resolveAdaptersFromCLIArgs({
        adapter: null,
        all: true,
        projectRoot: tmpDir,
        command: "transpile",
      });
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    // --- Расширение 1a: --adapter и --all одновременно ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 1a:
    // Error("--adapter and --all are mutually exclusive.")
    it("при adapter и all одновременно выбрасывает ошибку о взаимоисключающих аргументах", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapter: "claude",
          all: true,
          projectRoot: tmpDir,
          command: "transpile",
        }),
      ).toThrow("--adapter and --all are mutually exclusive.");
    });

    // --- Happy path: fallback на конфиг ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Поведение шаги 4-5:
    // Ни adapter ни all → Load Config → Resolve Adapters from Config.
    it("при отсутствии adapter и all с существующим конфигом возвращает записи из конфига", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\n");

      const result = resolveAdaptersFromCLIArgs({
        adapter: null,
        all: false,
        projectRoot: tmpDir,
        command: "transpile",
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("claude");
    });

    // --- Расширение 4a: конфиг не найден, command !== "init" ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 4a:
    // command !== "init" →
    // Error("No config found. Use --adapter <id> or --all, or run 'agloom init' to create a config.")
    it("при отсутствии конфига и command=transpile выбрасывает ошибку с предложением agloom init", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapter: null,
          all: false,
          projectRoot: tmpDir,
          command: "transpile",
        }),
      ).toThrow("No config found. Use --adapter <id> or --all, or run 'agloom init' to create a config.");
    });

    // --- Расширение 4a: конфиг не найден, command === "init" ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 4a:
    // command === "init" →
    // Error("No config found. Use --adapter <id> or --all to specify adapters.")
    it("при отсутствии конфига и command=init выбрасывает ошибку без упоминания agloom init", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapter: null,
          all: false,
          projectRoot: tmpDir,
          command: "init",
        }),
      ).toThrow("No config found. Use --adapter <id> or --all to specify adapters.");
    });

    // --- Расширение 2a: Resolve Adapter вернул ошибку (адаптер не найден) ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 2a:
    // пробросить ошибку вызывающей команде.
    it("при неизвестном adapter пробрасывает ошибку Resolve Adapter", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapter: "nonexistent",
          all: false,
          projectRoot: tmpDir,
          command: "transpile",
        }),
      ).toThrow(/Unknown agent/);
    });

    // --- Расширение 2a: Resolve Adapter вернул ошибку (скрытый адаптер) ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 2a
    // § adapter-registry-ext.md § hidden: ЗАПРЕЩАЕТСЯ указывать через --adapter
    it("при скрытом adapter (agentsmd) пробрасывает ошибку Resolve Adapter", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapter: "agentsmd",
          all: false,
          projectRoot: tmpDir,
          command: "transpile",
        }),
      ).toThrow(/cannot be used directly/);
    });

    // --- Расширение 4b: Load Config вернул ошибку ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 4b:
    // пробросить ошибку вызывающей команде.
    it("при невалидном config.yml пробрасывает ошибку Load Config", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters: [invalid yaml\n  : : :\n");

      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapter: null,
          all: false,
          projectRoot: tmpDir,
          command: "transpile",
        }),
      ).toThrow(/Invalid config file:/);
    });
  });
});
