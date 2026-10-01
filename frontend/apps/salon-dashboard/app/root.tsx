import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigation } from "react-router";
import { NavProgress } from "@salon/ui-shared";
import "./app.css";

export { RouteErrorBoundary as ErrorBoundary } from "@salon/ui-shared";

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
  ];
}

// Shown while the first page's data loads (instead of a blank screen).
export function HydrateFallback() {
  return (
    <html lang="en">
      <head><meta charSet="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><Meta /><Links /></head>
      <body className="min-h-screen bg-cream font-sans text-slate-900 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3" role="status" aria-live="polite">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-matcha-600" />
          <p className="text-sm font-medium text-slate-500">Loading your salon desk…</p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  const { state } = useNavigation();
  return (
    <html lang="en">
      <head><meta charSet="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><Meta /><Links /></head>
      <body className="min-h-screen bg-cream font-sans text-slate-900 antialiased">
        <NavProgress loading={state !== "idle"} /><Outlet /><ScrollRestoration /><Scripts />
      </body>
    </html>
  );
}
