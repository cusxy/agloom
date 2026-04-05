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
 * Создаёт минимальный mock AdapterRegistryEntry с заданными paths и targetFiles.
 * После удаления targetRoot процедура Clean Files использует paths и targetFiles.
 */
function createEntry(
  overrides?: Partial<Pick<AdapterRegistryEntry, "paths" | "targetFiles">>,
): AdapterRegistryEntry {
  return {
    id: "test",
    description: "Test Adapter",
    instructions: {} as AdapterRegistryEntry["instructions"],
    skills: {} as AdapterRegistryEntry["skills"],
    agents: {} as AdapterRegistryEntry["agents"],
    targetFiles: ["test-output.txt"],
    paths: {
      skills: ".test-agent/skills",
      agents: ".test-agent/agents",
    },
    ...overrides,
  } as AdapterRegistryEntry;
}

describe("CLI", () => {
  describe("Процедура Clean Files", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-clean-files-"));
    });

    afterEach(() => {
      restorePermissions(tmpDir);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–4 ---
    // Шаг 1: Собрать значения всех определённых полей из entry.paths.
    // Шаг 2: Для каждого пути из шага 1 рекурсивно удалить директорию.
    // Шаг 3: Удалить каждый файл из entry.targetFiles.
    // Шаг 4: Сформировать CleanOutcome с removedCount и errors.
    it("удаляет директории из paths рекурсивно и файлы из targetFiles, возвращает CleanOutcome с корректным removedCount и пустыми errors", () => {
      const entry = createEntry({
        paths: {
          skills: ".test-agent/skills",
          agents: ".test-agent/agents",
        },
        targetFiles: ["test-output.txt"],
      });

      // paths.skills директория с файлом
      const skillsDir = path.join(tmpDir, ".test-agent/skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(path.join(skillsDir, "skill.md"), "skill");

      // paths.agents директория с файлом
      const agentsDir = path.join(tmpDir, ".test-agent/agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "agent.md"), "agent");

      // targetFile
      fs.writeFileSync(path.join(tmpDir, "test-output.txt"), "output");

      const result = cleanFiles(entry, tmpDir);

      // Директории из paths удалены
      expect(fs.existsSync(skillsDir)).toBe(false);
      expect(fs.existsSync(agentsDir)).toBe(false);
      // Файл из targetFiles удалён
      expect(fs.existsSync(path.join(tmpDir, "test-output.txt"))).toBe(false);
      // removedCount = 1 (файл в skills) + 1 (файл в agents) + 1 (targetFile) = 3
      expect(result.removedCount).toBe(3);
      expect(result.errors).toEqual([]);
    });

    // --- Расширение 1a: entry.paths пустой — пропустить шаг 2 ---
    // § clean-command.md: 1a. Объект entry.paths пустой → пропустить шаг 2
    it("при пустом объекте paths пропускает шаг удаления директорий, удаляет только targetFiles", () => {
      const entry = createEntry({
        paths: {},
        targetFiles: ["output.txt"],
      });

      fs.writeFileSync(path.join(tmpDir, "output.txt"), "data");

      const result = cleanFiles(entry, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "output.txt"))).toBe(false);
      expect(result.removedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // --- Расширение 2a: директория из paths не существует ---
    // § clean-command.md: 2a. Директория не существует → пропустить, не ошибка.
    it("при несуществующей директории из paths пропускает без ошибки", () => {
      const entry = createEntry({
        paths: {
          skills: ".nonexistent/skills",
          agents: ".nonexistent/agents",
        },
        targetFiles: [],
      });

      const result = cleanFiles(entry, tmpDir);

      expect(result.removedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    // --- Расширение 2b: EACCES при удалении директории из paths ---
    // § clean-command.md: 2b. Ошибка удаления (EACCES) → добавить в errors, продолжить.
    it("при EACCES на директории из paths добавляет сообщение в errors и продолжает с оставшимися", () => {
      const entry = createEntry({
        paths: {
          skills: ".test-agent/skills",
          agents: ".test-agent/agents",
        },
        targetFiles: ["test-output.txt"],
      });

      // skills директория — сделать read-only для провоцирования EACCES
      const skillsDir = path.join(tmpDir, ".test-agent/skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(path.join(skillsDir, "protected.txt"), "data");
      fs.chmodSync(skillsDir, 0o555);

      // agents директория — нормальная, должна быть удалена
      const agentsDir = path.join(tmpDir, ".test-agent/agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "agent.md"), "agent");

      // targetFile — должен быть удалён несмотря на ошибку шага 2
      fs.writeFileSync(path.join(tmpDir, "test-output.txt"), "output");

      const result = cleanFiles(entry, tmpDir);

      // errors содержит хотя бы одно сообщение об ошибке
      expect(result.errors.length).toBeGreaterThan(0);
      // targetFile удалён — процедура продолжила с шагом 3
      expect(fs.existsSync(path.join(tmpDir, "test-output.txt"))).toBe(false);
    });

    // --- Расширение 3a: файл из targetFiles не существует ---
    // § clean-command.md: 3a. Файл не существует → пропустить, не ошибка.
    it("при несуществующем файле из targetFiles пропускает его без ошибки", () => {
      const entry = createEntry({
        paths: {},
        targetFiles: ["missing.txt"],
      });

      const result = cleanFiles(entry, tmpDir);

      expect(result.errors).toEqual([]);
      expect(result.removedCount).toBe(0);
    });

    // --- Расширение 3b: EACCES при удалении файла из targetFiles ---
    // § clean-command.md: 3b. Ошибка удаления файла (EACCES) → добавить в errors, продолжить.
    it("при EACCES на targetFile добавляет сообщение в errors и продолжает с оставшимися файлами", () => {
      // Создаём директорию с файлом и делаем read-only для провоцирования EACCES
      const lockDir = path.join(tmpDir, "locked");
      fs.mkdirSync(lockDir);
      fs.writeFileSync(path.join(lockDir, "protected.txt"), "data");
      fs.chmodSync(lockDir, 0o555);

      const entry = createEntry({
        paths: {},
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

    // --- Трансформация: шаг 4 — removedCount = сумма файлов из шагов 2 и 3 ---
    // § clean-command.md: removedCount (суммарное количество файлов, успешно удалённых на шагах 2 и 3)
    it("вычисляет removedCount как сумму файлов из директорий paths (шаг 2) и targetFiles (шаг 3)", () => {
      const entry = createEntry({
        paths: {
          skills: ".test-agent/skills",
          docs: ".test-agent/docs",
        },
        targetFiles: ["out1.txt", "out2.txt"],
      });

      // skills директория с 2 файлами
      const skillsDir = path.join(tmpDir, ".test-agent/skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(path.join(skillsDir, "a.md"), "a");
      fs.writeFileSync(path.join(skillsDir, "b.md"), "b");

      // docs директория с 1 файлом и вложенной поддиректорией
      const docsDir = path.join(tmpDir, ".test-agent/docs");
      const subDir = path.join(docsDir, "sub");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "doc.md"), "doc");
      fs.writeFileSync(path.join(subDir, "nested.md"), "nested");

      // targetFiles: 2 файла
      fs.writeFileSync(path.join(tmpDir, "out1.txt"), "1");
      fs.writeFileSync(path.join(tmpDir, "out2.txt"), "2");

      const result = cleanFiles(entry, tmpDir);

      // removedCount = 2 (skills) + 2 (docs: doc.md + nested.md) + 2 (targetFiles) = 6
      expect(result.removedCount).toBe(6);
      expect(result.errors).toEqual([]);
    });

    // --- Граничное условие: paths с частично определёнными полями ---
    // § adapter-registry-ext.md: Объект МОЖЕТ содержать опциональные ключи (skills, agents, docs, schemas).
    // Неопределённые поля пропускаются.
    it("обрабатывает только определённые поля из paths, пропускает undefined", () => {
      const entry = createEntry({
        paths: {
          skills: ".test-agent/skills",
          // agents, docs, schemas не определены
        },
        targetFiles: [],
      });

      const skillsDir = path.join(tmpDir, ".test-agent/skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(path.join(skillsDir, "skill.md"), "skill");

      const result = cleanFiles(entry, tmpDir);

      expect(fs.existsSync(skillsDir)).toBe(false);
      expect(result.removedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // --- Граничное условие: удаление директории самой paths, а не parent ---
    // § clean-command.md: Для каждого пути из шага 1 рекурсивно удалить директорию.
    // Сама директория также удаляется. Parent директория НЕ удаляется.
    it("удаляет конкретные paths.* директории, но не их parent директории", () => {
      const entry = createEntry({
        paths: {
          skills: ".test-agent/skills",
          agents: ".test-agent/agents",
        },
        targetFiles: [],
      });

      // Создаём parent директорию и два подкаталога
      const parentDir = path.join(tmpDir, ".test-agent");
      const skillsDir = path.join(parentDir, "skills");
      const agentsDir = path.join(parentDir, "agents");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(skillsDir, "skill.md"), "skill");
      fs.writeFileSync(path.join(agentsDir, "agent.md"), "agent");
      // Также создадим файл в parent, чтобы убедиться что parent не удаляется
      fs.writeFileSync(path.join(parentDir, "config.json"), "{}");

      const result = cleanFiles(entry, tmpDir);

      // skills и agents директории удалены
      expect(fs.existsSync(skillsDir)).toBe(false);
      expect(fs.existsSync(agentsDir)).toBe(false);
      // parent директория (.test-agent) НЕ удалена
      expect(fs.existsSync(parentDir)).toBe(true);
      // config.json в parent НЕ удалён
      expect(fs.existsSync(path.join(parentDir, "config.json"))).toBe(true);
      expect(result.removedCount).toBe(2);
      expect(result.errors).toEqual([]);
    });
  });
});
