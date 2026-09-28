import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route(":salonId", "routes/layout.tsx", [index("routes/dashboard.tsx")]),
] satisfies RouteConfig;
