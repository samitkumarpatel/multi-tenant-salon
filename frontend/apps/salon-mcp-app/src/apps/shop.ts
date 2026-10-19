import { button, emptyState, h } from "../shared/dom";
import { money, plural } from "../shared/format";
import { appHeader, SalonApp, statusLine, type Data } from "../shared/runtime";

type Variant = { id: number; label?: string; price?: number; compareAtPrice?: number; currency?: string; maxQuantity: number };
type Product = {
  id: number; name: string; description?: string; brandId?: number; brandName?: string;
  categoryId?: number; categoryName?: string; images?: string[]; variants: Variant[];
};
type ShopData = Data & {
  categories?: { id: number; name: string }[];
  brands?: { id: number; name: string; logoUrl?: string }[];
  items?: Product[];
  categoryId?: number;
  brandId?: number;
  productId?: number;
  query?: string;
};
type CartLine = { product: Product; variant: Variant; quantity: number };
type Screen = "browse" | "product" | "cart" | "checkout" | "review" | "done";

const draftKeys = ["customerName", "customerEmail", "customerPhone", "addressLine1", "addressLine2", "city", "state", "zipCode", "country"] as const;
type Draft = Record<(typeof draftKeys)[number], string>;

const state = {
  screen: "browse" as Screen,
  categoryId: undefined as number | undefined,
  brandId: undefined as number | undefined,
  query: "",
  sort: "featured" as "featured" | "price-asc" | "price-desc",
  product: undefined as Product | undefined,
  variantId: undefined as number | undefined,
  imageIndex: 0,
  quantity: 1,
  cart: new Map<number, CartLine>(),
  draft: Object.fromEntries(draftKeys.map((k) => [k, ""])) as Draft,
  order: undefined as Record<string, any> | undefined,
  error: undefined as string | undefined,
  seeded: false,
};

const rt: SalonApp<ShopData> = new SalonApp<ShopData>("Salon Shop", "salon_shop", (rt) => {
  const data = rt.data!;
  const products = data.items ?? [];
  if (!state.seeded) seed(data, products);
  const header = h("div", { class: "shop-head" },
    appHeader("SHOP", data.salonName ?? "Salon", plural(products.length, "product")),
    state.screen !== "done" ? button(`🛒 ${cartCount() || ""}`.trim(), () => go("cart"), `cart-button${cartCount() ? " filled" : ""}`,
      { "aria-label": `Cart, ${plural(cartCount(), "item")}` }) : null);
  const screens: Record<Screen, () => Node | null> = {
    browse: () => browse(data, products),
    product: () => state.product ? productDetail(state.product) : browse(data, products),
    cart: cartView,
    checkout: checkoutForm,
    review: review,
    done: confirmation,
  };
  return [header, ...statusLine(rt), screens[state.screen]()];
});

function seed(data: ShopData, products: Product[]) {
  state.seeded = true;
  state.categoryId = data.categoryId;
  state.brandId = data.brandId;
  state.query = data.query ?? "";
  const focus = products.find((p) => p.id === data.productId);
  if (focus) openProduct(focus, false);
}

function go(screen: Screen) {
  state.screen = screen;
  state.error = undefined;
  rt.render();
  window.scrollTo({ top: 0 });
}

function cartCount() {
  return [...state.cart.values()].reduce((sum, line) => sum + line.quantity, 0);
}

function cartTotal() {
  const lines = [...state.cart.values()];
  return { amount: lines.reduce((sum, l) => sum + (l.variant.price ?? 0) * l.quantity, 0), currency: lines[0]?.variant.currency };
}

function cartContext() {
  const lines = [...state.cart.values()].map((l) => `${l.quantity}× ${l.product.name}${l.variant.label ? ` (${l.variant.label})` : ""}`);
  rt.context(lines.length ? `The visitor's shop cart (not ordered yet): ${lines.join(", ")}.` : "The visitor is browsing the shop; the cart is empty.");
}

