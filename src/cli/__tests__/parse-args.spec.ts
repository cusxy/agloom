// parse-args.spec.ts
// Спецификация: docs/specs/cli.md § Команда transpile § Поведение шаг 1
// Спецификация: docs/specs/cli.md § Команда transpile § Аргументы (--adapter повторяемый)
// Спецификация: docs/specs/clean-command.md § Команда clean § Поведение шаг 1
// Спецификация: docs/specs/init-command.md § Команда init § Поведение шаг 1

import { describe, it, expect } from "vitest";
import { parseArgs } from "../app.js";

describe("CLI parseArgs", () => {
  // =====================================================================
  // § cli.md § Команда transpile § Поведение шаг 1:
  // "значения всех вхождений --adapter накопить в массив adapterIds
  // в порядке появления".
  // =====================================================================
  describe("accumulating --adapter values into adapterIds", () => {
    // --- Одна команда без --adapter → adapterIds пуст ---
    it('при ["transpile"] возвращает adapterIds = []', () => {
      const parsed = parseArgs(["transpile"]);
      expect(parsed.command).toBe("transpile");
      expect(parsed.adapterIds).toEqual([]);
    });

    // --- Одиночный --adapter ---
    // § cli.md § Команда transpile § Аргументы
    it('при ["transpile", "--adapter", "claude"] возвращает adapterIds = ["claude"]', () => {
      const parsed = parseArgs(["transpile", "--adapter", "claude"]);
      expect(parsed.command).toBe("transpile");
      expect(parsed.adapterIds).toEqual(["claude"]);
    });

    // --- Несколько --adapter: аккумуляция в массив ---
    // § cli.md § Команда transpile § Аргументы: --adapter МОЖЕТ быть
    // указан несколько раз.
    it('при ["transpile", "--adapter", "claude", "--adapter", "opencode"] возвращает ["claude", "opencode"]', () => {
      const parsed = parseArgs(["transpile", "--adapter", "claude", "--adapter", "opencode"]);
      expect(parsed.adapterIds).toEqual(["claude", "opencode"]);
    });

    // --- Порядок аккумуляции ---
    // § cli.md § Команда transpile § Поведение шаг 1:
    // "в порядке появления".
    it("сохраняет порядок появления --adapter на командной строке", () => {
      const parsed = parseArgs(["transpile", "--adapter", "opencode", "--adapter", "claude"]);
      expect(parsed.adapterIds).toEqual(["opencode", "claude"]);
    });

    // --- Повторы НЕ дедуплицируются на уровне парсера ---
    // § config.md § Процедура Resolve Adapters from CLI Args § Поведение шаг 2:
    // дедупликация выполняется на уровне resolveAdaptersFromCLIArgs,
    // не парсера. Парсер должен сохранить все значения.
    it("не дедуплицирует повторы на уровне парсера", () => {
      const parsed = parseArgs(["transpile", "--adapter", "claude", "--adapter", "claude"]);
      expect(parsed.adapterIds).toEqual(["claude", "claude"]);
    });

    // --- Для команды clean ---
    // § clean-command.md § Команда clean § Поведение шаг 1
    it('для clean: ["clean", "--adapter", "claude", "--adapter", "opencode"] → ["claude", "opencode"]', () => {
      const parsed = parseArgs(["clean", "--adapter", "claude", "--adapter", "opencode"]);
      expect(parsed.command).toBe("clean");
      expect(parsed.adapterIds).toEqual(["claude", "opencode"]);
    });

    // --- Для команды init ---
    // § init-command.md § Команда init § Поведение шаг 1
    it('для init: ["init", "--adapter", "claude", "--adapter", "opencode"] → ["claude", "opencode"]', () => {
      const parsed = parseArgs(["init", "--adapter", "claude", "--adapter", "opencode"]);
      expect(parsed.command).toBe("init");
      expect(parsed.adapterIds).toEqual(["claude", "opencode"]);
    });

    // --- clean без --adapter ---
    it('при ["clean"] возвращает adapterIds = []', () => {
      const parsed = parseArgs(["clean"]);
      expect(parsed.command).toBe("clean");
      expect(parsed.adapterIds).toEqual([]);
    });

    // --- init без --adapter ---
    it('при ["init"] возвращает adapterIds = []', () => {
      const parsed = parseArgs(["init"]);
      expect(parsed.command).toBe("init");
      expect(parsed.adapterIds).toEqual([]);
    });

    // --- Совместно с другими флагами ---
    it("не ломает парсинг других флагов (--all, --verbose, --clean)", () => {
      const parsed = parseArgs(["transpile", "--adapter", "claude", "--verbose", "--clean"]);
      expect(parsed.adapterIds).toEqual(["claude"]);
      expect(parsed.verbose).toBe(true);
      expect(parsed.clean).toBe(true);
    });
  });
});
