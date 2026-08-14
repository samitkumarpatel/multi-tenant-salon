import { type RouteConfig, layout, index, route } from "@react-router/dev/routes";

export default [
  layout("routes/website-shell.tsx", [
    index("routes/home.tsx"),
    route("book", "routes/home.tsx", { id: "routes/book" }),
    route("shop", "routes/home.tsx", { id: "routes/shop" }),
    route("membership", "routes/home.tsx", { id: "routes/membership" }),
    route("loyalty", "routes/home.tsx", { id: "routes/loyalty" }),
  ]),
] satisfies RouteConfig;
