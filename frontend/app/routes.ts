import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("customer", "routes/customer.tsx"),
  route("new", "routes/new.tsx"),
  route(":saloonId", "routes/layout.tsx", [
    index("routes/manage.tsx"),
    route("edit", "routes/edit.tsx"),
    route("services", "routes/services.tsx"),
    route("staff", "routes/staff.tsx"),
    route("c", "routes/saloon-page.tsx"),
  ]),
] satisfies RouteConfig;
