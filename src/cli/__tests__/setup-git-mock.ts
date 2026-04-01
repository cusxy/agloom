import { vi } from "vitest";

// Enable mocking of node:child_process for vi.spyOn to work
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execSync: vi.fn(actual.execSync),
  };
});
