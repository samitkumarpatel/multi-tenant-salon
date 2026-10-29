import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("review/:token", "routes/review.tsx"),
  route(":salon", "routes/$salon.tsx"),
  route(":salon/feedback", "routes/$salon.feedback.tsx"),
  route(":salon/account", "routes/$salon.account.tsx"),
] satisfies RouteConfig;
