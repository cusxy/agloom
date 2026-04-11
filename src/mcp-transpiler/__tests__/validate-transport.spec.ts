// validate-transport.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md § Тип McpServerConfig,
//               § Правила взаимной исключительности полей,
//               § Валидация канонического файла (шаг 3.1-3.6)

import { describe, it, expect } from "vitest";
import { validateCanonicalContent } from "../validate.js";
import { TransformError } from "../errors.js";

// =============================================================================
// § Валидация канонического файла — транспорт type
// =============================================================================

describe("validateCanonicalContent — транспорт type", () => {
  // --- Шаг 3.1: type по умолчанию = "stdio" ---
  it("принимает сервер без поля type (default stdio) с command", () => {
    const content = {
      mcpServers: {
        s: { command: "npx" },
      },
    };
    expect(() => validateCanonicalContent(content)).not.toThrow();
  });

  // --- Шаг 3.1: явный type "stdio" ---
  it('принимает сервер с явным type "stdio"', () => {
    const content = {
      mcpServers: {
        s: { type: "stdio", command: "npx" },
      },
    };
    expect(() => validateCanonicalContent(content)).not.toThrow();
  });

  // --- Шаг 3.1: валидное значение type "http" ---
  it('принимает сервер с type "http" и url', () => {
    const content = {
      mcpServers: {
        s: { type: "http", url: "https://example.com/mcp" },
      },
    };
    expect(() => validateCanonicalContent(content)).not.toThrow();
  });

  // --- Шаг 3.1: валидное значение type "sse" ---
  it('принимает сервер с type "sse" и url', () => {
    const content = {
      mcpServers: {
        s: { type: "sse", url: "https://example.com/sse" },
      },
    };
    expect(() => validateCanonicalContent(content)).not.toThrow();
  });

  // --- Расширение 3.1a: невалидное значение type ---
  it("выбрасывает TransformError, если type не входит в {stdio, http, sse}", () => {
    const content = {
      mcpServers: {
        s: { type: "websocket", command: "npx" },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
    expect(() => validateCanonicalContent(content as any)).toThrow(/'type' must be one of 'stdio', 'http', 'sse'/);
  });

  // --- Расширение 3.2a: stdio без command ---
  it("выбрасывает TransformError при type stdio без command", () => {
    const content = {
      mcpServers: {
        s: { type: "stdio" },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
    expect(() => validateCanonicalContent(content as any)).toThrow(/'command' is required for stdio transport/);
  });

  // --- Расширение 3.2d: stdio с url ---
  it("выбрасывает TransformError при type stdio с полем url", () => {
    const content = {
      mcpServers: {
        s: { type: "stdio", command: "npx", url: "https://example.com" },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
    expect(() => validateCanonicalContent(content as any)).toThrow(
      /'url' and 'headers' are not allowed for stdio transport/,
    );
  });

  // --- Расширение 3.2d: stdio с headers ---
  it("выбрасывает TransformError при type stdio с полем headers", () => {
    const content = {
      mcpServers: {
        s: { type: "stdio", command: "npx", headers: { "X-Key": "v" } },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
    expect(() => validateCanonicalContent(content as any)).toThrow(
      /'url' and 'headers' are not allowed for stdio transport/,
    );
  });

  // --- Расширение 3.3a: http без url ---
  it("выбрасывает TransformError при type http без url", () => {
    const content = {
      mcpServers: {
        s: { type: "http" },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
    expect(() => validateCanonicalContent(content as any)).toThrow(/'url' is required for http transport/);
  });

  // --- Расширение 3.3a: sse без url ---
  it("выбрасывает TransformError при type sse без url", () => {
    const content = {
      mcpServers: {
        s: { type: "sse" },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
    expect(() => validateCanonicalContent(content as any)).toThrow(/'url' is required for sse transport/);
  });

  // --- Расширение 3.3c: http с command ---
  it("выбрасывает TransformError при type http с command", () => {
    const content = {
      mcpServers: {
        s: { type: "http", url: "https://x", command: "npx" },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
    expect(() => validateCanonicalContent(content as any)).toThrow(
      /'command', 'args', 'env' are not allowed for http transport/,
    );
  });

  // --- Расширение 3.3c: http с args ---
  it("выбрасывает TransformError при type http с args", () => {
    const content = {
      mcpServers: {
        s: { type: "http", url: "https://x", args: ["-y"] },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
  });

  // --- Расширение 3.3c: sse с env ---
  it("выбрасывает TransformError при type sse с env", () => {
    const content = {
      mcpServers: {
        s: { type: "sse", url: "https://x", env: { A: "1" } },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
  });

  // --- Шаг 3.3: headers должны быть объектом с string-значениями ---
  it("принимает http с валидным объектом headers", () => {
    const content = {
      mcpServers: {
        s: { type: "http", url: "https://x", headers: { "X-Foo": "bar" } },
      },
    };
    expect(() => validateCanonicalContent(content)).not.toThrow();
  });

  // --- Расширение 3.3b: headers не объект ---
  it("выбрасывает TransformError если headers не объект", () => {
    const content = {
      mcpServers: {
        s: { type: "http", url: "https://x", headers: "X-Foo: bar" },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
    expect(() => validateCanonicalContent(content as any)).toThrow(/'headers' must be an object with string values/);
  });

  // --- Расширение 3.3b: headers содержит нестроковые значения ---
  it("выбрасывает TransformError если headers содержит не-строковые значения", () => {
    const content = {
      mcpServers: {
        s: { type: "http", url: "https://x", headers: { "X-Count": 42 } },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
  });

  // --- includeTools/excludeTools работают для всех type значений ---
  it("принимает includeTools для http транспорта", () => {
    const content = {
      mcpServers: {
        s: { type: "http", url: "https://x", includeTools: ["t1"] },
      },
    };
    expect(() => validateCanonicalContent(content)).not.toThrow();
  });

  it("принимает excludeTools для sse транспорта", () => {
    const content = {
      mcpServers: {
        s: { type: "sse", url: "https://x", excludeTools: ["t1"] },
      },
    };
    expect(() => validateCanonicalContent(content)).not.toThrow();
  });

  // --- Шаг 3.6 (сохранение инварианта mutually exclusive для всех типов) ---
  it("выбрасывает TransformError при одновременном include/excludeTools для http", () => {
    const content = {
      mcpServers: {
        s: {
          type: "http",
          url: "https://x",
          includeTools: ["a"],
          excludeTools: ["b"],
        },
      },
    };
    expect(() => validateCanonicalContent(content as any)).toThrow(TransformError);
    expect(() => validateCanonicalContent(content as any)).toThrow(/mutually exclusive/);
  });
});
