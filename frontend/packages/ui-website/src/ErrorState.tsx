import { Links, Scripts, isRouteErrorResponse, useRouteError } from "react-router";
import { ApiError, friendlyMessage } from "./apiError";

// Palette-agnostic (inline styles only) so it renders correctly in every app
// regardless of that app's Tailwind config.

function headingFor(error: unknown, explicit?: string): string {
  if (explicit) return explicit;
  const status = error instanceof ApiError ? error.status : undefined;
  if (status === 404) return "Not found";
  if (status === 401 || status === 403) return "Not authorized";
  return "Something went wrong";
}

export interface ErrorStateProps {
  /** An ApiError, a raw caught error, or any thrown value. */
  error: unknown;
  /** Overrides the auto-derived heading. */
  title?: string;
  /** Shows a "Retry" button wired to this handler. */
  onRetry?: () => void;
  /** Shows a "Home" link to this href. */
  homeHref?: string;
  /** Accent colour for buttons/links (defaults to a neutral slate). */
  accent?: string;
}

/** Full-height centered error card — for route error boundaries and
 *  "the page couldn't load" states. */
export function ErrorState({ error, title, onRetry, homeHref, accent = "#0f172a" }: ErrorStateProps) {
  const heading = headingFor(error, title);
  const message = friendlyMessage(error);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100dvh", padding: "0 24px", boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        background: "#faf9f7", color: "#1c1917",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
        <p style={{ fontSize: 44, margin: "0 0 12px" }} aria-hidden>✂️</p>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 8px" }}>{heading}</h1>
        <p style={{ fontSize: 14, color: "#78716c", margin: "0 0 22px", lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {homeHref && (
            <a
              href={homeHref}
              style={{
                padding: "9px 18px", borderRadius: 10, background: accent, color: "#fff",
                textDecoration: "none", fontSize: 14, fontWeight: 500,
              }}
            >
              ← Home
            </a>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: "9px 18px", borderRadius: 10, border: "1px solid #d6d3d1",
                background: "#fff", cursor: "pointer", fontSize: 14, color: "#374151",
              }}
            >
              ↻ Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ErrorNoteProps {
  error: unknown;
  /** Optional retry affordance shown as a text button on the right. */
  onRetry?: () => void;
  style?: React.CSSProperties;
}

/** Compact inline error strip — for forms and panels where the surrounding
 *  page is still usable. */
export function ErrorNote({ error, onRetry, style }: ErrorNoteProps) {
  if (error == null) return null;
  return (
    <div
      role="alert"
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "10px 12px", borderRadius: 8,
        background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
        fontSize: 13, lineHeight: 1.5, ...style,
      }}
    >
      <span aria-hidden style={{ flexShrink: 0 }}>⚠️</span>
      <span style={{ flex: 1 }}>{friendlyMessage(error)}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ flexShrink: 0, background: "none", border: "none", color: "#991b1b", fontWeight: 600, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** Drop-in React Router root error boundary. Apps that don't need custom
 *  wording can simply `export { RouteErrorBoundary as ErrorBoundary }`. */
export function RouteErrorBoundary() {
  const error = useRouteError();

  let title: string | undefined;
  let shown: unknown = error;
  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Not found" : error.status === 403 ? "Not authorized" : "Something went wrong";
    const data = error.data as Record<string, unknown> | string | undefined;
    shown =
      typeof data === "string"
        ? data
        : (data?.detail as string) ?? (data?.message as string) ?? error.statusText ?? title;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title ?? "Error"}</title>
        <Links />
      </head>
      <body style={{ margin: 0 }}>
        <ErrorState error={shown} title={title} onRetry={() => window.location.reload()} homeHref="/" />
        <Scripts />
      </body>
    </html>
  );
}
