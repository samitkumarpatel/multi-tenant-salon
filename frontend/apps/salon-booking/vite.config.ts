import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

const devMiddleware = {
  name: "dev-middleware",
  configureServer(server: import("vite").ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? "/";
      if (url.startsWith("/.well-known/") || url === "/favicon.ico") {
        res.statusCode = 204;
        res.end();
        return;
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
    port: 5177,
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
