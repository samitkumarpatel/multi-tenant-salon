import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("customer", "routes/customer.tsx"),
  route("new", "routes/new.tsx"),
] satisfies RouteConfig;
