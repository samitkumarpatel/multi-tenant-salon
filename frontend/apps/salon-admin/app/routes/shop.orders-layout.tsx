import { Outlet, useOutletContext } from "react-router";
import type { ShopOutletContext } from "./shop";
import type { LayoutContext } from "~/lib/types";

export default function ShopOrdersLayout() {
  const { salon } = useOutletContext<LayoutContext>();
  return <Outlet context={{ salon } satisfies ShopOutletContext} />;
}
