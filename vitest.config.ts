import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    globals: true,
    setupFiles: ["src/cli/__tests__/setup-git-mock.ts"],
  },
});