function priceLabel(product: Product) {
  const prices = product.variants.map((v) => v.price).filter((p): p is number => typeof p === "number");
  if (!prices.length) return "";
  const min = Math.min(...prices);
  const label = money(min, product.variants[0]?.currency);
  return prices.some((p) => p !== min) ? `From ${label}` : label;
}

function inStock(product: Product) {
  return product.variants.some((v) => v.maxQuantity > 0);
}

// ── Browse ────────────────────────────────────────────────────────────────

function visibleProducts(products: Product[]) {
  const q = state.query.trim().toLowerCase();
  const list = products.filter((p) => (!state.categoryId || p.categoryId === state.categoryId)
    && (!state.brandId || p.brandId === state.brandId)
    && (!q || `${p.name} ${p.description ?? ""} ${p.brandName ?? ""} ${p.categoryName ?? ""}`.toLowerCase().includes(q)));
  const min = (p: Product) => Math.min(...p.variants.map((v) => v.price ?? Infinity));
  if (state.sort === "price-asc") list.sort((a, b) => min(a) - min(b));
  if (state.sort === "price-desc") list.sort((a, b) => min(b) - min(a));
  return list;
}

function browse(data: ShopData, products: Product[]) {
  if (!products.length) return emptyState("The shop is empty right now", "Check back soon for new products.");
  const grid = h("div", { class: "product-grid-host" }, productGrid(products));
  const chip = (label: string, active: boolean, onClick: () => void) => button(label, onClick, `chip${active ? " active" : ""}`, { "aria-pressed": String(active) });
  const categories = data.categories ?? [];
  const brands = data.brands ?? [];
  return h("div", { class: "stack" },
    h("div", { class: "toolbar" },
      h("input", {
        class: "field search", type: "search", placeholder: "Search products…", value: state.query, "aria-label": "Search products",
        onInput: (event: Event) => { state.query = (event.target as HTMLInputElement).value; grid.replaceChildren(productGrid(products)); },
      }),
      h("select", {
        class: "field compact", "aria-label": "Sort products",
        onChange: (event: Event) => { state.sort = (event.target as HTMLSelectElement).value as typeof state.sort; rt.render(); },
      },
      h("option", { value: "featured", selected: state.sort === "featured" }, "Featured"),
      h("option", { value: "price-asc", selected: state.sort === "price-asc" }, "Price: low to high"),
      h("option", { value: "price-desc", selected: state.sort === "price-desc" }, "Price: high to low"))),
    categories.length > 1 ? h("div", { class: "chip-row scroll" },
      chip("All", !state.categoryId, () => { state.categoryId = undefined; rt.render(); }),
      categories.map((c) => chip(c.name, state.categoryId === c.id, () => { state.categoryId = c.id; rt.render(); }))) : null,
    brands.length > 1 ? h("div", { class: "chip-row scroll" },
      chip("All brands", !state.brandId, () => { state.brandId = undefined; rt.render(); }),
      brands.map((b) => chip(b.name, state.brandId === b.id, () => { state.brandId = b.id; rt.render(); }))) : null,
    grid);
}

function productGrid(products: Product[]) {
  const list = visibleProducts(products);
  if (!list.length) {
    return emptyState("No products match", "Try another search or filter.",
      button("Clear filters", () => { state.query = ""; state.categoryId = undefined; state.brandId = undefined; rt.render(); }, "btn"));
  }
  return h("div", { class: "product-grid" }, list.map((p) => button([
    h("div", { class: "product-image" },
      p.images?.[0] ? h("img", { src: p.images[0], alt: "", loading: "lazy" }) : h("span", { class: "product-placeholder", "aria-hidden": "true" }, "🛍️"),
      !inStock(p) ? h("span", { class: "badge muted-badge" }, "Sold out") : null,
      p.variants.some((v) => v.compareAtPrice && v.price && v.compareAtPrice > v.price) ? h("span", { class: "badge" }, "Sale") : null),
    h("div", { class: "product-body" },
      p.brandName ? h("span", { class: "row-meta" }, p.brandName) : null,
      h("span", { class: "row-title" }, p.name),
      h("span", { class: "price" }, priceLabel(p))),
  ], () => openProduct(p), "product-card")));
}

