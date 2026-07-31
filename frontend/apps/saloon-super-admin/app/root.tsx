import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

export default function App() {
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
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
