import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("saloons", "routes/saloons.tsx"),
  route("customer", "routes/customer.tsx"),
  route("new", "routes/new.tsx"),
  route(":saloonId", "routes/layout.tsx", [
    index("routes/manage.tsx"),
    route("edit", "routes/edit.tsx"),
    route("services", "routes/services.tsx"),
    route("staff", "routes/staff.tsx"),
    route("website", "routes/website.tsx"),
    route("booking", "routes/booking.tsx"),
    route("coming-soon", "routes/coming-soon.tsx"),
    route("help", "routes/help.tsx"),
    route("website-preview", "routes/saloon-page.tsx"),
    route("setup", "routes/setup.tsx"),
  ]),
  route(":saloonId/book", "routes/book.tsx"),
] satisfies RouteConfig;
