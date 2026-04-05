// load-dotenv.spec.ts
// Спецификация: docs/specs/interpolation.md § Загрузка .env файла

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadDotenv } from "../index.js";

describe("Interpolation", () => {
  describe("Загрузка .env файла", () => {
    let tmpDir: string;

    /** Ключи, установленные в process.env в рамках теста — для cleanup. */
    const envKeysToClean: string[] = [];

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-dotenv-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      for (const key of envKeysToClean) {
        delete process.env[key];
      }
      envKeysToClean.length = 0;
    });

    // --- Happy path: шаги 1–3 — загрузка .env и запись в process.env ---
    it("загружает переменные из .env файла в process.env", () => {
      const envKey = "__AGLOOM_TEST_DOTENV_NEW__";
      envKeysToClean.push(envKey);

      // Убедимся, что переменная не определена до вызова
      delete process.env[envKey];

      fs.writeFileSync(path.join(tmpDir, ".env"), `${envKey}=dotenv-value\n`);

      loadDotenv(tmpDir);

      expect(process.env[envKey]).toBe("dotenv-value");
    });

    // --- Трансформация: шаг 3 — process.env имеет приоритет, существующие значения не перезаписываются ---
    it("не перезаписывает переменную, если она уже определена в process.env", () => {
      const envKey = "__AGLOOM_TEST_DOTENV_EXISTING__";
      envKeysToClean.push(envKey);

      process.env[envKey] = "existing-value";

      fs.writeFileSync(path.join(tmpDir, ".env"), `${envKey}=dotenv-override\n`);

      loadDotenv(tmpDir);

      expect(process.env[envKey]).toBe("existing-value");
    });

    // --- Трансформация: шаг 1 — путь к файлу = <projectRoot>/.env ---
    it("читает .env файл из <projectRoot>/.env", () => {
      const envKey = "__AGLOOM_TEST_DOTENV_PATH__";
      envKeysToClean.push(envKey);
      delete process.env[envKey];

      // Создаём .env не в корне tmpDir, а в подкаталоге —
      // вызов с tmpDir не должен находить этот файл
      const subDir = path.join(tmpDir, "subdir");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, ".env"), `${envKey}=from-subdir\n`);

      // .env в корне tmpDir не существует — переменная не должна появиться
      loadDotenv(tmpDir);

      expect(process.env[envKey]).toBeUndefined();
    });

    // --- Расширение 1a: файл .env не существует → тихо пропустить ---
    it("тихо пропускает загрузку, если файл .env не существует", () => {
      // tmpDir существует, но .env не создан

      expect(() => loadDotenv(tmpDir)).not.toThrow();
    });

    // --- Расширение 2a: ошибка чтения/парсинга → тихо пропустить ---
    it("тихо пропускает загрузку при невалидном содержимом .env файла", () => {
      // Создаём файл с потенциально проблемным содержимым (бинарные данные)
      const binaryContent = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x89]);
      fs.writeFileSync(path.join(tmpDir, ".env"), binaryContent);

      expect(() => loadDotenv(tmpDir)).not.toThrow();
    });

    // --- Граничное условие: пустой .env файл ---
    it("не изменяет process.env при пустом .env файле", () => {
      fs.writeFileSync(path.join(tmpDir, ".env"), "");

      // Снимаем snapshot ключей process.env до и после
      const keysBefore = Object.keys(process.env).sort();

      loadDotenv(tmpDir);

      const keysAfter = Object.keys(process.env).sort();
      expect(keysAfter).toEqual(keysBefore);
    });

    // --- Трансформация: шаг 3 — несколько переменных, часть уже определена ---
    it("загружает несколько переменных, пропуская уже определённые в process.env", () => {
      const keyNew = "__AGLOOM_TEST_DOTENV_MULTI_NEW__";
      const keyExisting = "__AGLOOM_TEST_DOTENV_MULTI_EXISTING__";
      envKeysToClean.push(keyNew, keyExisting);

      delete process.env[keyNew];
      process.env[keyExisting] = "keep-me";

      fs.writeFileSync(path.join(tmpDir, ".env"), `${keyNew}=new-value\n${keyExisting}=override-value\n`);

      loadDotenv(tmpDir);

      expect(process.env[keyNew]).toBe("new-value");
      expect(process.env[keyExisting]).toBe("keep-me");
    });

    // --- Результат: void ---
    it("возвращает void", () => {
      fs.writeFileSync(path.join(tmpDir, ".env"), "X=1\n");

      const result = loadDotenv(tmpDir);

      expect(result).toBeUndefined();
    });
  });
});
