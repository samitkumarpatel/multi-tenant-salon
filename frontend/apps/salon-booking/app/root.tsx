import { useState, useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigation, useRouteError, isRouteErrorResponse } from "react-router";
import "./app.css";

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2310B981'/%3E%3Ctext x='16' y='22' font-family='system-ui%2Csans-serif' font-size='16' font-weight='700' fill='white' text-anchor='middle'%3E%E2%9C%82%EF%B8%8F%3C/text%3E%3C/svg%3E";

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
      <body>
        {timedOut ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: 16, padding: "0 24px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
            <p style={{ fontSize: 40, margin: 0 }}>⚠️</p>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Having trouble connecting</p>
              <p style={{ fontSize: 12, color: "#78716c", margin: 0, lineHeight: 1.6 }}>The server isn't responding. Check your connection and try again.</p>
            </div>
            <button onClick={() => window.location.reload()} style={{ padding: "8px 18px", borderRadius: 10, background: "#10B981", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>
              ↻ Retry
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: 12, color: "#94a3b8", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ width: 24, height: 24, border: "2px solid #e2e8f0", borderTopColor: "#64748b", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 14, margin: 0 }}>Loading…</p>
          </div>
        )}
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
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "0 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 360, width: "100%" }}>
          <p style={{ fontSize: 48, margin: "0 0 16px" }}>✂️</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#0f172a" }}>
            {is404 ? "Booking link not found" : "Something went wrong"}
          </h1>
          <p style={{ fontSize: 14, color: "#78716c", margin: "0 0 24px", lineHeight: 1.6 }}>
            {is404
              ? "This booking link is invalid. Please check the URL and try again."
              : "We couldn't load this page. Please try again."}
          </p>
          {!is404 && (
            <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #d6d3d1", background: "white", cursor: "pointer", fontSize: 14, color: "#374151" }}>
              ↻ Retry
            </button>
          )}
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
        <link rel="icon" href={FAVICON} />
        <Meta />
        <Links />
      </head>
      <body>
        {state !== "idle" && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, background: "#10B981", zIndex: 9999, animation: "progress 1s ease-in-out infinite" }} />
        )}
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
