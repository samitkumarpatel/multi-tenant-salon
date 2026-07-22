import { type RouteConfig, layout, index, route } from "@react-router/dev/routes";

export default [
  layout("routes/website-shell.tsx", [
    index("routes/home.tsx"),
    route("book", "routes/home.tsx"),
    route("shop", "routes/home.tsx"),
    route("membership", "routes/home.tsx"),
    route("loyalty", "routes/home.tsx"),
  ]),
] satisfies RouteConfig;
