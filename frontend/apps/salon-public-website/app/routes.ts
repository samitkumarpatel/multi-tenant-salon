import { type RouteConfig, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/website-shell.tsx", [
    route("shop/products/:handle", "routes/product.tsx"),
    route(":page?", "routes/home.tsx"),
  ]),
] satisfies RouteConfig;
