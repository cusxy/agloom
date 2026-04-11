// transpile-clean.spec.ts
// Спецификация: docs/specs/clean-command.md § Расширение команды transpile

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runApp } from "./run-app-test-helper.js";

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

describe("CLI", () => {
  describe("Расширение команды transpile — --clean", () => {
    let tmpDir: string;
    let originalExitCode: number | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-transpile-clean-"));
      originalExitCode = process.exitCode;

      // Канонические source-файлы для транспиляции
      // Instructions: AGLOOM.md
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "General instructions.");

      // Skills: .agloom/skills/my-skill/SKILL.md
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\nSkill content.");

      // Agents: .agloom/agents/reviewer.md
      const agentDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "reviewer.md"), "---\nname: reviewer\n---\nReviewer body.");
    });

    afterEach(() => {
      restorePermissions(tmpDir);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.exitCode = originalExitCode;
    });

    // --- Happy path: новый шаг 4 ---
    // После шага 3 (определение projectRoot):
    // 4. При наличии флага --clean выполнить процедуру Clean Files
    //    с entry и projectRoot.
    it("при флаге --clean удаляет ранее сгенерированные файлы и затем выполняет транспиляцию", async () => {
      // Создаём «ранее сгенерированные» файлы в paths-поддиректориях адаптера claude
      const oldSkillsDir = path.join(tmpDir, ".claude", "skills", "old-skill");
      fs.mkdirSync(oldSkillsDir, { recursive: true });
      fs.writeFileSync(path.join(oldSkillsDir, "SKILL.md"), "old content");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Old CLAUDE.md");

      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude", "--clean"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // § Изменения в выводе: результат очистки отображается
      expect(output).toContain("Cleaning for claude");
      // Транспиляция выполнена
      expect(output).toContain("Transpiling for claude");
      expect(output).toContain("✓");
      expect(output).toMatch(/files written/);

      // old-skill удалён процедурой Clean Files (вся skills/ поддиректория удалена)
      expect(fs.existsSync(path.join(oldSkillsDir, "SKILL.md"))).toBe(false);

      // § Изменения в exit codes: 0 при успехе (нет ошибок ни в clean, ни в transpile)
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- § Изменения в выводе ---
    // Результат очистки отображается перед прогрессом транспиляции.
    it("отображает результат очистки перед прогрессом транспиляции", async () => {
      // Создаём ранее сгенерированные файлы
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "old.txt"), "old");

      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude", "--clean"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // "Cleaning for" появляется в выводе перед "Transpiling for"
      const cleanIdx = output.indexOf("Cleaning for");
      const transpileIdx = output.indexOf("Transpiling for");

      expect(cleanIdx).toBeGreaterThanOrEqual(0);
      expect(transpileIdx).toBeGreaterThan(cleanIdx);

      unmount();
    });

    // --- § Изменения в exit codes ---
    // Ошибка очистки НЕ прерывает транспиляцию.
    it("при ошибке очистки продолжает транспиляцию", async () => {
      // Создаём targetRoot с protected поддиректорией — EACCES при удалении
      const claudeDir = path.join(tmpDir, ".claude");
      const protectedDir = path.join(claudeDir, "protected");
      fs.mkdirSync(protectedDir, { recursive: true });
      fs.writeFileSync(path.join(protectedDir, "file.txt"), "locked");
      fs.chmodSync(protectedDir, 0o555);

      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude", "--clean"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Очистка запущена (секция присутствует в выводе)
      expect(output).toContain("Cleaning for claude");
      // Транспиляция запущена — не была прервана ошибкой очистки
      expect(output).toContain("Transpiling for claude");
      expect(output).toMatch(/Instructions/);

      unmount();
    });

    // --- § Изменения в exit codes ---
    // Exit code 1 если хотя бы одна ошибка в clean ИЛИ transpile шагах.
    it("завершается с exit code 1 при ошибке в clean даже если transpile успешен", async () => {
      // Создаём paths-поддиректорию с protected содержимым — EACCES при удалении
      // .claude/ остаётся writable — transpile сможет писать в неё
      const skillsDir = path.join(tmpDir, ".claude", "skills");
      const protectedDir = path.join(skillsDir, "protected");
      fs.mkdirSync(protectedDir, { recursive: true });
      fs.writeFileSync(path.join(protectedDir, "file.txt"), "locked");
      fs.chmodSync(protectedDir, 0o555);

      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude", "--clean"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Очистка произошла (секция присутствует)
      expect(output).toContain("Cleaning for claude");
      // Exit code 1 — ошибка в clean (EACCES)
      expect(process.exitCode).toBe(1);

      unmount();
    });
  });
});
