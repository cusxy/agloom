// plugin-loading.spec.ts
// Спецификация: docs/specs/plugin-loading.md § Расширение процедуры Load Config
// Спецификация: docs/specs/plugin-loading.md § Процедура Resolve Plugins
// Спецификация: docs/specs/plugin-loading.md § Тип ResolvedPlugin
// Спецификация: docs/specs/plugin-loading.md § Формирование массива layers
// Спецификация: docs/specs/plugin-loading.md § Расширение процедуры «Шаг транспиляции»
// Спецификация: docs/specs/plugin-loading.md § Стратегия обработки ошибок
// Спецификация: docs/specs/plugin-loading.md § Обратная совместимость
// Спецификация: docs/specs/plugin-loading.md § Расширение команды transpile

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfig } from "../config.js";

/**
 * Записывает plugin.yml из YAML-строки.
 */
function writePluginYaml(pluginDir: string, yamlContent: string): void {
  fs.writeFileSync(path.join(pluginDir, "plugin.yml"), yamlContent);
}

/** Минимальный валидный plugin.yml. */
const _VALID_MANIFEST =
  "name: test-plugin\nversion: 1.0.0\ndescription: Test plugin\nauthor:\n  name: Test\n  email: test@test.com\n";

function validManifest(name: string): string {
  return `name: ${name}\nversion: 1.0.0\ndescription: Plugin ${name}\nauthor:\n  name: Test\n  email: test@test.com\n`;
}

