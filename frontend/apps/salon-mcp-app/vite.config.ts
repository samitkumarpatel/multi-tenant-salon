import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: "../../../src/main/resources/static/mcp-app",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
  },
});
