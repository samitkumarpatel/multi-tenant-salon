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
  optimizeDeps: {
    // The shared workspace UI package is served from source, so the startup scan misses what it imports
    // (Stripe, the MCP client). Discovering them on first use re-optimizes mid-session and splits React
    // into two copies (null useContext). Listing them keeps the first optimize complete.
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "lucide-react",
      "react-router/dom",
      "@stripe/stripe-js",
      "@modelcontextprotocol/client",
      "@modelcontextprotocol/ext-apps/app-bridge",
    ],
  },
  server: {
    port: 5179,
    watch: { ignored: ["!**/node_modules/@salon/**"] },
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
});
