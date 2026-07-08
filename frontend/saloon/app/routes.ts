import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route(":saloonId", "routes/layout.tsx", [
    route("", "routes/manage.tsx"),
    route("edit", "routes/edit.tsx"),
    route("services", "routes/services.tsx"),
    route("staff", "routes/staff.tsx"),
  ]),
] satisfies RouteConfig;
