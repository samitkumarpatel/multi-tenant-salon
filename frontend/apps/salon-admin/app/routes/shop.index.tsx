import { Navigate } from "react-router";

/** `/shop` opens on the orders — the tab a salon works in every day. */
export default function ShopIndex() {
  return <Navigate to="orders" replace />;
}
