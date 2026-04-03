declare module "markdownlint-cli2/markdownlint/promise" {
  interface LintOptions {
    files?: string[];
    strings?: Record<string, string>;
    config?: Record<string, unknown>;
  }

  interface LintResult {
    lineNumber: number;
    ruleNames: string[];
    ruleDescription: string;
    ruleInformation: string;
    errorDetail: string | null;
    errorContext: string | null;
    errorRange: [number, number] | null;
    fixInfo: {
      editColumn: number;
      deleteCount: number;
      insertText: string;
    } | null;
  }

  export function lint(
    options: LintOptions,
  ): Promise<Record<string, LintResult[]>>;
}

declare module "markdownlint-cli2/markdownlint" {
  export function applyFixes(content: string, results: unknown[]): string;
  export function getVersion(): string;
  export function resolveModule(id: string): unknown;
}
