import { build, loadEnv } from "vite";
import { writeFile } from "node:fs/promises";
const local = loadEnv("production", process.cwd(), "VITE_");
await build({
  configFile: false,
  define: {
    __PUBLIC_API_BASE__: JSON.stringify(process.env.VITE_API_BASE_URL || local.VITE_API_BASE_URL || "https://api.salonsaas.org"),
    __SALON_DOMAIN__: JSON.stringify(process.env.VITE_SALON_DOMAIN || local.VITE_SALON_DOMAIN || "salonsaas.org"),
  },
  build: { outDir: "build/client", emptyOutDir: false, minify: false, target: "es2022",
    lib: { entry: "worker.ts", formats: ["es"], fileName: () => "_worker.js" },
    rollupOptions: { output: { inlineDynamicImports: true } } },
});
await writeFile("build/client/_routes.json", JSON.stringify({ version: 1,
  include: ["/shop", "/shop/", "/shop/products/*", "/sitemap.xml", "/robots.txt"], exclude: [] }, null, 2));
