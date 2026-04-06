import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    globals: true,
    setupFiles: ["src/cli/__tests__/setup-git-mock.ts"],
    // Integration tests use real os.tmpdir() I/O and full App render;
    // on shared GitHub Actions runners the default 5s is too tight.
    testTimeout: 20000,
  },
});
