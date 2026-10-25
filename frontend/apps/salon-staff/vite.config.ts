import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const wellKnownBypass = {
  name: "well-known-bypass",
  configureServer(server: import("vite").ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith("/.well-known/") || req.url === "/favicon.ico") {
        res.statusCode = 204;
        res.end();
        return;
      }
      next();
    });
  },
};

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [wellKnownBypass, tailwindcss(), reactRouter()],
  resolve: {
    dedupe: ["react", "react-dom", "react-router", "lucide-react"],
    alias: {
      "~": resolve(__dirname, "./app"),
    },
  },
  optimizeDeps: {
    include: [
      // Imported by @salon/ui-website (StripeCheckout) only once a checkout opens. The workspace package is
      // served from source, so the startup scan misses it; discovering it later re-optimizes
      // mid-session and splits React into two copies (null useContext).
      "@stripe/stripe-js",
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "lucide-react",
      "react-router/dom",
      // Imported by @salon/ui-website's McpAppFrame; the workspace package is served from
      // source, so the startup scan misses these. Discovering them on first page load
      // re-optimizes mid-session and splits React into two copies (null useContext).
      "@modelcontextprotocol/client",
      "@modelcontextprotocol/ext-apps/app-bridge",
    ],
  },
  server: {
    port: 5178,
    watch: {
      ignored: ["!**/node_modules/@salon/**"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
