import { useState, useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigation } from "react-router";
import { NavProgress } from "@saloon/ui-shared";
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

const FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23567330'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='16' font-weight='700' fill='white' text-anchor='middle'>S</text></svg>";

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
      <body className="bg-slate-50 text-slate-900 min-h-screen font-sans antialiased">
        {timedOut ? (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Having trouble connecting</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-matcha-600 text-white text-sm font-medium cursor-pointer"
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
      <body className="bg-slate-50 text-slate-900 min-h-screen font-sans antialiased">
        <NavProgress loading={state !== "idle"} />
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
