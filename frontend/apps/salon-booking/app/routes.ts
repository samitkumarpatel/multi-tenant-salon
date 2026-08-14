import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route(":salon", "routes/$salon.tsx"),
] satisfies RouteConfig;
