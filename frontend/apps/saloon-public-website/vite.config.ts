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
  server: {
    port: 5174,
    watch: {
      ignored: ["!**/node_modules/@saloon/**"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
