import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
    },
  ];
}

export function HydrateFallback() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Links />
      </head>
      <body className="bg-matcha-50 text-slate-900 min-h-screen font-sans antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-matcha-600 rounded-full animate-spin" />
          <p className="text-sm">Loading…</p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta />
        <Links />
      </head>
      <body className="bg-matcha-50 text-slate-900 min-h-screen font-sans antialiased">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
