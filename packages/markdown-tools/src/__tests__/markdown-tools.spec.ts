// markdown-tools.spec.ts
// Спецификация: docs/specs/format.md § Пакет @agloom/markdown-tools
// Операции: createMarkdownTools, format, check

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createMarkdownTools } from "../index.js";

describe("MarkdownTools", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-mdtools-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // =====================================================================
  // § format.md § Инициализация — createMarkdownTools(config)
  // =====================================================================
  describe("createMarkdownTools", () => {
    // --- Happy path: шаг 1 ---
    // § format.md § Инициализация § Поведение шаг 1:
    // Сохранить projectRoot, prettierOverrides, markdownlintOverrides.
    it("при вызове с projectRoot возвращает экземпляр MarkdownTools", () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });

      expect(tools).toBeDefined();
      expect(tools).toHaveProperty("format");
      expect(tools).toHaveProperty("check");
      expect(typeof tools.format).toBe("function");
      expect(typeof tools.check).toBe("function");
    });

    // § format.md § Инициализация § Вход:
    // prettierOverrides default: {}, markdownlintOverrides default: {}
    it("при вызове без overrides использует дефолтные пустые объекты", () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });

      // Проверяем что экземпляр создан без ошибок — overrides не обязательны
      expect(tools).toBeDefined();
    });

    // § format.md § Инициализация § Вход:
    // prettierOverrides и markdownlintOverrides передаются явно
    it("при вызове с overrides принимает настройки без ошибок", () => {
      const tools = createMarkdownTools({
        projectRoot: tmpDir,
        prettierOverrides: { proseWrap: "always", tabWidth: 4 },
        markdownlintOverrides: { MD013: { line_length: 80 } },
      });

      expect(tools).toBeDefined();
    });
  });

  // =====================================================================
  // § format.md § Метод format
  // tools.format(filePaths) — форматирует указанные файлы
  // =====================================================================
  describe("Метод format", () => {
    // --- Happy path: шаги 1-3 ---
    // § format.md § Метод format § Поведение шаги 1-3:
    // Определить инструменты по расширению, выполнить prettier --write,
    // выполнить markdownlint --fix для .md/.mdx
    it("форматирует .md файл через prettier и markdownlint", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      // Неформатированный markdown — лишние пробелы, неправильный стиль
      fs.writeFileSync(mdFile, "# Hello\n\n*bold*\n\nSome    text\n");

      const result = await tools.format([mdFile]);

      expect(result).toBeDefined();
      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Метод format § Поведение шаг 2:
    // prettier --write для .json файлов
    it("форматирует .json файл через prettier", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const jsonFile = path.join(tmpDir, "test.json");
      fs.writeFileSync(jsonFile, '{"a":1,"b":2}');

      const result = await tools.format([jsonFile]);

      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
      // Проверяем что файл был отформатирован (prettier добавляет отступы)
      const formatted = fs.readFileSync(jsonFile, "utf-8");
      expect(formatted).toContain("\n");
    });

    // § format.md § Метод format § Поведение шаг 2:
    // prettier --write для .yaml файлов
    it("форматирует .yaml файл через prettier", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const yamlFile = path.join(tmpDir, "test.yaml");
      fs.writeFileSync(yamlFile, "a:   1\nb:   2\n");

      const result = await tools.format([yamlFile]);

      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Метод format § Поведение шаг 2:
    // prettier --write для .yml файлов
    it("форматирует .yml файл через prettier", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const ymlFile = path.join(tmpDir, "test.yml");
      fs.writeFileSync(ymlFile, "key:   value\n");

      const result = await tools.format([ymlFile]);

      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Метод format § Поведение шаг 2:
    // prettier --write для .toml файлов
    it("форматирует .toml файл через prettier", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const tomlFile = path.join(tmpDir, "test.toml");
      fs.writeFileSync(tomlFile, 'key  =  "value"\n');

      const result = await tools.format([tomlFile]);

      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Метод format § Поведение шаг 2:
    // prettier --write для .mdx файлов
    it("форматирует .mdx файл через prettier и markdownlint", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdxFile = path.join(tmpDir, "test.mdx");
      fs.writeFileSync(mdxFile, "# Hello\n\nContent\n");

      const result = await tools.format([mdxFile]);

      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Поддерживаемые форматы:
    // markdownlint применяется только к .md/.mdx, не к .json/.yaml/.toml
    it("не применяет markdownlint к .json файлам", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const jsonFile = path.join(tmpDir, "test.json");
      fs.writeFileSync(jsonFile, '{ "a": 1 }\n');

      const result = await tools.format([jsonFile]);

      // Файл обработан только prettier, без markdownlint
      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // --- Несколько файлов разных типов ---
    // § format.md § Метод format § Поведение шаги 1-3:
    // Обработка массива файлов разных расширений
    it("форматирует несколько файлов разных типов", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "doc.md");
      const jsonFile = path.join(tmpDir, "data.json");
      const yamlFile = path.join(tmpDir, "config.yaml");
      fs.writeFileSync(mdFile, "# Title\n\nText\n");
      fs.writeFileSync(jsonFile, '{"a":1}');
      fs.writeFileSync(yamlFile, "a:  1\n");

      const result = await tools.format([mdFile, jsonFile, yamlFile]);

      expect(result.formattedCount).toBe(3);
      expect(result.errors).toEqual([]);
    });

    // --- Расширение 1a ---
    // § format.md § Метод format § Расширения 1a:
    // Файл с неподдерживаемым расширением → пропустить, не добавлять в результат
    it("пропускает файл с неподдерживаемым расширением (.ts)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const tsFile = path.join(tmpDir, "code.ts");
      fs.writeFileSync(tsFile, "const x = 1;\n");

      const result = await tools.format([tsFile]);

      expect(result.formattedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Метод format § Расширения 1a:
    // Смешанный список: поддерживаемые + неподдерживаемые
    it("пропускает неподдерживаемые файлы в смешанном списке", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "doc.md");
      const pyFile = path.join(tmpDir, "script.py");
      fs.writeFileSync(mdFile, "# Title\n\nText\n");
      fs.writeFileSync(pyFile, "print('hello')\n");

      const result = await tools.format([mdFile, pyFile]);

      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // --- Расширение 2a ---
    // § format.md § Метод format § Расширения 2a:
    // prettier ошибка → добавить в errors, продолжить с оставшимися
    it("при ошибке prettier для файла добавляет сообщение в errors и продолжает", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const badFile = path.join(tmpDir, "bad.json");
      const goodFile = path.join(tmpDir, "good.json");
      // Невалидный JSON (не может быть отформатирован)
      fs.writeFileSync(badFile, "{{{invalid json!!!}}}");
      fs.writeFileSync(goodFile, '{"a":1}');

      const result = await tools.format([badFile, goodFile]);

      expect(result.errors.length).toBeGreaterThan(0);
      // good.json всё равно должен быть обработан
      expect(result.formattedCount).toBeGreaterThanOrEqual(1);
    });

    // --- Расширение 3a ---
    // § format.md § Метод format § Расширения 3a:
    // markdownlint завершился с ошибкой для файла → добавить сообщение
    // об ошибке в errors, продолжить с оставшимися файлами
    it("при ошибке выполнения markdownlint добавляет сообщение в errors и продолжает", async () => {
      // Провоцируем runtime error markdownlint: делаем .md файл нечитаемым
      // после добавления в список. markdownlint не сможет прочитать файл.
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const unreadableFile = path.join(tmpDir, "unreadable.md");
      const goodFile = path.join(tmpDir, "good.json");
      fs.writeFileSync(unreadableFile, "# Title\n\nText\n");
      fs.writeFileSync(goodFile, '{"a":1}');
      // Убираем права на чтение — markdownlint получит EACCES
      fs.chmodSync(unreadableFile, 0o000);

      const result = await tools.format([unreadableFile, goodFile]);

      // markdownlint должен был добавить ошибку для unreadable.md
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: string) => e.includes("unreadable.md"))).toBe(true);
      // good.json всё равно обработан (prettier, без markdownlint)
      expect(result.formattedCount).toBeGreaterThanOrEqual(1);

      // Восстанавливаем права для cleanup
      fs.chmodSync(unreadableFile, 0o644);
    });

    // --- Граничное условие: пустой массив ---
    it("при пустом массиве filePaths возвращает formattedCount: 0", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });

      const result = await tools.format([]);

      expect(result.formattedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    // --- Приоритет конфигурации ---
    // § format.md § Приоритет конфигурации:
    // Уровень 3: prettierOverrides мержатся поверх дефолтов (shallow merge)
    it("применяет prettierOverrides поверх встроенных дефолтов", async () => {
      const tools = createMarkdownTools({
        projectRoot: tmpDir,
        prettierOverrides: { tabWidth: 4 },
      });
      const jsonFile = path.join(tmpDir, "test.json");
      fs.writeFileSync(jsonFile, '{"a":{"b":1}}');

      const result = await tools.format([jsonFile]);

      expect(result.formattedCount).toBe(1);
      // Проверяем что файл отформатирован с tabWidth: 4
      const formatted = fs.readFileSync(jsonFile, "utf-8");
      expect(formatted).toContain("    "); // 4 пробела вместо 2
    });

    // § format.md § Приоритет конфигурации:
    // Уровень 3: markdownlintOverrides мержатся поверх дефолтов
    it("применяет markdownlintOverrides поверх встроенных дефолтов", async () => {
      const tools = createMarkdownTools({
        projectRoot: tmpDir,
        markdownlintOverrides: { MD013: { line_length: 80 } },
      });
      const mdFile = path.join(tmpDir, "test.md");
      fs.writeFileSync(mdFile, "# Title\n\nShort line\n");

      const result = await tools.format([mdFile]);

      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Встроенные дефолтные конфиги § Prettier:
    // proseWrap: preserve, tabWidth: 2
    it("использует встроенные дефолты prettier (tabWidth: 2)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const jsonFile = path.join(tmpDir, "test.json");
      fs.writeFileSync(jsonFile, '{"a":{"b":1}}');

      await tools.format([jsonFile]);

      const formatted = fs.readFileSync(jsonFile, "utf-8");
      // Дефолтный tabWidth: 2 — ожидаем 2 пробела
      expect(formatted).toContain("  ");
    });
  });

  // =====================================================================
  // § format.md § Метод check
  // tools.check(filePaths) — проверяет файлы без изменений
  // =====================================================================
  describe("Метод check", () => {
    // --- Happy path: шаги 1-3 ---
    // § format.md § Метод check § Поведение шаги 1-3:
    // Определить инструменты по расширению, prettier --check, markdownlint
    it("при корректно отформатированном .md файле возвращает пустые failures", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      // Сначала форматируем файл, затем проверяем
      fs.writeFileSync(mdFile, "# Title\n\nText\n");
      await tools.format([mdFile]);

      const result = await tools.check([mdFile]);

      expect(result).toBeDefined();
      expect(result.checkedCount).toBe(1);
      expect(result.failures).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Метод check § Поведение шаг 2:
    // prettier --check для .json
    it("при корректно отформатированном .json файле возвращает пустые failures", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const jsonFile = path.join(tmpDir, "test.json");
      fs.writeFileSync(jsonFile, '{ "a": 1 }\n');
      await tools.format([jsonFile]);

      const result = await tools.check([jsonFile]);

      expect(result.checkedCount).toBe(1);
      expect(result.failures).toEqual([]);
    });

    // § format.md § Метод check § Поведение шаг 2:
    // prettier --check для .yaml
    it("при корректно отформатированном .yaml файле возвращает пустые failures", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const yamlFile = path.join(tmpDir, "test.yaml");
      fs.writeFileSync(yamlFile, "a: 1\n");
      await tools.format([yamlFile]);

      const result = await tools.check([yamlFile]);

      expect(result.checkedCount).toBe(1);
      expect(result.failures).toEqual([]);
    });

    // § format.md § Метод check § Поведение шаг 2:
    // prettier --check для .toml
    it("при корректно отформатированном .toml файле возвращает пустые failures", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const tomlFile = path.join(tmpDir, "test.toml");
      fs.writeFileSync(tomlFile, 'key = "value"\n');
      await tools.format([tomlFile]);

      const result = await tools.check([tomlFile]);

      expect(result.checkedCount).toBe(1);
      expect(result.failures).toEqual([]);
    });

    // --- Расширение 1a ---
    // § format.md § Метод check § Расширения 1a:
    // Неподдерживаемое расширение → пропустить
    it("пропускает файл с неподдерживаемым расширением", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const tsFile = path.join(tmpDir, "code.ts");
      fs.writeFileSync(tsFile, "const x = 1;\n");

      const result = await tools.check([tsFile]);

      expect(result.checkedCount).toBe(0);
      expect(result.failures).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    // --- Расширение 2a ---
    // § format.md § Метод check § Расширения 2a:
    // prettier --check обнаружил файл, требующий форматирования →
    // добавить путь файла в failures
    it("при неформатированном .json файле добавляет путь в failures", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const jsonFile = path.join(tmpDir, "test.json");
      fs.writeFileSync(jsonFile, '{"a":1,"b":2}');

      const result = await tools.check([jsonFile]);

      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures.some((f: string) => f.includes("test.json"))).toBe(true);
    });

    // § format.md § Метод check § Расширения 2a:
    // prettier --check для неформатированного .md файла
    it("при неформатированном .md файле добавляет в failures", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      // Неформатированный: trailing spaces, нестандартный отступ
      fs.writeFileSync(mdFile, "# Title   \n\n- item1\n   - nested\n");

      const result = await tools.check([mdFile]);

      // Должен быть хотя бы один failure (prettier или markdownlint)
      expect(result.failures.length > 0 || result.errors.length > 0).toBeTruthy();
    });

    // --- Расширение 3a ---
    // § format.md § Метод check § Расширения 3a:
    // markdownlint обнаружил нарушения → добавить путь и описание в failures
    it("при нарушениях markdownlint добавляет путь и описание в failures", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      // Создаём markdown с нарушением: emphasis вместо underscore (MD049)
      // Встроенный дефолт: MD049 style: "underscore"
      fs.writeFileSync(mdFile, "# Title\n\n*emphasis text*\n");

      const result = await tools.check([mdFile]);

      // Должен быть failure от markdownlint (MD049: emphasis style)
      expect(result.failures.length).toBeGreaterThan(0);
    });

    // --- Расширение 2b ---
    // § format.md § Метод check § Расширения 2b:
    // prettier ошибка выполнения (не несоответствие) → добавить в errors
    it("при ошибке выполнения prettier добавляет в errors", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const badFile = path.join(tmpDir, "bad.json");
      fs.writeFileSync(badFile, "{{{broken json");

      const result = await tools.check([badFile]);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    // --- Расширение 3b ---
    // § format.md § Метод check § Расширения 3b:
    // markdownlint завершился с ошибкой выполнения → добавить сообщение в errors
    // (ошибка выполнения, а не нарушение правил — попадает в errors, не в failures)
    it("при ошибке выполнения markdownlint добавляет сообщение в errors, а не в failures", async () => {
      // Провоцируем runtime error markdownlint: делаем .md файл нечитаемым.
      // markdownlint не сможет прочитать файл и получит EACCES.
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const unreadableFile = path.join(tmpDir, "unreadable.md");
      fs.writeFileSync(unreadableFile, "# Title\n\nText\n");
      // Убираем права на чтение
      fs.chmodSync(unreadableFile, 0o000);

      const result = await tools.check([unreadableFile]);

      // Ошибка выполнения должна попасть в errors с информативным сообщением
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: string) => e.includes("unreadable.md"))).toBe(true);
      // Ошибка выполнения НЕ должна попасть в failures
      // (failures — это нарушения формата, а не runtime errors)
      const failuresForFile = result.failures.filter((f: string) => f.includes("unreadable.md"));
      expect(failuresForFile).toEqual([]);

      // Восстанавливаем права для cleanup
      fs.chmodSync(unreadableFile, 0o644);
    });

    // --- Граничное условие: пустой массив ---
    it("при пустом массиве filePaths возвращает checkedCount: 0", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });

      const result = await tools.check([]);

      expect(result.checkedCount).toBe(0);
      expect(result.failures).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    // --- Несколько файлов: смешанный результат ---
    // § format.md § Метод check § Поведение:
    // Обработка массива файлов с разными результатами
    it("проверяет несколько файлов и агрегирует результаты", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const goodFile = path.join(tmpDir, "good.json");
      const badFile = path.join(tmpDir, "bad.json");
      // Форматируем good, оставляем bad неформатированным
      fs.writeFileSync(goodFile, '{ "a": 1 }\n');
      await tools.format([goodFile]);
      fs.writeFileSync(badFile, '{"a":1,"b":2}');

      const result = await tools.check([goodFile, badFile]);

      expect(result.checkedCount).toBe(2);
      expect(result.failures.length).toBeGreaterThan(0);
    });

    // --- Приоритет конфигурации в check ---
    // § format.md § Приоритет конфигурации:
    // check использует те же правила приоритета, что и format
    it("применяет prettierOverrides при проверке", async () => {
      const tools = createMarkdownTools({
        projectRoot: tmpDir,
        prettierOverrides: { tabWidth: 4 },
      });
      const jsonFile = path.join(tmpDir, "test.json");
      // Файл с 2-пробельным отступом — не соответствует tabWidth: 4
      fs.writeFileSync(jsonFile, '{\n  "a": 1\n}\n');

      const result = await tools.check([jsonFile]);

      // При tabWidth: 4 файл с 2-пробельным отступом должен быть в failures
      expect(result.failures.length).toBeGreaterThan(0);
    });
  });

  // =====================================================================
  // § format.md § Метод format § Поведение шаг 5, Расширение 5a
  // Поле failures в FormatResult — non-fixable violations markdownlint
  // =====================================================================
  describe("Метод format — failures (non-fixable violations)", () => {
    // § format.md § Метод format § Поведение шаг 5:
    // Собрать non-fixable нарушения markdownlint в failures на основе
    // того же результата шага 3, без повторного запуска markdownlint.
    // § format.md § Метод format § Результат § failures:
    // Формат записи совпадает с § Метод check.
    it("при файле с только non-fixable нарушениями (MD025) заполняет failures и засчитывает файл в formattedCount", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "two-h1.md");
      // MD025 (Multiple top-level headings) — non-fixable.
      // Файл с двумя заголовками первого уровня.
      fs.writeFileSync(mdFile, "# First Title\n\nSome content here.\n\n# Second Title\n\nMore content here.\n");

      const result = await tools.format([mdFile]);

      // Non-fixable violation должен попасть в failures
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures.some((f: string) => f.includes("MD025"))).toBe(true);
      // § C6: файл засчитывается в formattedCount, даже при non-fixable violations,
      // потому что prettier и markdownlint отработали без runtime-ошибок.
      expect(result.formattedCount).toBe(1);
      // § C2: errors — только runtime, non-fixable туда попадать не должны
      expect(result.errors).toEqual([]);
    });

    // § format.md § Метод format § Расширение 5a:
    // Формат записи failures: ${filePath}:${lineNumber}: ${ruleName} ${desc}
    // (совпадает с § Метод check).
    it("запись в failures имеет формат '${filePath}:${lineNumber}: ${ruleName} ${desc}'", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "two-h1.md");
      fs.writeFileSync(mdFile, "# First Title\n\nSome content here.\n\n# Second Title\n\nMore content here.\n");

      const result = await tools.format([mdFile]);

      const md025Failure = result.failures.find((f: string) => f.includes("MD025"));
      expect(md025Failure).toBeDefined();
      // Формат: <filePath>:<lineNumber>: MD025 <description>
      // lineNumber для MD025 при этом содержимом — строка 5 (второй H1).
      expect(md025Failure).toMatch(new RegExp(`^${mdFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\d+: MD025 `));
    });

    // § format.md § Метод format § Поведение шаг 4-5:
    // Fixable нарушения применяются, non-fixable остаются в failures.
    it("при файле с только fixable нарушениями (MD049) failures пуст, файл изменён", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "fixable.md");
      // Inline *emphasis* внутри параграфа — только MD049 (fixable: asterisk -> underscore).
      // MD036 (emphasis as heading) не срабатывает, так как emphasis inline.
      fs.writeFileSync(mdFile, "# Title\n\nSome text with *emphasis* inline.\n");
      const before = fs.readFileSync(mdFile, "utf-8");

      const result = await tools.format([mdFile]);

      expect(result.failures).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.formattedCount).toBe(1);
      // Файл должен быть изменён — asterisk заменён на underscore.
      const after = fs.readFileSync(mdFile, "utf-8");
      expect(after).not.toBe(before);
      expect(after).toContain("_emphasis_");
    });

    // § format.md § Метод format § Поведение шаг 4-5:
    // Mixed: fixable применяются (файл изменён), non-fixable попадают в failures.
    it("при mixed нарушениях (MD025 non-fixable + MD049 fixable) применяет фиксы и заполняет failures", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "mixed.md");
      fs.writeFileSync(mdFile, "# First Title\n\nSome *emphasis* inline.\n\n# Second Title\n\nMore text.\n");

      const result = await tools.format([mdFile]);

      // MD025 (non-fixable) → в failures
      expect(result.failures.some((f: string) => f.includes("MD025"))).toBe(true);
      // MD049 (fixable) → НЕ в failures (применён автофикс)
      expect(result.failures.some((f: string) => f.includes("MD049"))).toBe(false);
      // Файл изменён — asterisk заменён на underscore
      const after = fs.readFileSync(mdFile, "utf-8");
      expect(after).toContain("_emphasis_");
      // formattedCount = 1 (файл обработан)
      expect(result.formattedCount).toBe(1);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Метод format § Результат § failures:
    // При чистом файле failures — пустой массив.
    it("при чистом .md файле failures и errors пусты", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "clean.md");
      fs.writeFileSync(mdFile, "# Only Title\n\nJust regular text.\n");

      const result = await tools.format([mdFile]);

      expect(result.failures).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.formattedCount).toBe(1);
    });

    // § format.md § Метод format § Результат § failures, errors (C2):
    // runtime-ошибка prettier → errors непуст, failures ПУСТ.
    // ЗАПРЕЩЕНО класть runtime-ошибки в failures.
    it("при runtime-ошибке prettier errors непуст, а failures пуст (C2)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const badFile = path.join(tmpDir, "bad.json");
      fs.writeFileSync(badFile, "{{{invalid json!!!}}}");

      const result = await tools.format([badFile]);

      expect(result.errors.length).toBeGreaterThan(0);
      // C2: runtime ≠ failures — non-markdown файл runtime-ошибка НЕ должна
      // утечь в failures.
      expect(result.failures).toEqual([]);
    });

    // § format.md § Поддерживаемые форматы:
    // .json/.yaml/.toml не обрабатываются markdownlint → failures пуст.
    it("для валидных .json файлов failures пуст (markdownlint не применяется)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const jsonFile = path.join(tmpDir, "data.json");
      fs.writeFileSync(jsonFile, '{"a":1}');

      const result = await tools.format([jsonFile]);

      expect(result.failures).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.formattedCount).toBe(1);
    });

    it("для валидных .yaml файлов failures пуст", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const yamlFile = path.join(tmpDir, "data.yaml");
      fs.writeFileSync(yamlFile, "a: 1\n");

      const result = await tools.format([yamlFile]);

      expect(result.failures).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("для валидных .toml файлов failures пуст", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const tomlFile = path.join(tmpDir, "data.toml");
      fs.writeFileSync(tomlFile, 'key = "value"\n');

      const result = await tools.format([tomlFile]);

      expect(result.failures).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    // § format.md § Метод format § Результат (C2):
    // FormatResult ДОЛЖЕН содержать ровно три поля: formattedCount, failures, errors.
    it("FormatResult содержит поля formattedCount, failures, errors", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      fs.writeFileSync(mdFile, "# Title\n\nText\n");

      const result = await tools.format([mdFile]);

      expect(typeof result.formattedCount).toBe("number");
      expect(Array.isArray(result.failures)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  // =====================================================================
  // § format.md § Поддерживаемые форматы — граничные условия
  // =====================================================================
  describe("Поддерживаемые форматы", () => {
    // § format.md § Поддерживаемые форматы:
    // Файлы с расширениями, не перечисленными в таблице, ЗАПРЕЩАЕТСЯ обрабатывать.
    // Пропуск без ошибки.
    it("пропускает .txt файл без ошибки (format)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const txtFile = path.join(tmpDir, "readme.txt");
      fs.writeFileSync(txtFile, "Hello world\n");

      const result = await tools.format([txtFile]);

      expect(result.formattedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it("пропускает .txt файл без ошибки (check)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const txtFile = path.join(tmpDir, "readme.txt");
      fs.writeFileSync(txtFile, "Hello world\n");

      const result = await tools.check([txtFile]);

      expect(result.checkedCount).toBe(0);
      expect(result.failures).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    // Граничное: файл без расширения
    it("пропускает файл без расширения", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const noExtFile = path.join(tmpDir, "Makefile");
      fs.writeFileSync(noExtFile, "all:\n\techo hello\n");

      const result = await tools.format([noExtFile]);

      expect(result.formattedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    // Граничное: файл с расширением .html
    it("пропускает .html файл без ошибки", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const htmlFile = path.join(tmpDir, "page.html");
      fs.writeFileSync(htmlFile, "<h1>Hello</h1>\n");

      const result = await tools.format([htmlFile]);

      expect(result.formattedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });
  });

  // =====================================================================
  // § format.md § Встроенные дефолтные конфиги — трансформации
  // =====================================================================
  describe("Встроенные дефолтные конфиги", () => {
    // § format.md § Встроенные дефолтные конфиги § Prettier:
    // proseWrap: preserve
    it("prettier использует proseWrap: preserve по умолчанию", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      const longLine =
        "# Title\n\nThis is a very long line that should not be wrapped because proseWrap is set to preserve by default in the built-in configuration of the markdown tools package.\n";
      fs.writeFileSync(mdFile, longLine);

      await tools.format([mdFile]);

      const formatted = fs.readFileSync(mdFile, "utf-8");
      // С proseWrap: preserve длинная строка не должна быть разбита
      expect(formatted).toContain("This is a very long line that should not be wrapped");
    });

    // § format.md § Встроенные дефолтные конфиги § Markdownlint:
    // MD049 style: "underscore"
    it("markdownlint check ожидает underscore для emphasis (MD049)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      // Используем asterisk вместо underscore — нарушение MD049
      fs.writeFileSync(mdFile, "# Title\n\n*emphasis*\n");

      const result = await tools.check([mdFile]);

      // Должен обнаружить нарушение MD049
      expect(result.failures.length).toBeGreaterThan(0);
    });

    // § format.md § Встроенные дефолтные конфиги § Markdownlint:
    // MD050 style: "asterisk"
    it("markdownlint check ожидает asterisk для strong (MD050)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      // Используем underscore для strong — нарушение MD050
      fs.writeFileSync(mdFile, "# Title\n\n__strong text__\n");

      const result = await tools.check([mdFile]);

      // Должен обнаружить нарушение MD050
      expect(result.failures.length).toBeGreaterThan(0);
    });

    // § format.md § Встроенные дефолтные конфиги § Markdownlint:
    // MD013 line_length: 120, tables: false
    it("markdownlint check допускает строки до 120 символов (MD013)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      // Строка ровно 120 символов — допустима
      const line = "a".repeat(120);
      fs.writeFileSync(mdFile, `# Title\n\n${line}\n`);

      // Сначала форматируем prettier, чтобы изолировать markdownlint
      await tools.format([mdFile]);
      const result = await tools.check([mdFile]);

      // Строка 120 символов не должна вызывать failure от MD013
      const md013Failures = result.failures.filter((f: string) => f.includes("MD013"));
      expect(md013Failures).toEqual([]);
    });

    // § format.md § Встроенные дефолтные конфиги § Markdownlint:
    // MD007 indent: 2
    it("markdownlint check ожидает 2-пробельный отступ для списков (MD007)", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      // 4-пробельный отступ — нарушение MD007 при indent: 2
      fs.writeFileSync(mdFile, "# Title\n\n- item\n    - nested\n");

      const result = await tools.check([mdFile]);

      expect(result.failures.length).toBeGreaterThan(0);
    });
  });

  // =====================================================================
  // § format.md § Приоритет конфигурации — уровень 2 (нативные файлы)
  // =====================================================================
  describe("Приоритет конфигурации — нативные файлы", () => {
    // § format.md § Приоритет конфигурации § Уровень 2:
    // Нативный .prettierrc перекрывает встроенный дефолт
    it("нативный .prettierrc в projectRoot перекрывает встроенный дефолт", async () => {
      // Создаём .prettierrc с tabWidth: 8
      fs.writeFileSync(path.join(tmpDir, ".prettierrc"), JSON.stringify({ tabWidth: 8 }));

      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const jsonFile = path.join(tmpDir, "test.json");
      fs.writeFileSync(jsonFile, '{"a":{"b":1}}');

      await tools.format([jsonFile]);

      const formatted = fs.readFileSync(jsonFile, "utf-8");
      // С tabWidth: 8 ожидаем 8-пробельный отступ
      expect(formatted).toContain("        "); // 8 пробелов
    });

    // § format.md § Приоритет конфигурации § Уровень 3 поверх 2:
    // prettierOverrides мержатся поверх нативного файла
    it("prettierOverrides перекрывает нативный .prettierrc", async () => {
      // Нативный: tabWidth: 8
      fs.writeFileSync(path.join(tmpDir, ".prettierrc"), JSON.stringify({ tabWidth: 8 }));

      const tools = createMarkdownTools({
        projectRoot: tmpDir,
        prettierOverrides: { tabWidth: 4 },
      });
      const jsonFile = path.join(tmpDir, "test.json");
      fs.writeFileSync(jsonFile, '{"a":{"b":1}}');

      await tools.format([jsonFile]);

      const formatted = fs.readFileSync(jsonFile, "utf-8");
      // Overrides (tabWidth: 4) перекрывает нативный (tabWidth: 8).
      // Top-level отступ = 4 пробела, подтверждает что override применился.
      // Не проверяем отсутствие 8 пробелов: при 2 уровнях вложенности
      // prettier корректно даёт 4+4=8 пробелов для вложенного значения.
      expect(formatted).toContain("    "); // 4 пробела — top level
      expect(formatted).toMatch(/^\{\n {4}"/); // первый уровень = ровно 4 пробела
    });
  });

  // =====================================================================
  // § format.md § Результат — структура FormatResult и CheckResult
  // =====================================================================
  describe("Структура результатов", () => {
    // § format.md § Метод format § Результат:
    // FormatResult: formattedCount, errors
    it("FormatResult содержит formattedCount и errors", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      fs.writeFileSync(mdFile, "# Title\n\nText\n");

      const result = await tools.format([mdFile]);

      expect(typeof result.formattedCount).toBe("number");
      expect(Array.isArray(result.errors)).toBe(true);
    });

    // § format.md § Метод check § Результат:
    // CheckResult: checkedCount, failures, errors
    it("CheckResult содержит checkedCount, failures и errors", async () => {
      const tools = createMarkdownTools({ projectRoot: tmpDir });
      const mdFile = path.join(tmpDir, "test.md");
      fs.writeFileSync(mdFile, "# Title\n\nText\n");

      const result = await tools.check([mdFile]);

      expect(typeof result.checkedCount).toBe("number");
      expect(Array.isArray(result.failures)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
