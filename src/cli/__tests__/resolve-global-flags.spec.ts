// resolve-global-flags.spec.ts
// Spec: docs/specs/cli-global-flags.md § Процедура Resolve Global Flags
// Spec: docs/specs/cli-global-flags.md § Правила каскада
// Spec: docs/specs/cli-global-flags.md § Правила существования путей
// Spec: docs/specs/cli-global-flags.md § Тип ConfigSource / ResolvedPaths
// Spec: docs/specs/config.md § Процедура Read Config Source
//
// Red-phase TDD tests for the new front-end pipeline of global CLI flags.
// The target modules (src/cli/resolve-global-flags.ts, src/cli/read-config-source.ts)
// do not yet exist; these tests are expected to fail until the Implement phase.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Readable } from "node:stream";

// NOTE: these imports point to modules that must be created by impl phase.
// Before implementation they will fail to resolve — this is the red phase.
import { resolveGlobalFlags } from "../resolve-global-flags.js";
import { readConfigSource } from "../read-config-source.js";
import { loadConfig } from "../config.js";

function stdinFrom(content: string): Readable {
  return Readable.from([content]);
}

function emptyStdin(): Readable {
  return Readable.from([]);
}

describe("Resolve Global Flags", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-global-flags-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // =====================================================================
  // Group 1 — Cascading defaults (baseline behaviour)
  // § Правила каскада, § Примеры таблицы каскада
  // =====================================================================
  describe("cascading defaults", () => {
    // Сценарий 1: нет флагов → writeRoot=cwd, resourcesRoot=cwd/.agloom, config=cwd/.agloom/config.yml
    it("без флагов использует cwd для всех трёх путей (regression)", () => {
      // cwd directory is the tmpDir to avoid touching the real project
      const paths = resolveGlobalFlags({
        argv: ["transpile"],
        cwd: tmpDir,
        stdin: emptyStdin(),
      });

      expect(paths.writeRoot).toBe(tmpDir);
      expect(paths.resourcesRoot).toBe(path.join(tmpDir, ".agloom"));
      expect(paths.configSource.kind).toBe("file");
      expect(paths.configSource.path).toBe(path.join(tmpDir, ".agloom", "config.yml"));
      expect(paths.explicit).toEqual({
        projectDir: false,
        agloomDir: false,
        config: false,
      });
    });

    // Сценарий 2: --project-dir /x/ каскадирует в нижние дефолты
    it("--project-dir каскадирует дефолты для --agloom-dir и --config", () => {
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-proj-"));
      try {
        const paths = resolveGlobalFlags({
          argv: ["transpile", "--project-dir", projectDir],
          cwd: tmpDir,
          stdin: emptyStdin(),
        });

        expect(paths.writeRoot).toBe(projectDir);
        expect(paths.resourcesRoot).toBe(path.join(projectDir, ".agloom"));
        expect(paths.configSource.kind).toBe("file");
        expect(paths.configSource.path).toBe(path.join(projectDir, ".agloom", "config.yml"));
        expect(paths.explicit.projectDir).toBe(true);
        expect(paths.explicit.agloomDir).toBe(false);
        expect(paths.explicit.config).toBe(false);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    // Сценарий 3: --agloom-dir каскадирует вниз, не трогает project-dir
    it("--agloom-dir каскадирует в --config, но не трогает --project-dir", () => {
      const agloomDir = path.join(tmpDir, "other", ".agloom");
      fs.mkdirSync(agloomDir, { recursive: true });

      const paths = resolveGlobalFlags({
        argv: ["transpile", "--agloom-dir", agloomDir],
        cwd: tmpDir,
        stdin: emptyStdin(),
      });

      expect(paths.writeRoot).toBe(tmpDir);
      expect(paths.resourcesRoot).toBe(agloomDir);
      expect(paths.configSource.kind).toBe("file");
      expect(paths.configSource.path).toBe(path.join(agloomDir, "config.yml"));
      expect(paths.explicit.agloomDir).toBe(true);
      expect(paths.explicit.projectDir).toBe(false);
    });

    // Сценарий 4: --config без других флагов — верхние не затронуты
    it("--config не трогает дефолты --project-dir и --agloom-dir", () => {
      const cfgFile = path.join(tmpDir, "try.yml");
      fs.writeFileSync(cfgFile, "adapters: [claude]\n");

      const paths = resolveGlobalFlags({
        argv: ["transpile", "--config", cfgFile],
        cwd: tmpDir,
        stdin: emptyStdin(),
      });

      expect(paths.writeRoot).toBe(tmpDir);
      expect(paths.resourcesRoot).toBe(path.join(tmpDir, ".agloom"));
      expect(paths.configSource.kind).toBe("file");
      expect(paths.configSource.path).toBe(cfgFile);
      expect(paths.configSource.baseDir).toBe(path.dirname(cfgFile));
    });

    // Сценарий 5: --project-dir + --config → config не перекрывается каскадом
    it("явный --config переопределяет каскадированный дефолт от --project-dir", () => {
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-proj-"));
      const cfgFile = path.join(tmpDir, "try.yml");
      fs.writeFileSync(cfgFile, "adapters: [claude]\n");
      try {
        const paths = resolveGlobalFlags({
          argv: ["transpile", "--project-dir", projectDir, "--config", cfgFile],
          cwd: tmpDir,
          stdin: emptyStdin(),
        });

        expect(paths.writeRoot).toBe(projectDir);
        expect(paths.resourcesRoot).toBe(path.join(projectDir, ".agloom"));
        expect(paths.configSource.kind).toBe("file");
        expect(paths.configSource.path).toBe(cfgFile);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    // Сценарий 6: все три флага явно → три независимые базы
    it("все три флага явно — три независимые базы, каскад не применяется", () => {
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-c-"));
      const agloomDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-b-"));
      const cfgFile = path.join(tmpDir, "a-try.yml");
      fs.writeFileSync(cfgFile, "adapters: [claude]\n");
      try {
        const paths = resolveGlobalFlags({
          argv: ["transpile", "--config", cfgFile, "--agloom-dir", agloomDir, "--project-dir", projectDir],
          cwd: tmpDir,
          stdin: emptyStdin(),
        });

        expect(paths.writeRoot).toBe(projectDir);
        expect(paths.resourcesRoot).toBe(agloomDir);
        expect(paths.configSource.kind).toBe("file");
        expect(paths.configSource.path).toBe(cfgFile);
        expect(paths.explicit).toEqual({
          projectDir: true,
          agloomDir: true,
          config: true,
        });
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
        fs.rmSync(agloomDir, { recursive: true, force: true });
      }
    });

    // Относительные пути разрешаются относительно cwd
    it("относительные пути флагов резолвятся относительно cwd процесса", () => {
      fs.mkdirSync(path.join(tmpDir, "sub"));
      const paths = resolveGlobalFlags({
        argv: ["transpile", "--project-dir", "sub"],
        cwd: tmpDir,
        stdin: emptyStdin(),
      });

      expect(paths.writeRoot).toBe(path.join(tmpDir, "sub"));
    });
  });

  // =====================================================================
  // Group 2 — Path existence rules
  // § Правила существования путей, § Процедура Resolve Global Flags
  //   расширения 5a/6a/7a
  // =====================================================================
  describe("path existence validation", () => {
    it("явный --project-dir на несуществующий путь бросает ошибку Directory does not exist", () => {
      const missing = path.join(tmpDir, "nonexistent");
      expect(() =>
        resolveGlobalFlags({
          argv: ["transpile", "--project-dir", missing],
          cwd: tmpDir,
          stdin: emptyStdin(),
        }),
      ).toThrow(/Directory does not exist/);
    });

    it("явный --project-dir на файл (не директория) бросает ошибку Not a directory", () => {
      const file = path.join(tmpDir, "file.txt");
      fs.writeFileSync(file, "hi");
      expect(() =>
        resolveGlobalFlags({
          argv: ["transpile", "--project-dir", file],
          cwd: tmpDir,
          stdin: emptyStdin(),
        }),
      ).toThrow(/Not a directory/);
    });

    it("явный --agloom-dir на несуществующий путь бросает ошибку", () => {
      const missing = path.join(tmpDir, "no-agloom", ".agloom");
      expect(() =>
        resolveGlobalFlags({
          argv: ["transpile", "--agloom-dir", missing],
          cwd: tmpDir,
          stdin: emptyStdin(),
        }),
      ).toThrow(/Directory does not exist/);
    });

    it("явный --config на несуществующий файл бросает ошибку File does not exist", () => {
      const missing = path.join(tmpDir, "nope.yml");
      expect(() =>
        resolveGlobalFlags({
          argv: ["transpile", "--config", missing],
          cwd: tmpDir,
          stdin: emptyStdin(),
        }),
      ).toThrow(/File does not exist/);
    });

    it("явный --config указывает на директорию → Not a file", () => {
      const dir = path.join(tmpDir, "sub");
      fs.mkdirSync(dir);
      expect(() =>
        resolveGlobalFlags({
          argv: ["transpile", "--config", dir],
          cwd: tmpDir,
          stdin: emptyStdin(),
        }),
      ).toThrow(/Not a file/);
    });

    it("дефолтный --agloom-dir (отсутствует на диске) — не ошибка, empty-state", () => {
      // tmpDir существует, но tmpDir/.agloom/ не существует
      const paths = resolveGlobalFlags({
        argv: ["transpile"],
        cwd: tmpDir,
        stdin: emptyStdin(),
      });

      expect(paths.resourcesRoot).toBe(path.join(tmpDir, ".agloom"));
      expect(paths.configSource.kind).toBe("file");
      // Не бросает, дефолтный путь может отсутствовать
    });

    it("--config - валиден (stdin), existence check не применяется", () => {
      const paths = resolveGlobalFlags({
        argv: ["transpile", "--config", "-"],
        cwd: tmpDir,
        stdin: emptyStdin(),
      });

      expect(paths.configSource.kind).toBe("stdin");
      expect(paths.configSource.baseDir).toBe(tmpDir);
    });
  });

  // =====================================================================
  // Расширения 1a/1b — некорректный синтаксис флагов
  // =====================================================================
  describe("flag syntax errors", () => {
    it("--project-dir без значения → Missing value", () => {
      expect(() =>
        resolveGlobalFlags({
          argv: ["transpile", "--project-dir"],
          cwd: tmpDir,
          stdin: emptyStdin(),
        }),
      ).toThrow(/Missing value/);
    });

    it("--config указан дважды → specified more than once", () => {
      const a = path.join(tmpDir, "a.yml");
      const b = path.join(tmpDir, "b.yml");
      fs.writeFileSync(a, "");
      fs.writeFileSync(b, "");
      expect(() =>
        resolveGlobalFlags({
          argv: ["transpile", "--config", a, "--config", b],
          cwd: tmpDir,
          stdin: emptyStdin(),
        }),
      ).toThrow(/specified more than once/);
    });
  });

  // =====================================================================
  // § Тип ConfigSource — baseDir вычисления
  // =====================================================================
  describe("configSource.baseDir", () => {
    it("для kind=file baseDir = dirname(path)", () => {
      const cfgFile = path.join(tmpDir, "nested", "try.yml");
      fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
      fs.writeFileSync(cfgFile, "");

      const paths = resolveGlobalFlags({
        argv: ["transpile", "--config", cfgFile],
        cwd: tmpDir,
        stdin: emptyStdin(),
      });

      expect(paths.configSource.baseDir).toBe(path.join(tmpDir, "nested"));
    });

    it("для kind=stdin baseDir = cwd, НЕ writeRoot (асимметрия)", () => {
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-x-"));
      try {
        const paths = resolveGlobalFlags({
          argv: ["transpile", "--project-dir", projectDir, "--config", "-"],
          cwd: tmpDir,
          stdin: emptyStdin(),
        });

        expect(paths.configSource.kind).toBe("stdin");
        // Ключевая асимметрия: baseDir = cwd, не writeRoot
        expect(paths.configSource.baseDir).toBe(tmpDir);
        expect(paths.configSource.baseDir).not.toBe(projectDir);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it("дефолтный configSource.baseDir = resourcesRoot", () => {
      const paths = resolveGlobalFlags({
        argv: ["transpile"],
        cwd: tmpDir,
        stdin: emptyStdin(),
      });

      expect(paths.configSource.kind).toBe("file");
      // baseDir = dirname(default config path) = resourcesRoot
      expect(paths.configSource.baseDir).toBe(paths.resourcesRoot);
    });
  });
});

describe("Read Config Source", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-read-cfg-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // § config.md § Read Config Source § Поведение шаги 1-4
  it("kind=file с валидным YAML возвращает { kind: 'parsed', value }", async () => {
    const cfgFile = path.join(tmpDir, "config.yml");
    fs.writeFileSync(cfgFile, "adapters:\n  - claude\n");

    const result = await readConfigSource({
      configSource: {
        kind: "file",
        path: cfgFile,
        baseDir: tmpDir,
      },
      stdin: emptyStdin(),
    });

    expect(result.kind).toBe("parsed");
    if (result.kind === "parsed") {
      expect(result.value).toEqual({ adapters: ["claude"] });
    }
  });

  // § Read Config Source § Расширение 1a — missing file
  it("kind=file и файл не существует → { kind: 'missing' }", async () => {
    const result = await readConfigSource({
      configSource: {
        kind: "file",
        path: path.join(tmpDir, "nope.yml"),
        baseDir: tmpDir,
      },
      stdin: emptyStdin(),
    });

    expect(result.kind).toBe("missing");
  });

  // § Read Config Source § Расширение 2a — invalid YAML
  it("kind=file с невалидным YAML → Error Invalid config file", async () => {
    const cfgFile = path.join(tmpDir, "bad.yml");
    fs.writeFileSync(cfgFile, "not valid: yaml: : :\n  - [");

    await expect(
      readConfigSource({
        configSource: { kind: "file", path: cfgFile, baseDir: tmpDir },
        stdin: emptyStdin(),
      }),
    ).rejects.toThrow(/Invalid config file/);
  });

  // § Read Config Source § Шаг 3 — пустой файл нормализуется до {}
  it("пустой файл нормализуется до { kind: 'parsed', value: {} }", async () => {
    const cfgFile = path.join(tmpDir, "empty.yml");
    fs.writeFileSync(cfgFile, "");

    const result = await readConfigSource({
      configSource: { kind: "file", path: cfgFile, baseDir: tmpDir },
      stdin: emptyStdin(),
    });

    expect(result.kind).toBe("parsed");
    if (result.kind === "parsed") {
      expect(result.value).toEqual({});
    }
  });

  // § Read Config Source § Шаг 4a — скаляр/массив на top-level
  it("YAML-массив на верхнем уровне → ошибка 'must be an array of strings'", async () => {
    const cfgFile = path.join(tmpDir, "list.yml");
    fs.writeFileSync(cfgFile, "- a\n- b\n");

    await expect(
      readConfigSource({
        configSource: { kind: "file", path: cfgFile, baseDir: tmpDir },
        stdin: emptyStdin(),
      }),
    ).rejects.toThrow(/array of strings/);
  });

  // § Read Config Source § Поведение шаг 1 для kind=stdin
  it("kind=stdin с валидным YAML читает из stdin", async () => {
    const result = await readConfigSource({
      configSource: { kind: "stdin", baseDir: tmpDir },
      stdin: stdinFrom("adapters:\n  - opencode\n"),
    });

    expect(result.kind).toBe("parsed");
    if (result.kind === "parsed") {
      expect(result.value).toEqual({ adapters: ["opencode"] });
    }
  });

  // § Read Config Source § Шаг 3 + § cli-global-flags.md § Exit codes
  it("пустой stdin нормализуется до { kind: 'parsed', value: {} } (не ошибка)", async () => {
    const result = await readConfigSource({
      configSource: { kind: "stdin", baseDir: tmpDir },
      stdin: emptyStdin(),
    });

    expect(result.kind).toBe("parsed");
    if (result.kind === "parsed") {
      expect(result.value).toEqual({});
    }
  });
});

// =====================================================================
// § config.md § Процедура Load Config § Вход:
//   «rawConfig (object, обязательно) — результат процедуры
//    Read Config Source: либо { kind: "missing" }, либо
//    { kind: "parsed", value: object }.»
// § config.md § Load Config НЕ выполняет собственный I/O.
//
// Group 7 (C7): Load Config must accept rawConfig instead of projectRoot,
// proving the single-I/O contract: Read Config Source runs once, Load Config
// is pure validation.
// =====================================================================
describe("Load Config accepts rawConfig (no I/O)", () => {
  it("loadConfig({ kind: 'missing' }) → adapterIds/pluginEntries/configVariables all null", () => {
    // Contract: loadConfig must accept rawConfig as its input (not projectRoot).
    // The signature change is the essence of C7 — Read Config Source is the
    // single I/O point.
    const result = (
      loadConfig as unknown as (r: unknown) => {
        adapterIds: string[] | null;
        pluginEntries: unknown;
        configVariables: unknown;
      }
    )({ kind: "missing" });

    expect(result.adapterIds).toBeNull();
    expect(result.pluginEntries).toBeNull();
    expect(result.configVariables).toBeNull();
  });

  it("loadConfig({ kind: 'parsed', value: { adapters: ['claude'] } }) → adapterIds=['claude']", () => {
    const result = (
      loadConfig as unknown as (r: unknown) => {
        adapterIds: string[] | null;
      }
    )({
      kind: "parsed",
      value: { adapters: ["claude"] },
    });

    expect(result.adapterIds).toEqual(["claude"]);
  });

  it("loadConfig бросает Error при невалидном adapters поле из rawConfig", () => {
    expect(() =>
      (loadConfig as unknown as (r: unknown) => unknown)({
        kind: "parsed",
        value: { adapters: 123 },
      }),
    ).toThrow(/adapters.*array of strings/);
  });
});
