import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://agloom.sh",
  output: "static",
  outDir: "./dist",
  compressHTML: true,
  build: {
    inlineStylesheets: "never",
  },
});
