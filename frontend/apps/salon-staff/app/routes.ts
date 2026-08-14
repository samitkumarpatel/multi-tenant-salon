import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("portal", "routes/layout.tsx", [
    index("routes/dashboard.tsx"),
    route("appointments", "routes/appointments.tsx"),
    route("holidays", "routes/holidays.tsx"),
    route("profile", "routes/profile.tsx"),
  ]),
] satisfies RouteConfig;
