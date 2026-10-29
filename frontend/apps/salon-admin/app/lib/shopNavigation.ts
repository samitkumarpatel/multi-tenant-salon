/** One shared mapping keeps sidebar selection and in-page tabs consistent on deep links. */
export const SHOP_SECTIONS = [
  { key: "orders", label: "Orders" },
  { key: "products", label: "Products" },
  { key: "inventory", label: "Inventory" },
  { key: "shipping", label: "Shipping methods" },
] as const;

export const PRODUCT_TABS = [
  { key: "products", label: "Products" },
  { key: "brands", label: "Brands" },
  { key: "categories", label: "Categories" },
] as const;
export const ORDER_TABS = [
  { key: "orders", label: "Orders" },
  { key: "returns", label: "Returns" },
  { key: "refunds", label: "Refunds" },
  { key: "credit-notes", label: "Credit Notes" },
] as const;

export function shopNavigation(pathname: string) {
  const match = pathname.match(/^\/[^/]+\/shop(?:\/([^/]+))?(?:\/|$)/);
  if (!match) return null;
  const page = match[1] || "orders";
  const tabs = PRODUCT_TABS.some((tab) => tab.key === page) ? PRODUCT_TABS
    : ORDER_TABS.some((tab) => tab.key === page) ? ORDER_TABS : [];
  const section = tabs === PRODUCT_TABS ? "products" : tabs === ORDER_TABS ? "orders"
    : page === "shipping" ? "shipping" : page === "inventory" ? "inventory" : null;
  if (!section) return null;
  return { section, page, tabs, label: [...SHOP_SECTIONS, ...PRODUCT_TABS, ...ORDER_TABS].find((item) => item.key === page)!.label };
}