function openProduct(product: Product, render = true) {
  state.product = product;
  state.variantId = (product.variants.find((v) => v.maxQuantity > 0) ?? product.variants[0])?.id;
  state.imageIndex = 0;
  state.quantity = 1;
  state.screen = "product";
  rt.context(`The visitor is looking at ${product.name} in the shop${priceLabel(product) ? ` (${priceLabel(product)})` : ""}.`);
  if (render) go("product");
}

// ── Product ───────────────────────────────────────────────────────────────

function productDetail(product: Product) {
  const variant = product.variants.find((v) => v.id === state.variantId) ?? product.variants[0]!;
  const images = product.images ?? [];
  const image = images[state.imageIndex] ?? images[0];
  const inCart = state.cart.get(variant.id)?.quantity ?? 0;
  const maxMore = Math.max(0, variant.maxQuantity - inCart);
  state.quantity = Math.min(Math.max(1, state.quantity), Math.max(1, maxMore));
  return h("article", { class: "stack" },
    button("‹ Back to shop", () => go("browse"), "link-button"),
    h("div", { class: "product-detail" },
      h("div", { class: "gallery" },
        h("div", { class: "gallery-main" }, image ? h("img", { src: image, alt: product.name }) : h("span", { class: "product-placeholder", "aria-hidden": "true" }, "🛍️")),
        images.length > 1 ? h("div", { class: "gallery-thumbs" }, images.map((url, index) => button(h("img", { src: url, alt: "", loading: "lazy" }),
          () => { state.imageIndex = index; rt.render(); }, `gallery-thumb${index === state.imageIndex ? " selected" : ""}`, { "aria-label": `Image ${index + 1}` }))) : null),
      h("div", { class: "stack" },
        product.brandName ? h("span", { class: "eyebrow" }, product.brandName.toUpperCase()) : null,
        h("h2", { class: "product-title" }, product.name),
        h("div", { class: "price-line" },
          h("span", { class: "price lg" }, money(variant.price, variant.currency)),
          variant.compareAtPrice && variant.price && variant.compareAtPrice > variant.price
            ? h("s", { class: "muted" }, money(variant.compareAtPrice, variant.currency)) : null),
        product.variants.length > 1 ? h("div", { class: "stack tight" },
          h("span", { class: "row-meta" }, "Option"),
          h("div", { class: "chip-row" }, product.variants.map((v) => button(v.label || `Option ${v.id}`, () => {
            state.variantId = v.id;
            state.quantity = 1;
            rt.render();
          }, `chip${v.id === variant.id ? " active" : ""}${v.maxQuantity ? "" : " sold-out"}`, { "aria-pressed": String(v.id === variant.id) })))) : null,
        h("p", { class: "row-meta" }, variant.maxQuantity === 0 ? "Sold out" : variant.maxQuantity < 5 ? `Only ${variant.maxQuantity} left` : "In stock"),
        maxMore > 0 ? h("div", { class: "buy-row" },
          stepper(state.quantity, maxMore, (q) => { state.quantity = q; rt.render(); }),
          button("Add to cart", () => addToCart(product, variant, state.quantity), "btn primary")) : null,
        inCart ? h("p", { class: "muted" }, `${inCart} in your cart · `, button("View cart", () => go("cart"), "link-button")) : null,
        product.description ? h("p", { class: "row-description" }, product.description) : null)));
}

function stepper(value: number, max: number, onChange: (value: number) => void) {
  return h("div", { class: "qty", role: "group", "aria-label": "Quantity" },
    button("−", () => onChange(Math.max(1, value - 1)), "qty-btn", { disabled: value <= 1, "aria-label": "Decrease" }),
    h("span", { class: "qty-value", "aria-live": "polite" }, String(value)),
    button("+", () => onChange(Math.min(max, value + 1)), "qty-btn", { disabled: value >= max, "aria-label": "Increase" }));
}

