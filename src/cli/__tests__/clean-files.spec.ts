// clean-files.spec.ts
// Спецификация: docs/specs/clean-command.md § Процедура Clean Files

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { cleanFiles } from "../clean-files.js";
import type { AdapterRegistryEntry } from "../types.js";

/**
 * Рекурсивно восстанавливает права записи для корректной очистки tmpDir в afterEach.
 */
function restorePermissions(dir: string): void {
  try {
    if (!fs.existsSync(dir)) return;
    const stat = fs.statSync(dir);
    if (stat.isDirectory()) {
      try {
        fs.chmodSync(dir, 0o755);
      } catch {
        /* ignore */
      }
      for (const entry of fs.readdirSync(dir)) {
        restorePermissions(path.join(dir, entry));
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Создаёт минимальный mock AdapterRegistryEntry с заданными targetRoot и targetFiles.
 * Остальные поля заполнены заглушками — процедура Clean Files использует только
 * targetRoot и targetFiles.
 */
function createEntry(
  overrides?: Partial<Pick<AdapterRegistryEntry, "targetRoot" | "targetFiles">>,
): AdapterRegistryEntry {
  return {
    id: "test",
    description: "Test Adapter",
    instructions: {} as AdapterRegistryEntry["instructions"],
    skills: {} as AdapterRegistryEntry["skills"],
    agents: {} as AdapterRegistryEntry["agents"],
    targetRoot: ".test-agent",
    targetFiles: ["test-output.txt"],
    ...overrides,
  } as AdapterRegistryEntry;
}

describe("CLI", () => {
  describe("Процедура Clean Files", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sds-clean-files-"));
    });

    afterEach(() => {
      restorePermissions(tmpDir);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–3 ---
    // Шаг 1: Рекурсивно удалить директорию <projectRoot>/<entry.targetRoot>/
    //         со всем её содержимым. Сама директория targetRoot также удаляется.
    // Шаг 2: Удалить каждый файл из entry.targetFiles (пути относительно projectRoot).
    // Шаг 3: Сформировать CleanOutcome с removedCount и errors.
    it("удаляет targetRoot рекурсивно и файлы из targetFiles, возвращает CleanOutcome с корректным removedCount и пустыми errors", () => {
      const entry = createEntry();

      // targetRoot с двумя файлами
      const agentDir = path.join(tmpDir, ".test-agent");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "config.json"), "{}");
      fs.writeFileSync(path.join(agentDir, "rules.md"), "rules");

      // targetFile
      fs.writeFileSync(path.join(tmpDir, "test-output.txt"), "output");

      const result = cleanFiles(entry, tmpDir);

      // Директория targetRoot удалена
      expect(fs.existsSync(agentDir)).toBe(false);
      // Файл из targetFiles удалён
      expect(fs.existsSync(path.join(tmpDir, "test-output.txt"))).toBe(false);
      // removedCount = 2 (файлы в targetRoot) + 1 (targetFile) = 3
      expect(result.removedCount).toBe(3);
      expect(result.errors).toEqual([]);
    });

    // --- Расширение 1a: targetRoot не существует ---
    // removedCount: 0, не является ошибкой.
    it("при несуществующем targetRoot возвращает removedCount 0 для шага 1, errors пуст", () => {
      const entry = createEntry({ targetFiles: [] });
      // targetRoot не создаём — директория .test-agent/ отсутствует

      const result = cleanFiles(entry, tmpDir);

      expect(result.removedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    // --- Расширение 1b: EACCES при удалении targetRoot ---
    // Добавить сообщение в errors, продолжить с оставшимися файлами.
    it("при EACCES на targetRoot добавляет сообщение в errors и продолжает с targetFiles", () => {
      const entry = createEntry();

      // targetRoot с файлом внутри
      const agentDir = path.join(tmpDir, ".test-agent");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "protected.txt"), "data");
      // Делаем директорию read-only — удаление файлов внутри вызовет EACCES
      fs.chmodSync(agentDir, 0o555);

      // targetFile вне targetRoot — должен быть удалён несмотря на ошибку шага 1
      fs.writeFileSync(path.join(tmpDir, "test-output.txt"), "output");

      const result = cleanFiles(entry, tmpDir);

      // errors содержит хотя бы одно сообщение об ошибке
      expect(result.errors.length).toBeGreaterThan(0);
      // targetFile удалён — процедура продолжила с шагом 2
      expect(fs.existsSync(path.join(tmpDir, "test-output.txt"))).toBe(false);
    });

    // --- Расширение 2a: файл из targetFiles не существует ---
    // Пропустить файл, не является ошибкой.
    it("при несуществующем файле из targetFiles пропускает его без ошибки", () => {
      const entry = createEntry({
        targetRoot: ".nonexistent",
        targetFiles: ["missing.txt"],
      });
      // Ни targetRoot, ни targetFile не существуют

      const result = cleanFiles(entry, tmpDir);

      expect(result.errors).toEqual([]);
      expect(result.removedCount).toBe(0);
    });

    // --- Расширение 2b: EACCES при удалении файла из targetFiles ---
    // Добавить сообщение в errors, продолжить с оставшимися файлами.
    it("при EACCES на targetFile добавляет сообщение в errors и продолжает с оставшимися файлами", () => {
      // Создаём директорию с файлом и делаем read-only для провоцирования EACCES
      const lockDir = path.join(tmpDir, "locked");
      fs.mkdirSync(lockDir);
      fs.writeFileSync(path.join(lockDir, "protected.txt"), "data");
      fs.chmodSync(lockDir, 0o555);

      const entry = createEntry({
        targetRoot: ".nonexistent",
        targetFiles: ["locked/protected.txt", "deletable.txt"],
      });

      // deletable.txt — проверяем что обработка продолжается после ошибки
      fs.writeFileSync(path.join(tmpDir, "deletable.txt"), "can delete");

      const result = cleanFiles(entry, tmpDir);

      // errors содержит сообщение об ошибке для protected.txt
      expect(result.errors.length).toBeGreaterThan(0);
      // deletable.txt удалён — обработка продолжилась
      expect(fs.existsSync(path.join(tmpDir, "deletable.txt"))).toBe(false);
      // removedCount считает только успешно удалённые файлы
      expect(result.removedCount).toBe(1);
    });

    // --- Трансформация: шаг 3 — removedCount = сумма файлов из шагов 1 и 2 ---
    // removedCount (суммарное количество файлов, успешно удалённых на шагах 1 и 2)
    it("вычисляет removedCount как сумму файлов из targetRoot (шаг 1) и targetFiles (шаг 2)", () => {
      const entry = createEntry({ targetFiles: ["out1.txt", "out2.txt"] });

      // targetRoot с 3 файлами (включая вложенную директорию)
      const agentDir = path.join(tmpDir, ".test-agent");
      const subDir = path.join(agentDir, "sub");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "a.txt"), "a");
      fs.writeFileSync(path.join(agentDir, "b.txt"), "b");
      fs.writeFileSync(path.join(subDir, "c.txt"), "c");

      // targetFiles: 2 файла
      fs.writeFileSync(path.join(tmpDir, "out1.txt"), "1");
      fs.writeFileSync(path.join(tmpDir, "out2.txt"), "2");

      const result = cleanFiles(entry, tmpDir);

      // removedCount = 3 (файлы в targetRoot) + 2 (targetFiles) = 5
      expect(result.removedCount).toBe(5);
      expect(result.errors).toEqual([]);
    });
  });
});
