// init-files-create-config.spec.ts
// Спецификация: docs/specs/init-command.md § Создание конфигурационного файла

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import yaml from "js-yaml";
import { createConfigFile } from "../init-files.js";

describe("createConfigFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-init-cfg-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- Happy path: один адаптер ---
  // § init-command.md § Создание конфигурационного файла:
  // "При одном --adapter: adapters: [<id>]".
  it('при adapterIds=["claude"] создаёт config.yml с adapters: [claude]', () => {
    createConfigFile(tmpDir, ["claude"]);

    const configPath = path.join(tmpDir, ".agloom", "config.yml");
    expect(fs.existsSync(configPath)).toBe(true);

    const parsed = yaml.load(fs.readFileSync(configPath, "utf-8")) as { adapters: string[] };
    expect(parsed.adapters).toEqual(["claude"]);
  });

  // --- Happy path: несколько адаптеров ---
  // § init-command.md § Создание конфигурационного файла:
  // "--adapter claude --adapter opencode → adapters: [claude, opencode]".
  it('при adapterIds=["claude", "opencode"] создаёт config.yml с adapters: [claude, opencode]', () => {
    createConfigFile(tmpDir, ["claude", "opencode"]);

    const configPath = path.join(tmpDir, ".agloom", "config.yml");
    const parsed = yaml.load(fs.readFileSync(configPath, "utf-8")) as { adapters: string[] };
    expect(parsed.adapters).toEqual(["claude", "opencode"]);
  });

  // --- Сохранение порядка ---
  // § init-command.md § Создание конфигурационного файла:
  // "с сохранением порядка первого появления каждого id".
  it('при adapterIds=["opencode", "claude"] сохраняет порядок', () => {
    createConfigFile(tmpDir, ["opencode", "claude"]);

    const configPath = path.join(tmpDir, ".agloom", "config.yml");
    const parsed = yaml.load(fs.readFileSync(configPath, "utf-8")) as { adapters: string[] };
    expect(parsed.adapters).toEqual(["opencode", "claude"]);
  });

  // --- Файл содержит onboarding-комментарии ---
  // § init-command.md § Создание конфигурационного файла:
  // "Файл ДОЛЖЕН содержать комментарии для onboarding".
  it("файл содержит onboarding-комментарии", () => {
    createConfigFile(tmpDir, ["claude"]);

    const content = fs.readFileSync(path.join(tmpDir, ".agloom", "config.yml"), "utf-8");
    expect(content).toContain("# Agloom configuration");
    expect(content).toContain("# List of adapters to use by default");
    expect(content).toContain("# Run 'agloom adapters --all'");
  });

  // --- Директория .agloom создаётся при отсутствии ---
  it("создаёт директорию .agloom если её нет", () => {
    createConfigFile(tmpDir, ["claude"]);

    expect(fs.existsSync(path.join(tmpDir, ".agloom"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".agloom", "config.yml"))).toBe(true);
  });
});
