import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

const devMiddleware = {
  name: "dev-middleware",
  configureServer(server: import("vite").ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? "/";
      // Silence browser noise
      if (url.startsWith("/.well-known/") || url === "/favicon.ico") {
        res.statusCode = 204;
        res.end();
        return;
      }
      // Rewrite /<slug>[?...] → /?slug=<slug>[&...] so dev works like production subdomains
      const match = url.match(/^\/([a-z0-9-]+)(\/?)(\?.*)?$/i);
      if (match && !url.startsWith("/@") && !url.startsWith("/api")) {
        const slug = match[1];
        const qs = match[3] ?? "";
        const sep = qs ? "&" : "?";
        req.url = `/${qs}${sep}slug=${slug}`;
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [devMiddleware, tailwindcss(), reactRouter()],
  resolve: {
    dedupe: ["react", "react-dom", "react-router", "lucide-react"],
  },
  optimizeDeps: {
    // The shared workspace UI package is served from source and can leave
    // stale prebundled React/React Router chunks after dependency changes.
    // Rebuild the optimizer cache on startup so hooks share the app renderer.
    force: true,
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "lucide-react",
    ],
  },
  server: {
    port: 5174,
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
