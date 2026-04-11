// config.spec.ts
// Спецификация: docs/specs/config.md § Процедура Load Config
// Спецификация: docs/specs/config.md § Процедура Resolve Adapters from Config
// Спецификация: docs/specs/config.md § Процедура Resolve Adapters from CLI Args

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { resolveAdaptersFromConfig, resolveAdaptersFromCLIArgs } from "../config.js";
import { loadConfigFromFile } from "./load-config-test-helper.js";

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
    // § config.md § Процедура Load Config § Поведение шаги 1-4
    it("при валидном config.yml с adapters: [claude] возвращает adapterIds = ['claude']", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\n");

      const result = loadConfigFromFile(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.adapterIds).toEqual(["claude"]);
    });

    // --- Happy path: несколько адаптеров ---
    it("при валидном config.yml с adapters: [claude, opencode] возвращает ['claude', 'opencode']", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\n  - opencode\n");

      const result = loadConfigFromFile(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.adapterIds).toEqual(["claude", "opencode"]);
    });

    // --- Расширение 1a: файл не существует → null ---
    // § config.md § Процедура Load Config § Расширения 1a
    it("при отсутствии config.yml возвращает null", () => {
      const result = loadConfigFromFile(tmpDir);
      expect(result).toBeNull();
    });

    // --- Шаг 5 / новое: файл существует, поле adapters отсутствует → adapterIds = null ---
    // § config.md § Процедура Load Config § Поведение шаг 5:
    // "adapterIds равен ... null, если поле отсутствует".
    // § config.md § Формат файла: поле МОЖЕТ отсутствовать.
    it("при наличии файла без поля adapters возвращает результат с adapterIds = null", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "plugins: []\n");

      const result = loadConfigFromFile(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.adapterIds).toBeNull();
    });

    // --- Другое поле (variables) без adapters тоже валидно ---
    // § config.md § Формат файла: поле adapters МОЖЕТ отсутствовать,
    // если конфиг используется только для других назначений (variables).
    it("при наличии файла только с variables возвращает adapterIds = null без ошибки", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "variables:\n  FOO: bar\n");

      const result = loadConfigFromFile(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.adapterIds).toBeNull();
    });

    // --- Расширение 2a: невалидный YAML ---
    // § config.md § Процедура Load Config § Расширения 2a
    it('при невалидном YAML выбрасывает ошибку "Invalid config file: ..."', () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters: [invalid yaml\n  : : :\n");

      expect(() => loadConfigFromFile(tmpDir)).toThrow(/Invalid config file:/);
    });

    // --- Расширение 3a: adapters не является массивом ---
    // § config.md § Процедура Load Config § Расширения 3a
    it("при adapters как строке выбрасывает ошибку о формате массива", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters: claude\n");

      expect(() => loadConfigFromFile(tmpDir)).toThrow("Invalid config: 'adapters' must be an array of strings.");
    });

    // --- Расширение 3a: массив содержит нестроковые элементы ---
    it("при нестроковых элементах в adapters выбрасывает ошибку о формате массива", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - 123\n");

      expect(() => loadConfigFromFile(tmpDir)).toThrow("Invalid config: 'adapters' must be an array of strings.");
    });

    // --- Расширение 3b: массив adapters пуст ---
    // § config.md § Процедура Load Config § Расширения 3b.
    // Сохранённое поведение: явно пустой массив — ошибка.
    it("при пустом массиве adapters выбрасывает ошибку о непустом массиве", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters: []\n");

      expect(() => loadConfigFromFile(tmpDir)).toThrow("Invalid config: 'adapters' must not be empty.");
    });

    // --- Расширение 4a: неизвестный адаптер ---
    // § config.md § Процедура Load Config § Расширения 4a
    it("при неизвестном адаптере выбрасывает ошибку с id адаптера", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - foo\n");

      expect(() => loadConfigFromFile(tmpDir)).toThrow("Invalid config: unknown adapter 'foo'.");
    });

    // --- Расширение 4b: скрытый адаптер ---
    // § config.md § Процедура Load Config § Расширения 4b
    it("при скрытом адаптере agentsmd в конфиге выбрасывает ошибку", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - agentsmd\n");

      expect(() => loadConfigFromFile(tmpDir)).toThrow(
        "Invalid config: adapter 'agentsmd' cannot be specified in config.",
      );
    });
  });

  // =====================================================================
  // § config.md § Процедура Resolve Adapters from Config
  // =====================================================================
  describe("Процедура Resolve Adapters from Config", () => {
    // § config.md § Процедура Resolve Adapters from Config § Пример
    it('при adapterIds ["claude"] возвращает список с записью claude', () => {
      const result = resolveAdaptersFromConfig(["claude"]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("claude");
    });

    // § config.md § Процедура Resolve Adapters from Config § Пример
    it('при adapterIds ["claude", "opencode"] возвращает [claude, agentsmd, opencode] в топологическом порядке', () => {
      const result = resolveAdaptersFromConfig(["claude", "opencode"]);
      const ids = result.map((e) => e.id);
      expect(ids).toEqual(["claude", "agentsmd", "opencode"]);
    });

    // § config.md § Процедура Resolve Adapters from Config § Поведение шаг 2:
    // дедупликация.
    it("дедуплицирует записи при разрешении зависимостей", () => {
      const result = resolveAdaptersFromConfig(["claude", "opencode"]);
      const ids = result.map((e) => e.id);
      expect(ids.filter((id) => id === "agentsmd")).toHaveLength(1);
    });
  });

  // =====================================================================
  // § config.md § Процедура Resolve Adapters from CLI Args
  // Новый интерфейс: adapterIds: string[] вместо adapter: string | null.
  // =====================================================================
  describe("Процедура Resolve Adapters from CLI Args", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-resolve-args-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: один --adapter ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Поведение шаг 2
    it('при adapterIds=["claude"] возвращает список с записью claude', () => {
      const result = resolveAdaptersFromCLIArgs({
        adapterIds: ["claude"],
        all: false,
        loadedConfig: loadConfigFromFile(tmpDir),
        command: "transpile",
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("claude");
    });

    // --- Happy path: несколько --adapter, multi-adapter ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Поведение шаг 2:
    // дедуплицированный список + Resolve Adapter для каждого + Resolve Adapters from Config.
    // § cli.md § Команда transpile § Аргументы: --adapter МОЖЕТ повторяться.
    it('при adapterIds=["claude", "opencode"] возвращает записи в топологическом порядке с зависимостями', () => {
      const result = resolveAdaptersFromCLIArgs({
        adapterIds: ["claude", "opencode"],
        all: false,
        loadedConfig: loadConfigFromFile(tmpDir),
        command: "transpile",
      });
      const ids = result.map((e) => e.id);
      // opencode зависит от agentsmd → в топологическом порядке
      expect(ids).toEqual(["claude", "agentsmd", "opencode"]);
    });

    // --- Трансформация: дедупликация повторяющихся --adapter ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 2b:
    // повторы молча дедуплицируются, не являются ошибкой.
    it('при adapterIds=["claude", "claude"] возвращает одну запись claude (дедупликация)', () => {
      const result = resolveAdaptersFromCLIArgs({
        adapterIds: ["claude", "claude"],
        all: false,
        loadedConfig: loadConfigFromFile(tmpDir),
        command: "transpile",
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("claude");
    });

    // --- Трансформация: дедупликация с сохранением порядка первого появления ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Поведение шаг 2:
    // "дедуплицировать ... с сохранением порядка первого появления каждого id".
    it('при adapterIds=["claude", "opencode", "claude"] сохраняет порядок первого появления', () => {
      const result = resolveAdaptersFromCLIArgs({
        adapterIds: ["claude", "opencode", "claude"],
        all: false,
        loadedConfig: loadConfigFromFile(tmpDir),
        command: "transpile",
      });
      const ids = result.map((e) => e.id);
      // Результат идентичен ["claude", "opencode"]: claude → agentsmd → opencode
      expect(ids).toEqual(["claude", "agentsmd", "opencode"]);
    });

    // --- Happy path: --all ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Поведение шаг 3
    it("при all=true и пустом adapterIds возвращает все записи реестра", () => {
      const result = resolveAdaptersFromCLIArgs({
        adapterIds: [],
        all: true,
        loadedConfig: loadConfigFromFile(tmpDir),
        command: "transpile",
      });
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    // --- Расширение 1a: одиночный --adapter + --all ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 1a.
    // § cli.md § Команда transpile: "--adapter (даже если указан несколько раз)
    // и --all являются взаимоисключающими".
    it("при одиночном adapterIds и all=true выбрасывает ошибку о взаимоисключающих аргументах", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: ["claude"],
          all: true,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "transpile",
        }),
      ).toThrow("--adapter and --all are mutually exclusive.");
    });

    // --- Расширение 1a: несколько --adapter + --all ---
    it("при нескольких adapterIds и all=true выбрасывает ошибку о взаимоисключающих аргументах", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: ["claude", "opencode"],
          all: true,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "transpile",
        }),
      ).toThrow("--adapter and --all are mutually exclusive.");
    });

    // --- Happy path: fallback на конфиг ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Поведение шаги 4-5
    it("при пустом adapterIds, all=false и существующем конфиге возвращает записи из конфига", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\n");

      const result = resolveAdaptersFromCLIArgs({
        adapterIds: [],
        all: false,
        loadedConfig: loadConfigFromFile(tmpDir),
        command: "transpile",
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("claude");
    });

    // --- Расширение 5a: Load Config вернул adapterIds=null (файл без adapters), command=transpile ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 5a
    it("при файле без поля adapters и command=transpile выбрасывает ошибку про 'adapters' в config.yml", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "plugins: []\n");

      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: [],
          all: false,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "transpile",
        }),
      ).toThrow("No adapters specified. Use --adapter <id>, --all, or add 'adapters' to .agloom/config.yml.");
    });

    // --- Расширение 5a: файла нет, command=transpile → то же сообщение (C2) ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 5a:
    // сообщение одинаково для "нет файла" и "нет поля adapters".
    it("при отсутствии конфига и command=transpile выбрасывает то же сообщение", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: [],
          all: false,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "transpile",
        }),
      ).toThrow("No adapters specified. Use --adapter <id>, --all, or add 'adapters' to .agloom/config.yml.");
    });

    // --- Расширение 5a: command=clean ---
    it("при отсутствии конфига и command=clean выбрасывает то же сообщение с упоминанием config.yml", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: [],
          all: false,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "clean",
        }),
      ).toThrow("No adapters specified. Use --adapter <id>, --all, or add 'adapters' to .agloom/config.yml.");
    });

    // --- Расширение 5a: command=init (нет конфига) ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 5a:
    // command === "init" → другое сообщение без упоминания config.yml.
    it("при отсутствии конфига и command=init выбрасывает ошибку без упоминания config.yml", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: [],
          all: false,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "init",
        }),
      ).toThrow("No adapters specified. Use --adapter <id> or --all to specify adapters.");
    });

    // --- Расширение 5a: command=init + файл без adapters → то же init-сообщение ---
    it("при файле без поля adapters и command=init выбрасывает init-сообщение", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "variables:\n  FOO: bar\n");

      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: [],
          all: false,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "init",
        }),
      ).toThrow("No adapters specified. Use --adapter <id> or --all to specify adapters.");
    });

    // --- Расширение 2a: Resolve Adapter вернул ошибку (неизвестный) ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 2a
    it("при неизвестном id в adapterIds пробрасывает ошибку Resolve Adapter", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: ["nonexistent"],
          all: false,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "transpile",
        }),
      ).toThrow(/Unknown agent/);
    });

    // --- Расширение 2a: Resolve Adapter вернул ошибку (скрытый) ---
    it("при скрытом id (agentsmd) в adapterIds пробрасывает ошибку Resolve Adapter", () => {
      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: ["agentsmd"],
          all: false,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "transpile",
        }),
      ).toThrow(/cannot be used directly/);
    });

    // --- Расширение 5b: Load Config вернул ошибку ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 5b
    it("при невалидном config.yml пробрасывает ошибку Load Config", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters: [invalid yaml\n  : : :\n");

      expect(() =>
        resolveAdaptersFromCLIArgs({
          adapterIds: [],
          all: false,
          loadedConfig: loadConfigFromFile(tmpDir),
          command: "transpile",
        }),
      ).toThrow(/Invalid config file:/);
    });
  });
});
