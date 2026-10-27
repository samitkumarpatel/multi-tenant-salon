import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  index("routes/home.tsx"),
  layout("routes/people-layout.tsx", [
    route("users", "routes/users.tsx"),
    route("users/detail", "routes/user-detail.tsx"),
    route("customers", "routes/customers.tsx"),
  ]),
  route(":salonId", "routes/salon-layout.tsx", [
    index("routes/salon-overview.tsx"),
    route("edit", "routes/salon-edit.tsx"),
    route("services", "routes/salon-services.tsx"),
    route("customers", "routes/salon-customers.tsx"),
    route("staff", "routes/salon-staff.tsx"),
    route("holidays", "routes/salon-holidays.tsx"),
    route("bookings", "routes/salon-bookings.tsx"),
  ]),
] satisfies RouteConfig;
