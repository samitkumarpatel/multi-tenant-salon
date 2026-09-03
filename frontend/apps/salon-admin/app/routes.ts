import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("salons", "routes/salons.tsx"),
  route("customer", "routes/customer.tsx"),
  route("new", "routes/new.tsx"),
  route(":salonId", "routes/layout.tsx", [
    index("routes/manage.tsx"),
    route("edit", "routes/edit.tsx"),
    route("services", "routes/services.tsx"),
    route("staff", "routes/staff.tsx"),
    route("website", "routes/website.tsx"),
    route("booking", "routes/booking.tsx"),
    route("shop", "routes/shop.tsx", [
      index("routes/shop.products.tsx"),
      route("brands", "routes/shop.brands.tsx"),
      route("categories", "routes/shop.categories.tsx"),
      route("inventory", "routes/shop.inventory.tsx"),
      route("orders", "routes/shop.orders-layout.tsx", [
        index("routes/shop.orders.tsx"),
        route("invoices", "routes/shop.invoices.tsx"),
        route("refunds", "routes/shop.refunds.tsx"),
        route("credit-notes", "routes/shop.credit-notes.tsx"),
        route(":orderId", "routes/shop.order.tsx"),
      ]),
    ]),
    route("analytics", "routes/analytics.tsx"),
    route("holiday", "routes/holiday.tsx"),
    route("coming-soon", "routes/coming-soon.tsx"),
    route("help", "routes/help.tsx"),
    route("website-preview", "routes/salon-page.tsx"),
    route("setup", "routes/setup.tsx"),
  ]),
  route(":salonId/book", "routes/book.tsx"),
] satisfies RouteConfig;
