import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    dedupe: ["react", "react-dom", "react-router", "lucide-react"],
    alias: { "~": resolve(__dirname, "./app") },
  },
  server: {
    port: 5179,
    watch: { ignored: ["!**/node_modules/@salon/**"] },
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
});
