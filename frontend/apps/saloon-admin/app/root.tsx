import { useState, useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigation } from "react-router";
import { NavProgress } from "@saloon/ui-shared";
import "./app.css";

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:ital@1&display=swap",
    },
  ];
}

const FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='bg' x1='0' y1='0' x2='32' y2='32' gradientUnits='userSpaceOnUse'><stop offset='0%25' stop-color='%230f1e35'/><stop offset='100%25' stop-color='%2307111e'/></linearGradient><linearGradient id='bl' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%23dde4ec'/><stop offset='40%25' stop-color='%23ffffff'/><stop offset='100%25' stop-color='%238fa3b8'/></linearGradient><linearGradient id='gd' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%23d4a853'/><stop offset='50%25' stop-color='%23b8862a'/><stop offset='100%25' stop-color='%237a5418'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(%23bg)'/><line x1='7' y1='7' x2='27' y2='22' stroke='url(%23bl)' stroke-width='2.6' stroke-linecap='round'/><line x1='7' y1='25' x2='27' y2='10' stroke='url(%23bl)' stroke-width='2.6' stroke-linecap='round'/><circle cx='16.5' cy='16' r='2.4' fill='%23c4d0dc'/><circle cx='16.5' cy='16' r='1.1' fill='white'/><circle cx='7' cy='7' r='4.8' fill='url(%23gd)'/><circle cx='7' cy='7' r='3' fill='none' stroke='%23f0c96a' stroke-width='1.1'/><circle cx='7' cy='7' r='1.2' fill='%23f0c96a'/><circle cx='7' cy='25' r='4.8' fill='url(%23gd)'/><circle cx='7' cy='25' r='3' fill='none' stroke='%23f0c96a' stroke-width='1.1'/><circle cx='7' cy='25' r='1.2' fill='%23f0c96a'/></svg>";

export function HydrateFallback() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href={FAVICON} />
        <Links />
      </head>
      <body className="bg-cream text-slate-900 min-h-screen font-sans antialiased">
        {timedOut ? (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Having trouble connecting</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                The server isn't responding. Check your connection and try again.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer"
            >
              ↻ Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-400">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-matcha-600 rounded-full animate-spin" />
            <p className="text-sm">Loading…</p>
          </div>
        )}
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  const { state } = useNavigation();

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href={FAVICON} />
        <Meta />
        <Links />
      </head>
      <body className="bg-cream text-slate-900 min-h-screen font-sans antialiased">
        <NavProgress loading={state !== "idle"} />
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
