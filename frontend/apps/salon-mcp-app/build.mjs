// Builds one self-contained HTML file per Salon MCP App into the backend's static/mcp-app/
// folder. vite-plugin-singlefile inlines a single entry per build, so each app is its own pass.
import { build } from "vite";

const apps = ["explorer", "services", "team", "booking", "booking-stylist", "booking-week", "shop"];

for (const [index, app] of apps.entries()) {
  await build({
    configFile: new URL("./vite.config.ts", import.meta.url).pathname,
    logLevel: "warn",
    build: { emptyOutDir: index === 0, rollupOptions: { input: `${app}.html` } },
  });
  console.log(`built ${app}.html`);
}