function addToCart(product: Product, variant: Variant, quantity: number) {
  const line = state.cart.get(variant.id);
  state.cart.set(variant.id, { product, variant, quantity: Math.min(variant.maxQuantity, (line?.quantity ?? 0) + quantity) });
  state.quantity = 1;
  cartContext();
  rt.render();
}

// ── Cart & checkout ───────────────────────────────────────────────────────

function cartView() {
  const lines = [...state.cart.values()];
  if (!lines.length) {
    return h("div", { class: "stack" }, emptyState("Your cart is empty", "Add something from the shop.", button("Browse products", () => go("browse"), "btn primary")));
  }
  const total = cartTotal();
  return h("div", { class: "stack" },
    button("‹ Keep shopping", () => go("browse"), "link-button"),
    h("h2", { class: "section-title" }, `Your cart · ${plural(cartCount(), "item")}`),
    h("div", { class: "list" }, lines.map((line) => h("div", { class: "row cart-line" },
      line.product.images?.[0] ? h("img", { class: "cart-thumb", src: line.product.images[0], alt: "" }) : h("span", { class: "cart-thumb product-placeholder" }, "🛍️"),
      h("div", { class: "row-body" },
        h("span", { class: "row-title" }, line.product.name),
        line.variant.label ? h("span", { class: "row-meta" }, line.variant.label) : null,
        h("span", { class: "row-meta" }, money(line.variant.price, line.variant.currency))),
      h("div", { class: "cart-controls" },
        stepper(line.quantity, line.variant.maxQuantity, (q) => { line.quantity = q; cartContext(); rt.render(); }),
        button("Remove", () => { state.cart.delete(line.variant.id); cartContext(); rt.render(); }, "link-button"))))),
    h("div", { class: "total-row" }, h("span", null, "Subtotal"), h("strong", null, money(total.amount, total.currency))),
    h("p", { class: "muted" }, "Shipping and payment are confirmed by the salon after you order."),
    button("Checkout", () => go("checkout"), "btn primary wide"));
}

function checkoutForm() {
  const field = (key: (typeof draftKeys)[number], props: Record<string, unknown>) => h("input", {
    class: "field", name: key, value: state.draft[key], ...props,
    onInput: (event: Event) => { state.draft[key] = (event.target as HTMLInputElement).value; },
  });
  const error = h("p", { class: "error hidden" }, "Enter your name and email address.");
  const form = h("form", {
    class: "booking-form",
    onSubmit: (event: Event) => {
      event.preventDefault();
      for (const key of draftKeys) state.draft[key] = state.draft[key].trim();
      if (!state.draft.customerName || !state.draft.customerEmail || !form.reportValidity()) {
        error.classList.remove("hidden");
        return;
      }
      go("review");
    },
  },
  h("h3", { class: "section-title" }, "Contact"),
  field("customerName", { placeholder: "Full name", autocomplete: "name", required: true }),
  h("div", { class: "field-pair" },
    field("customerEmail", { type: "email", placeholder: "Email", autocomplete: "email", required: true }),
    field("customerPhone", { type: "tel", placeholder: "Phone (optional)", autocomplete: "tel" })),
  h("h3", { class: "section-title" }, "Shipping address (optional — leave blank to collect in the salon)"),
  field("addressLine1", { placeholder: "Address line 1", autocomplete: "address-line1" }),
  field("addressLine2", { placeholder: "Address line 2", autocomplete: "address-line2" }),
  h("div", { class: "field-pair" },
    field("city", { placeholder: "City", autocomplete: "address-level2" }),
    field("zipCode", { placeholder: "Postal code", autocomplete: "postal-code" })),
  h("div", { class: "field-pair" },
    field("state", { placeholder: "State / region", autocomplete: "address-level1" }),
    field("country", { placeholder: "Country", autocomplete: "country-name" })),
  error,
  h("div", { class: "review-actions" },
    button("Back to cart", () => go("cart"), "btn"),
    h("button", { type: "submit", class: "btn primary" }, "Review order")));
  return h("section", { class: "panel" }, h("h2", { class: "section-title" }, "Checkout"), form);
}

