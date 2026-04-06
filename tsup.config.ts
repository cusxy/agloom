import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "cli/index": "src/cli/index.tsx" },
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  platform: "node",
  // Bundle the workspace package into the CLI so it ships as part of the
  // published tarball (fat package). Its own runtime deps (prettier,
  // markdownlint-cli2, prettier-plugin-toml) are listed in agloom's
  // dependencies and stay external.
  noExternal: ["@agloom/markdown-tools"],
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: false,
  // shebang is preserved from src/cli/index.tsx by esbuild
});
