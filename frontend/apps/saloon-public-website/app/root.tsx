import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

export function HydrateFallback() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='32' y2='32' gradientUnits='userSpaceOnUse'><stop offset='0' stop-color='%234ade80'/><stop offset='1' stop-color='%23059669'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(%23g)'/><line x1='12' y1='9' x2='26' y2='23' stroke='white' stroke-width='2.2' stroke-linecap='round'/><line x1='12' y1='23' x2='26' y2='9' stroke='white' stroke-width='2.2' stroke-linecap='round'/><circle cx='8' cy='9' r='4' fill='url(%23g)' stroke='white' stroke-width='1.8'/><circle cx='8' cy='23' r='4' fill='url(%23g)' stroke='white' stroke-width='1.8'/><circle cx='19' cy='16' r='3' fill='url(%23g)'/><circle cx='19' cy='16' r='1.4' fill='white'/></svg>" />
        <Links />
      </head>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          <p className="text-sm">Loading…</p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='32' y2='32' gradientUnits='userSpaceOnUse'><stop offset='0' stop-color='%234ade80'/><stop offset='1' stop-color='%23059669'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(%23g)'/><line x1='12' y1='9' x2='26' y2='23' stroke='white' stroke-width='2.2' stroke-linecap='round'/><line x1='12' y1='23' x2='26' y2='9' stroke='white' stroke-width='2.2' stroke-linecap='round'/><circle cx='8' cy='9' r='4' fill='url(%23g)' stroke='white' stroke-width='1.8'/><circle cx='8' cy='23' r='4' fill='url(%23g)' stroke='white' stroke-width='1.8'/><circle cx='19' cy='16' r='3' fill='url(%23g)'/><circle cx='19' cy='16' r='1.4' fill='white'/></svg>" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