function review() {
  const total = cartTotal();
  const d = state.draft;
  const address = [d.addressLine1, d.addressLine2, d.city, d.state, d.zipCode, d.country].filter(Boolean).join(", ");
  return h("section", { class: "panel" },
    h("h2", { class: "section-title" }, "Review your order"),
    h("ul", { class: "mini-list" }, [...state.cart.values()].map((l) => h("li", null,
      h("span", null, `${l.quantity}× ${l.product.name}${l.variant.label ? ` (${l.variant.label})` : ""}`),
      h("span", null, money((l.variant.price ?? 0) * l.quantity, l.variant.currency))))),
    h("div", { class: "total-row" }, h("span", null, "Subtotal"), h("strong", null, money(total.amount, total.currency))),
    h("dl", { class: "review-summary" },
      ([["Name", d.customerName], ["Email", d.customerEmail], ["Phone", d.customerPhone], ["Ship to", address || "Collect in the salon"]] as [string, string][])
        .filter(([, v]) => v).map(([label, value]) => h("div", { class: "review-row" }, h("dt", null, label), h("dd", null, value)))),
    state.error ? h("p", { class: "error", role: "alert" }, state.error) : null,
    h("p", { class: "muted" }, "Tap Place order to send this order to the salon."),
    h("div", { class: "review-actions" },
      button("Edit details", () => go("checkout"), "btn"),
      button(rt.busy ? "Placing order…" : "Place order", () => void placeOrder(), "btn primary", { disabled: rt.busy })));
}

async function placeOrder() {
  if (rt.busy) return;
  state.error = undefined;
  const d = state.draft;
  const outcome = await rt.act<{ order?: Record<string, any> }>("create_shop_order", {
    items: [...state.cart.values()].map((l) => ({ variantId: l.variant.id, quantity: l.quantity })),
    customerName: d.customerName, customerEmail: d.customerEmail, customerPhone: d.customerPhone,
    addressLine1: d.addressLine1, addressLine2: d.addressLine2, city: d.city, state: d.state, zipCode: d.zipCode, country: d.country,
    customerConfirmed: true,
  });
  if (outcome.ok) {
    state.order = outcome.data.order ?? { message: "Order placed." };
    state.cart.clear();
    rt.context(`The visitor just placed shop order ${state.order.orderNumber ?? ""} (status ${state.order.status ?? "NEW"}).`);
    go("done");
  } else {
    state.error = outcome.error;
    rt.render();
  }
}

function confirmation() {
  const order = state.order ?? {};
  const checkout = typeof order.checkoutUrl === "string" ? order.checkoutUrl : undefined;
  return h("section", { class: "panel confirmation" },
    h("div", { class: "confirmation-badge", "aria-hidden": "true" }, "✓"),
    h("h2", { class: "section-title" }, checkout ? "Almost done — payment needed" : "Order placed"),
    order.orderNumber ? h("p", { class: "detail" }, `Order ${order.orderNumber}`) : null,
    Array.isArray(order.lines) && order.lines.length ? h("ul", { class: "mini-list" }, order.lines.map((l: Record<string, any>) => h("li", null,
      h("span", null, `${l.quantity}× ${l.productName}${l.variantLabel ? ` (${l.variantLabel})` : ""}`),
      h("span", null, money(l.lineTotal, order.currency))))) : null,
    order.subtotal != null ? h("div", { class: "total-row" }, h("span", null, "Total"), h("strong", null, money(order.subtotal, order.currency))) : null,
    h("p", { class: "muted" }, "A confirmation email is on its way."),
    checkout ? button("Continue to payment", () => rt.openLink(checkout), "btn primary") : null,
    button("Back to the shop", () => { state.order = undefined; go("browse"); }, "btn"));
}

rt.start();
