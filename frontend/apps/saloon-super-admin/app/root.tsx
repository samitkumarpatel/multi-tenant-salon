import { useState, useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigation, useRouteError, isRouteErrorResponse } from "react-router";
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
        <Links />
      </head>
      <body>
        {timedOut ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: 16, padding: "0 24px", textAlign: "center", fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
            <p style={{ fontSize: 40, margin: 0 }}>⚠️</p>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Having trouble connecting</p>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.6 }}>The server isn't responding. Check your connection and try again.</p>
            </div>
            <button onClick={() => window.location.reload()} style={{ padding: "8px 18px", borderRadius: 8, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>
              ↻ Retry
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: 12, color: "#94a3b8", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ width: 24, height: 24, border: "2px solid #e2e8f0", borderTopColor: "#0f172a", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
            <p style={{ fontSize: 14, margin: 0 }}>Loading…</p>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{is404 ? "Not found" : "Error"}</title>
        <Links />
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: "0 24px" }}>
          <p style={{ fontSize: 48, margin: "0 0 16px" }}>⚙️</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{is404 ? "Page not found" : "Something went wrong"}</h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px", lineHeight: 1.6 }}>
            {is404 ? "This page doesn't exist." : "We couldn't load this page. Please try again."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <a href="/" style={{ padding: "10px 20px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontSize: 14 }}>← Home</a>
            {!is404 && (
              <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontSize: 14 }}>
                ↻ Retry
              </button>
            )}
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { state } = useNavigation();

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='bg' x1='0' y1='0' x2='32' y2='32' gradientUnits='userSpaceOnUse'><stop offset='0%25' stop-color='%230f1e35'/><stop offset='100%25' stop-color='%2307111e'/></linearGradient><linearGradient id='bl' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%23dde4ec'/><stop offset='40%25' stop-color='%23ffffff'/><stop offset='100%25' stop-color='%238fa3b8'/></linearGradient><linearGradient id='gd' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%23d4a853'/><stop offset='50%25' stop-color='%23b8862a'/><stop offset='100%25' stop-color='%237a5418'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(%23bg)'/><line x1='7' y1='7' x2='27' y2='22' stroke='url(%23bl)' stroke-width='2.6' stroke-linecap='round'/><line x1='7' y1='25' x2='27' y2='10' stroke='url(%23bl)' stroke-width='2.6' stroke-linecap='round'/><circle cx='16.5' cy='16' r='2.4' fill='%23c4d0dc'/><circle cx='16.5' cy='16' r='1.1' fill='white'/><circle cx='7' cy='7' r='4.8' fill='url(%23gd)'/><circle cx='7' cy='7' r='3' fill='none' stroke='%23f0c96a' stroke-width='1.1'/><circle cx='7' cy='7' r='1.2' fill='%23f0c96a'/><circle cx='7' cy='25' r='4.8' fill='url(%23gd)'/><circle cx='7' cy='25' r='3' fill='none' stroke='%23f0c96a' stroke-width='1.1'/><circle cx='7' cy='25' r='1.2' fill='%23f0c96a'/></svg>" />
        <Meta />
        <Links />
      </head>
      <body>
        <NavProgress loading={state !== "idle"} />
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
