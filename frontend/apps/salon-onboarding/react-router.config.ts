import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  // Pre-render the public marketing routes to static HTML at build time so
  // link-preview crawlers (WhatsApp, Slack, iMessage, Facebook, X) — which do
  // not execute JS — receive fully-rendered <head> meta tags (title, OG image).
  prerender: ["/", "/new", "/explore"],
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
