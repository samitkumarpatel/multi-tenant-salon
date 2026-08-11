import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  index("routes/home.tsx"),
  route(":saloonId", "routes/saloon-layout.tsx", [
    index("routes/saloon-overview.tsx"),
    route("edit", "routes/saloon-edit.tsx"),
    route("services", "routes/saloon-services.tsx"),
    route("staff", "routes/saloon-staff.tsx"),
    route("holidays", "routes/saloon-holidays.tsx"),
    route("bookings", "routes/saloon-bookings.tsx"),
  ]),
] satisfies RouteConfig;