describe("CLI", () => {
  // =====================================================================
  // § plugin-loading.md § Расширение процедуры Load Config
  // Обработка опционального поля plugins в config.yml.
  // =====================================================================
  describe("Расширение процедуры Load Config — поле plugins", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-plugin-config-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 5-6 ---
    // § plugin-loading.md § Расширение процедуры Load Config § Новые шаги 5-6:
    // Проверить наличие поля plugins, проверить что массив строк.
    // § Изменения в результате: pluginPaths = array<string>.
    it("при валидном config.yml с plugins возвращает pluginPaths как массив строк", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        "adapters:\n  - claude\nplugins:\n  - ../shared-config\n  - ../team-standards\n",
      );

      const result = loadConfig(tmpDir);
      // Расширенный Load Config должен возвращать объект с pluginPaths
      expect(result).toHaveProperty("pluginPaths");
      expect((result as unknown as { pluginPaths: string[] }).pluginPaths).toEqual([
        "../shared-config",
        "../team-standards",
      ]);
    });

    // --- Расширение 5a: поле plugins отсутствует → pluginPaths = null ---
    // § plugin-loading.md § Расширение процедуры Load Config § Новые расширения 5a:
    // Поле plugins отсутствует → pluginPaths = null.
    it("при отсутствии поля plugins возвращает pluginPaths: null", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\n");

      const result = loadConfig(tmpDir);
      expect(result).toHaveProperty("pluginPaths");
      expect((result as unknown as { pluginPaths: null }).pluginPaths).toBeNull();
    });

    // --- Расширение 6a: plugins не является массивом ---
    // § plugin-loading.md § Расширение процедуры Load Config § Новые расширения 6a:
    // Error("Invalid config: 'plugins' must be an array of strings.")
    it("при plugins как строке выбрасывает ошибку о формате массива", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\nplugins: ../shared-config\n");

      expect(() => loadConfig(tmpDir)).toThrow("Invalid config: 'plugins' must be an array of strings.");
    });

    // --- Расширение 6a: plugins содержит нестроковые элементы ---
    // § plugin-loading.md § Расширение процедуры Load Config § Новые расширения 6a
    it("при нестроковых элементах в plugins выбрасывает ошибку о формате массива", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\nplugins:\n  - 123\n");

      expect(() => loadConfig(tmpDir)).toThrow("Invalid config: 'plugins' must be an array of strings.");
    });

    // --- Граничное условие: пустой массив plugins ---
    // § plugin-loading.md § Расширение формата конфигурационного файла:
    // Массив МОЖЕТ быть пустым (эквивалентно отсутствию поля).
    it("при пустом массиве plugins возвращает pluginPaths как пустой массив", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\nplugins: []\n");

      const result = loadConfig(tmpDir);
      expect(result).toHaveProperty("pluginPaths");
      expect((result as unknown as { pluginPaths: string[] }).pluginPaths).toEqual([]);
    });

    // --- Граничное условие: один плагин ---
    // § plugin-loading.md § Расширение формата конфигурационного файла
    it("при одном плагине в plugins возвращает массив с одним элементом", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\nplugins:\n  - ../single-plugin\n");

      const result = loadConfig(tmpDir);
      expect((result as unknown as { pluginPaths: string[] }).pluginPaths).toEqual(["../single-plugin"]);
    });
  });

  // =====================================================================
  // § plugin-loading.md § Процедура Resolve Plugins
  // Разрешение и валидация списка плагинов из конфигурации.
  // =====================================================================
  describe("Процедура Resolve Plugins", () => {
    let tmpDir: string;
    let pluginDirA: string;
    let pluginDirB: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-resolve-plugins-"));
      pluginDirA = path.join(tmpDir, "plugins", "plugin-a");
      pluginDirB = path.join(tmpDir, "plugins", "plugin-b");
      fs.mkdirSync(pluginDirA, { recursive: true });
      fs.mkdirSync(pluginDirB, { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-3, один плагин ---
    // § plugin-loading.md § Процедура Resolve Plugins § Поведение шаги 1-3:
    // Инициализировать resolved, разрешить путь, прочитать plugin.yml,
    // валидировать, вернуть массив ResolvedPlugin.
    it("при одном валидном плагине возвращает массив с одним ResolvedPlugin", async () => {
      writePluginYaml(pluginDirA, validManifest("plugin-a"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: {
          pluginPaths: string[];
          projectRoot: string;
        }) => { name: string; path: string; manifest: { name: string } }[];
      };

      const result = resolvePlugins({
        pluginPaths: [pluginDirA],
        projectRoot: tmpDir,
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("plugin-a");
      expect(result[0].path).toBe(pluginDirA);
      expect(result[0].manifest).toBeDefined();
      expect(result[0].manifest.name).toBe("plugin-a");
    });

    // --- Happy path: несколько плагинов в порядке объявления ---
    // § plugin-loading.md § Процедура Resolve Plugins § Результат:
    // plugins — упорядоченный список в порядке объявления.
    it("при нескольких валидных плагинах возвращает их в порядке объявления", async () => {
      writePluginYaml(pluginDirA, validManifest("plugin-a"));
      writePluginYaml(pluginDirB, validManifest("plugin-b"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => { name: string; path: string }[];
      };

      const result = resolvePlugins({
        pluginPaths: [pluginDirA, pluginDirB],
        projectRoot: tmpDir,
      });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("plugin-a");
      expect(result[1].name).toBe("plugin-b");
    });

    // --- Шаг 2.1: разрешение относительного пути ---
    // § plugin-loading.md § Процедура Resolve Plugins § Поведение шаг 2.1:
    // Если pluginPath является относительным — вычислить абсолютный
    // путь относительно projectRoot.
    it("разрешает относительные пути относительно projectRoot", async () => {
      writePluginYaml(pluginDirA, validManifest("plugin-a"));
      const relativePath = path.relative(tmpDir, pluginDirA);

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => { name: string; path: string }[];
      };

      const result = resolvePlugins({
        pluginPaths: [relativePath],
        projectRoot: tmpDir,
      });

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe(pluginDirA);
    });

    // --- Шаг 2.1: абсолютный путь используется как есть ---
    // § plugin-loading.md § Процедура Resolve Plugins § Поведение шаг 2.1:
    // Если абсолютный — использовать как есть.
    it("использует абсолютные пути как есть", async () => {
      writePluginYaml(pluginDirA, validManifest("plugin-a"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => { name: string; path: string }[];
      };

      const result = resolvePlugins({
        pluginPaths: [pluginDirA],
        projectRoot: tmpDir,
      });

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe(pluginDirA);
    });

    // --- Расширение 2.2a: путь не существует → Error ---
    // § plugin-loading.md § Процедура Resolve Plugins § Расширения 2.2a:
    // Error("Plugin path not found: '{абсолютный путь}'.")
    it("выбрасывает ошибку при несуществующем пути плагина", async () => {
      const nonexistentPath = path.join(tmpDir, "nonexistent");

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => unknown[];
      };

      expect(() =>
        resolvePlugins({
          pluginPaths: [nonexistentPath],
          projectRoot: tmpDir,
        }),
      ).toThrow(`Plugin path not found: '${nonexistentPath}'.`);
    });

    // --- Расширение 2.2b: путь не является директорией → Error ---
    // § plugin-loading.md § Процедура Resolve Plugins § Расширения 2.2b:
    // Error("Plugin path is not a directory: '{абсолютный путь}'.")
    it("выбрасывает ошибку если путь плагина является файлом, а не директорией", async () => {
      const filePath = path.join(tmpDir, "not-a-dir");
      fs.writeFileSync(filePath, "I am a file");

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => unknown[];
      };

      expect(() =>
        resolvePlugins({
          pluginPaths: [filePath],
          projectRoot: tmpDir,
        }),
      ).toThrow(`Plugin path is not a directory: '${filePath}'.`);
    });

    // --- Расширение 2.3a: plugin.yml не существует → Error ---
    // § plugin-loading.md § Процедура Resolve Plugins § Расширения 2.3a:
    // Error("Plugin manifest not found: '{абсолютный путь}/plugin.yml'.")
    it("выбрасывает ошибку при отсутствии plugin.yml в директории плагина", async () => {
      const emptyPluginDir = path.join(tmpDir, "empty-plugin");
      fs.mkdirSync(emptyPluginDir, { recursive: true });

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => unknown[];
      };

      expect(() =>
        resolvePlugins({
          pluginPaths: [emptyPluginDir],
          projectRoot: tmpDir,
        }),
      ).toThrow(`Plugin manifest not found: '${path.join(emptyPluginDir, "plugin.yml")}'.`);
    });

    // --- Расширение 2.4a: невалидный YAML → Error ---
    // § plugin-loading.md § Процедура Resolve Plugins § Расширения 2.4a:
    // Error("Invalid plugin manifest at '{путь}/plugin.yml': {parseErrorMessage}.")
    it("выбрасывает ошибку при невалидном YAML в plugin.yml", async () => {
      fs.writeFileSync(path.join(pluginDirA, "plugin.yml"), "invalid: [yaml\n  : : :\n");

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => unknown[];
      };

      expect(() =>
        resolvePlugins({
          pluginPaths: [pluginDirA],
          projectRoot: tmpDir,
        }),
      ).toThrow(
        new RegExp(`Invalid plugin manifest at '${pluginDirA.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/plugin\\.yml':`),
      );
    });

    // --- Расширение 2.5a: манифест не прошёл валидацию → Error ---
    // § plugin-loading.md § Процедура Resolve Plugins § Расширения 2.5a:
    // Error("Invalid plugin manifest at '{путь}/plugin.yml': {validationErrorMessage}.")
    it("выбрасывает ошибку при невалидном манифесте (отсутствует обязательное поле)", async () => {
      // Манифест без обязательного поля name
      fs.writeFileSync(
        path.join(pluginDirA, "plugin.yml"),
        "version: 1.0.0\ndescription: Missing name\nauthor:\n  name: Test\n  email: test@test.com\n",
      );

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => unknown[];
      };

      expect(() =>
        resolvePlugins({
          pluginPaths: [pluginDirA],
          projectRoot: tmpDir,
        }),
      ).toThrow(
        new RegExp(`Invalid plugin manifest at '${pluginDirA.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/plugin\\.yml':`),
      );
    });

    // --- Расширение 2.7a: дублирование имён плагинов → Error ---
    // § plugin-loading.md § Процедура Resolve Plugins § Расширения 2.7a:
    // Error("Duplicate plugin name '{name}': declared at '{путь1}' and '{путь2}'.")
    it("выбрасывает ошибку при дублировании имён плагинов", async () => {
      writePluginYaml(pluginDirA, validManifest("same-name"));
      writePluginYaml(pluginDirB, validManifest("same-name"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => unknown[];
      };

      expect(() =>
        resolvePlugins({
          pluginPaths: [pluginDirA, pluginDirB],
          projectRoot: tmpDir,
        }),
      ).toThrow(`Duplicate plugin name 'same-name': declared at '${pluginDirA}' and '${pluginDirB}'.`);
    });

    // --- Стратегия обработки ошибок § Уровень 1 — fail-fast ---
    // § plugin-loading.md § Стратегия обработки ошибок § Уровень 1:
    // Resolve Plugins ДОЛЖНА выбрасывать Error при первой ошибке,
    // без попытки продолжить обработку оставшихся плагинов.
    it("останавливается при первой ошибке (fail-fast), не обрабатывая оставшиеся плагины", async () => {
      const nonexistentPath = path.join(tmpDir, "nonexistent");
      writePluginYaml(pluginDirB, validManifest("plugin-b"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => unknown[];
      };

      // Первый плагин невалиден (не существует), второй валиден.
      // Процедура должна упасть на первом, не доходя до второго.
      expect(() =>
        resolvePlugins({
          pluginPaths: [nonexistentPath, pluginDirB],
          projectRoot: tmpDir,
        }),
      ).toThrow(`Plugin path not found: '${nonexistentPath}'.`);
    });

    // --- Граничное условие: пустой массив pluginPaths ---
    // § plugin-loading.md § Процедура Resolve Plugins § Поведение шаг 1:
    // Инициализировать пустой массив resolved. При пустом входе — пустой результат.
    it("при пустом массиве pluginPaths возвращает пустой массив", async () => {
      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => unknown[];
      };

      const result = resolvePlugins({
        pluginPaths: [],
        projectRoot: tmpDir,
      });

      expect(result).toEqual([]);
    });

    // --- Трансформация: шаг 2.1 — relative path с ../ ---
    // § plugin-loading.md § Процедура Resolve Plugins § Поведение шаг 2.1
    it("корректно разрешает пути с ../", async () => {
      const projectDir = path.join(tmpDir, "project");
      const sharedPlugin = path.join(tmpDir, "shared-plugin");
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(sharedPlugin, { recursive: true });
      writePluginYaml(sharedPlugin, validManifest("shared-plugin"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => { name: string; path: string }[];
      };

      const result = resolvePlugins({
        pluginPaths: ["../shared-plugin"],
        projectRoot: projectDir,
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("shared-plugin");
      expect(result[0].path).toBe(sharedPlugin);
    });

    // --- Тип ResolvedPlugin: структура возвращаемого объекта ---
    // § plugin-loading.md § Тип ResolvedPlugin:
    // name, path (абсолютный), manifest (PluginManifest).
    it("возвращает ResolvedPlugin с name, path (абсолютный) и manifest", async () => {
      writePluginYaml(
        pluginDirA,
        "name: my-plugin\nversion: 1.2.3\ndescription: My plugin\nauthor:\n  name: Author\n  email: author@example.com\n",
      );

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: { pluginPaths: string[]; projectRoot: string }) => {
          name: string;
          path: string;
          manifest: { name: string; version: string; description: string };
        }[];
      };

      const result = resolvePlugins({
        pluginPaths: [pluginDirA],
        projectRoot: tmpDir,
      });

      expect(result[0]).toEqual(
        expect.objectContaining({
          name: "my-plugin",
          path: pluginDirA,
          manifest: expect.objectContaining({
            name: "my-plugin",
            version: "1.2.3",
            description: "My plugin",
          }),
        }),
      );
    });
  });

  // =====================================================================
  // § plugin-loading.md § Формирование массива layers
  // LayerSource формирование для overlay.
  // =====================================================================
  describe("Формирование массива layers", () => {
    // --- Happy path: плагины + локальный проект ---
    // § plugin-loading.md § Формирование массива layers шаги 1-2:
    // Для каждого плагина создать LayerSource с id = plugin.name
    // и overlayDir = <plugin.path>/overlays/<entry.id>/.
    // Создать LayerSource для локального проекта с id = "local"
    // и overlayDir = <projectRoot>/.agloom/overlays/<entry.id>/.
    it("формирует массив layers с записями плагинов и локального проекта в правильном порядке", async () => {
      const { buildLayers } = (await import("../plugin-layers.js")) as {
        buildLayers: (params: {
          plugins: { name: string; path: string }[];
          projectRoot: string;
          entryId: string;
        }) => { id: string; overlayDir: string }[];
      };

      const layers = buildLayers({
        plugins: [
          { name: "plugin-a", path: "/plugins/plugin-a" },
          { name: "plugin-b", path: "/plugins/plugin-b" },
        ],
        projectRoot: "/project",
        entryId: "claude",
      });

      expect(layers).toHaveLength(3);
      // Плагин A — первый (наименьший приоритет)
      expect(layers[0]).toEqual({
        id: "plugin-a",
        overlayDir: path.join("/plugins/plugin-a", "overlays", "claude") + "/",
      });
      // Плагин B — второй
      expect(layers[1]).toEqual({
        id: "plugin-b",
        overlayDir: path.join("/plugins/plugin-b", "overlays", "claude") + "/",
      });
      // Локальный проект — последний (наивысший приоритет)
      expect(layers[2]).toEqual({
        id: "local",
        overlayDir: path.join("/project", ".agloom", "overlays", "claude") + "/",
      });
    });

    // --- Граничное условие: нет плагинов ---
    // § plugin-loading.md § Обратная совместимость:
    // Массив layers содержит единственный LayerSource с id = "local".
    it("без плагинов формирует layers с единственным элементом local", async () => {
      const { buildLayers } = (await import("../plugin-layers.js")) as {
        buildLayers: (params: {
          plugins: { name: string; path: string }[];
          projectRoot: string;
          entryId: string;
        }) => { id: string; overlayDir: string }[];
      };

      const layers = buildLayers({
        plugins: [],
        projectRoot: "/project",
        entryId: "claude",
      });

      expect(layers).toHaveLength(1);
      expect(layers[0]).toEqual({
        id: "local",
        overlayDir: path.join("/project", ".agloom", "overlays", "claude") + "/",
      });
    });
  });

  // =====================================================================
  // § plugin-loading.md § Расширение процедуры «Шаг транспиляции»
  // sourceRoot parameter для транспилеров.
  // =====================================================================
  describe("Расширение процедуры «Шаг транспиляции» — sourceRoot", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-transpile-source-root-"));
      pluginDir = path.join(tmpDir, "plugins", "my-plugin");
      fs.mkdirSync(pluginDir, { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Шаг 1 (изменённый): создание транспилера с sourceRoot ---
    // § plugin-loading.md § Расширение процедуры «Шаг транспиляции»
    // § Изменения в поведении шаг 1:
    // transpilerFactory({ projectRoot: sourceRoot ?? projectRoot, adapters: [adapter] })
    it("при передаче sourceRoot обнаруживает файлы из sourceRoot и записывает в projectRoot", async () => {
      // Создаём AGLOOM.md в директории плагина (не в projectRoot)
      fs.writeFileSync(path.join(pluginDir, "AGLOOM.md"), "Plugin instructions content.");

      const { runTranspileStep } = await import("../transpile-step.js");
      const { createInstructionsTranspiler, ClaudeAdapter } = await import("../../instructions-transpiler/index.js");

      const outcome = runTranspileStep({
        transpilerFactory: createInstructionsTranspiler as unknown as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: new ClaudeAdapter(),
        projectRoot: tmpDir,
        name: "Instructions",
        sourceRoot: pluginDir,
      } as Parameters<typeof runTranspileStep>[0]);

      // Транспилер должен обнаружить файлы в pluginDir (sourceRoot)
      // и записать результат в tmpDir (projectRoot)
      expect(outcome.writtenCount).toBeGreaterThanOrEqual(1);
      expect(outcome.errors).toEqual([]);

      // Файл должен быть записан в projectRoot, не в sourceRoot
      const writtenPath = path.join(tmpDir, "CLAUDE.md");
      expect(fs.existsSync(writtenPath)).toBe(true);
      expect(fs.readFileSync(writtenPath, "utf-8")).toBe("Plugin instructions content.");
    });

    // --- Шаг 3 (изменённый): writeResults с targetRoot = projectRoot ---
    // § plugin-loading.md § Расширение процедуры «Шаг транспиляции»
    // § Изменения в поведении шаг 3:
    // transpiler.writeResults(transpileResults, { targetRoot: projectRoot })
    it("записывает результаты в projectRoot, а не в sourceRoot", async () => {
      fs.writeFileSync(path.join(pluginDir, "AGLOOM.md"), "Plugin content for write test.");

      const { runTranspileStep } = await import("../transpile-step.js");
      const { createInstructionsTranspiler, ClaudeAdapter } = await import("../../instructions-transpiler/index.js");

      runTranspileStep({
        transpilerFactory: createInstructionsTranspiler as unknown as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: new ClaudeAdapter(),
        projectRoot: tmpDir,
        name: "Instructions",
        sourceRoot: pluginDir,
      } as Parameters<typeof runTranspileStep>[0]);

      // Файл НЕ должен быть записан в sourceRoot (pluginDir)
      expect(fs.existsSync(path.join(pluginDir, "CLAUDE.md"))).toBe(false);
      // Файл ДОЛЖЕН быть записан в projectRoot (tmpDir)
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(true);
    });

    // --- Обратная совместимость: без sourceRoot поведение идентично текущему ---
    // § plugin-loading.md § Расширение процедуры «Шаг транспиляции»
    // § Изменения в поведении:
    // Если sourceRoot не передан, targetRoot совпадает с projectRoot
    // и поведение идентично текущему.
    it("без sourceRoot поведение идентично текущему", async () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "Local project instructions.");

      const { runTranspileStep } = await import("../transpile-step.js");
      const { createInstructionsTranspiler, ClaudeAdapter } = await import("../../instructions-transpiler/index.js");

      const outcome = runTranspileStep({
        transpilerFactory: createInstructionsTranspiler as unknown as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: new ClaudeAdapter(),
        projectRoot: tmpDir,
        name: "Instructions",
        // sourceRoot не передан
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(true);
    });
  });

  // =====================================================================
  // § plugin-loading.md § Обратная совместимость
  // =====================================================================
  describe("Обратная совместимость — без плагинов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-compat-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- § plugin-loading.md § Обратная совместимость:
    // При отсутствии поля plugins в config.yml поведение ДОЛЖНО быть
    // идентично текущей реализации.
    it("при отсутствии plugins в конфиге loadConfig возвращает pluginPaths: null", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\n");

      const result = loadConfig(tmpDir);

      // loadConfig должен вернуть структуру с pluginPaths = null
      expect(result).toHaveProperty("pluginPaths");
      expect((result as unknown as { pluginPaths: null }).pluginPaths).toBeNull();
    });
  });

  // =====================================================================
  // § plugin-loading.md § Расширение команды transpile § Новые расширения 3.2a
  // Resolve Plugins ошибка → exit code 1.
  // =====================================================================
  describe("Расширение команды transpile — ошибка Resolve Plugins", () => {
    let tmpDir: string;
    let originalExitCode: number | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-plugin-err-"));
      originalExitCode = process.exitCode;
    });

    afterEach(() => {
      process.exitCode = originalExitCode;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- § plugin-loading.md § Расширение команды transpile § Новые расширения 3.2a:
    // Resolve Plugins вернул ошибку → отобразить сообщение ошибки;
    // процесс завершается с exit code 1.
    it("при ошибке Resolve Plugins отображает сообщение и завершается с exit code 1", async () => {
      // Конфиг с plugins, указывающими на несуществующий путь
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        "adapters:\n  - claude\nplugins:\n  - /nonexistent/plugin/path\n",
      );

      const React = await import("react");
      const { render } = await import("ink-testing-library");
      const { App } = await import("../app.js");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Сообщение ошибки должно содержать информацию о плагине
      expect(output).toMatch(/plugin/i);
      expect(process.exitCode).toBe(1);

      unmount();
    });
  });

  // =====================================================================
  // § plugin-loading.md § Расширение команды transpile § шаги 4.2-4.5
  // Агрегация TranspilerStepOutcome.
  // =====================================================================
  describe("Агрегация TranspilerStepOutcome по типу шага", () => {
    // --- § plugin-loading.md § Расширение команды transpile:
    // Для каждого типа шага (Instructions, Skills, Agents)
    // writtenCount ДОЛЖНО быть суммой writtenCount по всем источникам.
    // errors ДОЛЖНО быть конкатенацией массивов errors по всем источникам.
    it("суммирует writtenCount и конкатенирует errors по всем источникам для каждого типа шага", async () => {
      const { aggregateOutcomes } = (await import("../plugin-aggregate.js")) as {
        aggregateOutcomes: (
          outcomes: {
            name: "Instructions" | "Skills" | "Agents";
            writtenCount: number;
            errors: string[];
          }[][],
        ) => {
          name: "Instructions" | "Skills" | "Agents";
          writtenCount: number;
          errors: string[];
        }[];
      };

      const pluginAOutcomes = [
        { name: "Instructions" as const, writtenCount: 2, errors: [] },
        { name: "Skills" as const, writtenCount: 3, errors: [] },
        {
          name: "Agents" as const,
          writtenCount: 0,
          errors: ["Error in plugin A agents"],
        },
      ];

      const pluginBOutcomes = [
        {
          name: "Instructions" as const,
          writtenCount: 1,
          errors: ["Error in plugin B instructions"],
        },
        { name: "Skills" as const, writtenCount: 2, errors: [] },
        { name: "Agents" as const, writtenCount: 1, errors: [] },
      ];

      const localOutcomes = [
        { name: "Instructions" as const, writtenCount: 1, errors: [] },
        { name: "Skills" as const, writtenCount: 5, errors: [] },
        { name: "Agents" as const, writtenCount: 2, errors: [] },
      ];

      const aggregated = aggregateOutcomes([pluginAOutcomes, pluginBOutcomes, localOutcomes]);

      expect(aggregated).toHaveLength(3);

      // Instructions: 2 + 1 + 1 = 4, errors from plugin B
      expect(aggregated[0].name).toBe("Instructions");
      expect(aggregated[0].writtenCount).toBe(4);
      expect(aggregated[0].errors).toEqual(["Error in plugin B instructions"]);

      // Skills: 3 + 2 + 5 = 10, no errors
      expect(aggregated[1].name).toBe("Skills");
      expect(aggregated[1].writtenCount).toBe(10);
      expect(aggregated[1].errors).toEqual([]);

      // Agents: 0 + 1 + 2 = 3, errors from plugin A
      expect(aggregated[2].name).toBe("Agents");
      expect(aggregated[2].writtenCount).toBe(3);
      expect(aggregated[2].errors).toEqual(["Error in plugin A agents"]);
    });
  });

  // =====================================================================
  // § plugin-loading.md § Стратегия обработки ошибок § Уровень 2 — tolerant
  // Ошибки при применении валидного плагина НЕ останавливают процесс.
  // =====================================================================
  describe("Стратегия обработки ошибок — Уровень 2 (tolerant)", () => {
    let tmpDir: string;
    let originalExitCode: number | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-tolerant-"));
      originalExitCode = process.exitCode;
    });

    afterEach(() => {
      process.exitCode = originalExitCode;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- § plugin-loading.md § Стратегия обработки ошибок § Уровень 2:
    // Ошибки на этапе применения валидного плагина (транспиляция файлов
    // и overlay) НЕ ДОЛЖНЫ останавливать процесс. Каждая ошибка отдельного
    // файла ДОЛЖНА быть добавлена в массив errors соответствующего
    // TranspilerStepOutcome, после чего обработка оставшихся файлов
    // ДОЛЖНА продолжиться.
    //
    // Оптимизация: рендерим TranspileView напрямую с минимальным адаптером
    // (только instructions + agents), чтобы избежать 25+ runTranspileStep
    // вызовов через полный App → loadConfig → resolvePlugins пайплайн.
    it("при ошибке транспиляции файла плагина продолжает обработку остальных файлов и собирает ошибку в errors", async () => {
      const pluginA = path.join(tmpDir, "plugin-a");
      const pluginB = path.join(tmpDir, "plugin-b");
      fs.mkdirSync(pluginA, { recursive: true });
      fs.mkdirSync(pluginB, { recursive: true });

      // Плагин A: создаём agents/ как файл вместо каталога — agents transpiler
      // выбросит исключение при discover (расширение 2a шага транспиляции).
      fs.writeFileSync(path.join(pluginA, "agents"), "not a directory");

      // Плагин B: валидный agents
      const pluginBAgents = path.join(pluginB, "agents");
      fs.mkdirSync(pluginBAgents, { recursive: true });
      fs.writeFileSync(path.join(pluginBAgents, "helper.md"), "---\nname: helper\n---\nHelper agent from plugin B.");

      // Локальный проект: валидный AGLOOM.md
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "Local project instructions.");

      const React = await import("react");
      const { render } = await import("ink-testing-library");
      const { TranspileView } = await import("../app.js");
      const { adapterRegistry } = await import("../adapter-registry.js");

      const claudeEntry = adapterRegistry.find((e) => e.id === "claude")!;
      // Минимальный адаптер: только instructions + agents (всё остальное null)
      const minimalEntry = {
        ...claudeEntry,
        skills: null,
        commands: null,
        mcp: null,
        permissions: null,
        paths: { agents: claudeEntry.paths.agents },
      };

      const plugins = [
        { name: "plugin-a", path: pluginA, manifest: { name: "plugin-a" }, resolvedSha: null, gitUrl: null, gitRef: null, values: null, resolvedValues: {} },
        { name: "plugin-b", path: pluginB, manifest: { name: "plugin-b" }, resolvedSha: null, gitUrl: null, gitRef: null, values: null, resolvedValues: {} },
      ];

      const { lastFrame, unmount } = render(
        React.createElement(TranspileView as React.FC<Record<string, unknown>>, {
          entries: [minimalEntry],
          projectRoot: tmpDir,
          plugins,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toMatch(/Failed\.|Done\./);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Ошибка уровня 2 не останавливает процесс: транспиляция завершается
      expect(output).toMatch(/files written\./);

      // Файлы из плагина B и локального проекта обработаны несмотря
      // на ошибку в плагине A — writtenCount > 0
      const match = output.match(/(\d+)\s+files written\./);
      expect(match).not.toBeNull();
      const totalWritten = parseInt(match![1], 10);
      expect(totalWritten).toBeGreaterThan(0);

      // Ошибка плагина A собрана в errors — отображается ✗ в TUI
      expect(output).toContain("✗");

      unmount();
    });

    // --- § plugin-loading.md § Стратегия обработки ошибок § Уровень 2:
    // Ошибки overlay-файлов плагина собираются в errors, обработка продолжается.
    // § layer-model.md § Новые расширения 2.6a, 2.7a:
    // Ошибка интерполяции/парсинга файла → добавить в errors, продолжить.
    it("при ошибке overlay-файла плагина собирает ошибку в errors и продолжает с остальными слоями", async () => {
      const pluginDir = path.join(tmpDir, "broken-overlay-plugin");
      fs.mkdirSync(pluginDir, { recursive: true });

      // Overlay плагина: файл с невалидной интерполяцией
      const pluginOverlay = path.join(pluginDir, "overlays", "claude");
      fs.mkdirSync(pluginOverlay, { recursive: true });
      fs.writeFileSync(path.join(pluginOverlay, "bad-interp.md"), "Value: ${agloom:NONEXISTENT_VARIABLE}");

      // Overlay локального проекта: валидный файл
      const localOverlay = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(localOverlay, { recursive: true });
      fs.writeFileSync(path.join(localOverlay, "good-file.txt"), "Good local overlay content.");

      // Локальный проект
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "Local instructions.");

      const React = await import("react");
      const { render } = await import("ink-testing-library");
      const { TranspileView } = await import("../app.js");
      const { adapterRegistry } = await import("../adapter-registry.js");

      const claudeEntry = adapterRegistry.find((e) => e.id === "claude")!;
      const minimalEntry = {
        ...claudeEntry,
        skills: null,
        commands: null,
        mcp: null,
        permissions: null,
        paths: { agents: claudeEntry.paths.agents },
      };

      const plugins = [
        { name: "broken-overlay-plugin", path: pluginDir, manifest: { name: "broken-overlay-plugin" }, resolvedSha: null, gitUrl: null, gitRef: null, values: null, resolvedValues: {} },
      ];

      const { lastFrame, unmount } = render(
        React.createElement(TranspileView as React.FC<Record<string, unknown>>, {
          entries: [minimalEntry],
          projectRoot: tmpDir,
          plugins,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toMatch(/Failed\.|Done\./);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Процесс не остановился — транспиляция завершена
      expect(output).toMatch(/files written\./);

      // Локальный overlay-файл обработан, несмотря на ошибку в плагине
      const match = output.match(/(\d+)\s+files written\./);
      expect(match).not.toBeNull();
      const totalWritten = parseInt(match![1], 10);
      expect(totalWritten).toBeGreaterThan(0);

      // Ошибка плагина собрана в errors — отображается в выводе.
      // Процесс завершается с Failed. (не Done.) из-за ошибки уровня 2.
      expect(output).toContain("Failed.");
      expect(output).toContain("✗");

      unmount();
    });
  });
});
