import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Loader2, Minus, Plus, Search, ShoppingBag, Trash2, User, X,
} from "lucide-react";
import { apiFetch, API_BASE } from "./api";
import { friendlyMessage } from "./apiError";
import { formatPrice } from "./constants";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import { contrastText, fontStack, isLightColor, loadGoogleFont } from "./theme";
import { useCart } from "./shopCart";
import PhoneInput from "./PhoneInput";
import type { CartLine, Country, Salon, ShopBrand, ShopCategory, ShopOrder, ShopProduct, ShopShippingAddress, ShopVariant, WebsiteTheme } from "./types";

export interface ShopViewProps {
  salon: Salon;
  theme: WebsiteTheme;
  /** Build the href for a page key (for the header's other nav links). */
  getPagePath?: (page: string) => string;
  /** Navigate to another page key, or null to return to the home page. */
  onNavigate?: (page: string | null) => void;
}

type Step = "browse" | "checkout" | "done";

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function ShopView({ salon, theme: themeProp, getPagePath, onNavigate }: ShopViewProps) {
  const theme = themeProp;
  const fontStackCss = fontStack(theme.fontFamily);
  const heroLight = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);
  const sub = heroLight ? "#475569" : "#94A3B8";
  const cardBg = heroLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)";
  const cardBorder = heroLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)";

  const salonKey = String(salon.id);
  const cart = useCart(salonKey);

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [brands, setBrands] = useState<ShopBrand[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);

  useEffect(() => { loadGoogleFont(theme.fontFamily); }, [theme.fontFamily]);

  useEffect(() => {
    apiFetch<Country[]>(`${API_BASE}/api/salon-utility/countries`).then(setCountries).catch(() => {});
    apiFetch<ShopBrand[]>(`${API_BASE}/api/salon/${salon.id}/shop/brands`).then(setBrands).catch(() => {});
    apiFetch<ShopCategory[]>(`${API_BASE}/api/salon/${salon.id}/shop/categories`).then(setCategories).catch(() => {});
  }, [salon.id]);

  const [picked, setPicked] = useState<Record<number, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ShopProduct | null>(null);
  const [step, setStep] = useState<Step>("browse");
  const [placed, setPlaced] = useState<ShopOrder | null>(null);
  const [search, setSearch] = useState("");
  const [activeBrandId, setActiveBrandId] = useState<number | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [sort, setSort] = useState<"default" | "price-asc" | "price-desc" | "name-asc">("default");

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.brandName ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => (a.variants[0]?.price ?? 0) - (b.variants[0]?.price ?? 0));
    if (sort === "price-desc") list = [...list].sort((a, b) => (b.variants[0]?.price ?? 0) - (a.variants[0]?.price ?? 0));
    if (sort === "name-asc") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, search, sort]);

  // Re-fetch products from API whenever brand or category filter changes
  useEffect(() => {
    let alive = true;
    const isInitial = activeBrandId === null && activeCategoryId === null;
    if (isInitial) {
      setLoading(true);
    } else {
      setFilterLoading(true);
    }
    const params = new URLSearchParams();
    if (activeBrandId != null) params.set("brandId", String(activeBrandId));
    if (activeCategoryId != null) params.set("categoryId", String(activeCategoryId));
    const qs = params.toString();
    apiFetch<ShopProduct[]>(`${API_BASE}/api/salon/${salon.id}/shop/products${qs ? `?${qs}` : ""}`)
      .then((data) => {
        if (!alive) return;
        setProducts(data);
        setPicked((prev) => {
          const next: Record<number, number> = { ...prev };
          for (const p of data) {
            if (!next[p.id] || !p.variants.find((v) => v.id === next[p.id])) {
              const first = p.variants[0];
              if (first) next[p.id] = first.id;
            }
          }
          return next;
        });
        setLoadError(null);
      })
      .catch((e) => alive && setLoadError(friendlyMessage(e)))
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setFilterLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [salon.id, activeBrandId, activeCategoryId]);

  const goHome = () => onNavigate?.(null);

  // ── Sub-views ──────────────────────────────────────────────────────────────

  const shell = (body: React.ReactNode) => (
    <div className="min-h-[100dvh] flex flex-col" style={{ fontFamily: fontStackCss, backgroundColor: theme.heroBg }}>
      <SiteHeader
        salon={salon}
        theme={theme}
        current="shop"
        onBack={goHome}
        getPagePath={getPagePath}
        onNavigate={(page) => onNavigate?.(page)}
        cartCount={cart.count}
        onCartOpen={() => setCartOpen(true)}
        onAvatarOpen={() => setAvatarOpen(true)}
      />
      <main className="flex-1">{body}</main>
      <SiteFooter salon={salon} theme={theme} current="shop" onBack={goHome} getPagePath={getPagePath} />
    </div>
  );

  if (step === "done" && placed) {
    return shell(
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ backgroundColor: `${theme.accentColor}22`, border: `1px solid ${theme.accentColor}44` }}
        >
          <Check className="w-8 h-8" style={{ color: theme.accentColor }} />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-2" style={{ color: theme.heroTextColor }}>
          Order placed
        </h1>
        <p className="text-sm mb-1" style={{ color: sub }}>
          Thanks, {placed.customerName.split(" ")[0]}! Your order number is
        </p>
        <p className="text-lg font-bold mb-6" style={{ color: theme.heroTextColor }}>{placed.orderNumber}</p>
        <div
          className="rounded-xl p-4 text-left mb-6"
          style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
        >
          {placed.lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm py-1" style={{ color: theme.heroTextColor }}>
              <span>
                {l.quantity} × {l.productName}
                {l.variantLabel ? ` · ${l.variantLabel}` : ""}
              </span>
              <span>{formatPrice(l.lineTotal, placed.currency)}</span>
            </div>
          ))}
          <div className="border-t mt-2 pt-2 flex items-center justify-between text-sm font-bold" style={{ borderColor: cardBorder, color: theme.heroTextColor }}>
            <span>Total paid</span>
            <span>{formatPrice(placed.subtotal, placed.currency)}</span>
          </div>
        </div>
        <button
          onClick={goHome}
          className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
          style={{ backgroundColor: theme.accentColor, color: accentText }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to {salon.name}
        </button>
      </div>,
    );
  }

  if (step === "checkout") {
    return shell(
      <CheckoutForm
        salon={salon}
        theme={theme}
        lines={cart.lines}
        currency={cart.currency}
        subtotal={cart.subtotal}
        countries={countries}
        onCancel={() => setStep("browse")}
        onPlaced={(order) => {
          cart.clear();
          setPlaced(order);
          setStep("done");
        }}
      />,
    );
  }

  // ── browse ────────────────────────────────────────────────────────────────

  const selectStyle: React.CSSProperties = {
    backgroundColor: cardBg,
    border: `1px solid ${cardBorder}`,
    color: theme.heroTextColor,
  };

  return shell(
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-0 rounded-xl mb-7 overflow-hidden"
        style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}
      >
        {/* Count */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderRight: `1px solid ${cardBorder}` }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: sub }} />
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: sub }}>
            {filterLoading ? "…" : `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[140px]">
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 text-sm outline-none bg-transparent"
            style={{ color: theme.heroTextColor }}
          />
        </div>

        {/* Brand filter (API-driven) */}
        {brands.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderLeft: `1px solid ${cardBorder}` }}>
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline" style={{ color: sub }}>
              Brand
            </span>
            <select
              className="text-xs font-medium outline-none bg-transparent cursor-pointer py-0.5 pr-1"
              style={{ color: theme.heroTextColor }}
              value={activeBrandId ?? ""}
              onChange={(e) => setActiveBrandId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Category filter (API-driven) */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderLeft: `1px solid ${cardBorder}` }}>
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline" style={{ color: sub }}>
              Category
            </span>
            <select
              className="text-xs font-medium outline-none bg-transparent cursor-pointer py-0.5 pr-1"
              style={{ color: theme.heroTextColor }}
              value={activeCategoryId ?? ""}
              onChange={(e) => setActiveCategoryId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderLeft: `1px solid ${cardBorder}` }}>
          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline" style={{ color: sub }}>
            Sort
          </span>
          <select
            className="text-xs font-medium outline-none bg-transparent cursor-pointer py-0.5 pr-1"
            style={{ color: theme.heroTextColor }}
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="default">Default</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="name-asc">Name A–Z</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20" style={{ color: sub }}>
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {!loading && loadError && (
        <div
          className="rounded-xl p-6 text-center text-sm"
          style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, color: sub }}
        >
          {loadError}
        </div>
      )}

      {!loading && !loadError && products.length === 0 && (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <ShoppingBag className="w-8 h-8 mx-auto mb-3" style={{ color: sub }} />
          <p className="text-sm font-semibold" style={{ color: theme.heroTextColor }}>No products yet</p>
          <p className="text-xs mt-1" style={{ color: sub }}>Check back soon — the shop is being stocked.</p>
        </div>
      )}

      {!loading && !loadError && products.length > 0 && filteredProducts.length === 0 && (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <Search className="w-8 h-8 mx-auto mb-3" style={{ color: sub }} />
          <p className="text-sm font-semibold" style={{ color: theme.heroTextColor }}>No matches</p>
          <p className="text-xs mt-1" style={{ color: sub }}>Try a different search, brand, or category.</p>
        </div>
      )}

      {!loading && !loadError && filteredProducts.length > 0 && (
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 transition-opacity duration-200 ${filterLoading ? "opacity-50 pointer-events-none" : ""}`}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              theme={theme}
              selectedVariantId={picked[product.id]}
              onSelectVariant={(vid) => setPicked((p) => ({ ...p, [product.id]: vid }))}
              onExpand={() => setDetailProduct(product)}
              onAdd={(variant) => {
                const line: Omit<CartLine, "quantity"> = {
                  variantId: variant.id,
                  productId: product.id,
                  productName: product.name,
                  variantLabel: variant.label ?? null,
                  unitPrice: variant.price,
                  currency: variant.currency,
                  imageUrl: product.imageUrl ?? null,
                  maxQuantity: variant.quantityOnHand,
                };
                cart.add(line, 1);
                setCartOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        theme={theme}
        cart={cart}
        onCheckout={() => {
          setCartOpen(false);
          setStep("checkout");
        }}
      />

      <UserAccountPanel
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        theme={theme}
      />

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          theme={theme}
          selectedVariantId={picked[detailProduct.id]}
          onSelectVariant={(vid) => setPicked((p) => ({ ...p, [detailProduct.id]: vid }))}
          onAdd={(variant) => {
            const line: Omit<CartLine, "quantity"> = {
              variantId: variant.id,
              productId: detailProduct.id,
              productName: detailProduct.name,
              variantLabel: variant.label ?? null,
              unitPrice: variant.price,
              currency: variant.currency,
              imageUrl: detailProduct.imageUrl ?? null,
              maxQuantity: variant.quantityOnHand,
            };
            cart.add(line, 1);
            setDetailProduct(null);
            setCartOpen(true);
          }}
          onClose={() => setDetailProduct(null)}
        />
      )}
    </div>,
  );
}

// ── Product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product, theme, selectedVariantId, onSelectVariant, onExpand, onAdd,
}: {
  product: ShopProduct;
  theme: WebsiteTheme;
  selectedVariantId?: number;
  onSelectVariant: (variantId: number) => void;
  onExpand: () => void;
  onAdd: (variant: ShopVariant) => void;
}) {
  const heroLight = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);
  const sub = heroLight ? "#6B7280" : "#94A3B8";
  const cardBg = heroLight ? "#FFFFFF" : "rgba(255,255,255,0.07)";
  const cardBorder = heroLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.10)";
  const imgBg = heroLight ? `${theme.accentColor}0d` : `${theme.accentColor}18`;

  const variant = product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
  const outOfStock = !variant || variant.quantityOnHand <= 0;
  // All variants out of stock — the whole product is "sold"
  const allSold = product.variants.length > 0 && product.variants.every((v) => v.quantityOnHand <= 0);

  const hasCompareAt = variant && variant.compareAtPrice != null && variant.compareAtPrice > variant.price;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col group transition-shadow hover:shadow-lg"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        // No `opacity`/`filter`/`transform` on this element or the image wrapper: any of
        // them makes Chromium drop the `overflow:hidden`+`border-radius` clip for the
        // transform-animated <img>, so it pokes out past the card's rounded top. The
        // "sold" dim + grayscale therefore live on the leaf <img> / info block instead.
      }}
    >
      {/* Image — click opens detail. object-contain + slight inset so the whole
          product is visible and stays inside the card, never cropped or overflowing. */}
      <div
        className="relative w-full aspect-[3/4] overflow-hidden rounded-t-2xl isolate"
        style={{ backgroundColor: imgBg }}
      >
        <button
          onClick={onExpand}
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          aria-label={`View ${product.name} details`}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
              style={{ filter: allSold ? "grayscale(1)" : undefined, opacity: allSold ? 0.65 : 1 }}
            />
          ) : (
            <span className="text-4xl font-black select-none" style={{ color: `${theme.accentColor}55` }}>
              {initials(product.name)}
            </span>
          )}
        </button>

        {/* Sold / out-of-stock badge */}
        {allSold && (
          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
            style={{ backgroundColor: "rgba(15,23,42,0.70)", color: "#FFFFFF" }}
          >
            Sold
          </div>
        )}
      </div>

      {/* Info — brand/name/category click opens detail; pills and add-to-cart stay interactive */}
      <div className="p-4 flex flex-col gap-2 flex-1" style={{ backgroundColor: cardBg, opacity: allSold ? 0.55 : 1 }}>
        {/* Brand */}
        <button onClick={onExpand} className="text-left cursor-pointer">
          {product.brandName && (
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.accentColor }}>
              {product.brandName}
            </span>
          )}

          {/* Name */}
          <h3 className="text-sm font-bold leading-snug line-clamp-2 mt-0.5" style={{ color: theme.heroTextColor }}>
            {product.name}
          </h3>

          {/* Category */}
          {product.categoryName && (
            <span className="inline-flex items-center gap-1 text-[11px] mt-1" style={{ color: sub }}>
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h1.5L8 1l4.5 3H14v9H2V4Z" />
                <path d="M6 14V9h4v5" />
              </svg>
              {product.categoryName}
            </span>
          )}
        </button>

        {/* Variant pills */}
        {product.variants.length > 1 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {product.variants.map((v) => {
              const isSelected = v.id === (variant?.id);
              const soldOut = v.quantityOnHand <= 0;
              return (
                <button
                  key={v.id}
                  onClick={() => !soldOut && onSelectVariant(v.id)}
                  disabled={soldOut}
                  title={soldOut ? "Out of stock" : v.label || "Standard"}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: isSelected ? theme.accentColor : `${theme.accentColor}15`,
                    color: isSelected ? accentText : theme.heroTextColor,
                    border: `1px solid ${isSelected ? theme.accentColor : cardBorder}`,
                    opacity: soldOut ? 0.4 : 1,
                    textDecoration: soldOut ? "line-through" : undefined,
                  }}
                >
                  {v.label || "Standard"}
                </button>
              );
            })}
          </div>
        )}

        {/* Price + add-to-cart */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t" style={{ borderColor: cardBorder }}>
          <div className="flex flex-col">
            {hasCompareAt && (
              <span className="text-[11px] line-through" style={{ color: sub }}>
                {formatPrice(variant!.compareAtPrice!, variant!.currency)}
              </span>
            )}
            <span
              className="text-base font-extrabold tracking-tight"
              style={{ color: outOfStock ? sub : hasCompareAt ? "#DC2626" : theme.accentColor }}
            >
              {variant ? formatPrice(variant.price, variant.currency) : "—"}
            </span>
          </div>
          <button
            disabled={outOfStock}
            onClick={() => variant && onAdd(variant)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 shrink-0"
            style={{ backgroundColor: `${theme.accentColor}18`, color: theme.accentColor, border: `1.5px solid ${theme.accentColor}44` }}
            title={outOfStock ? "Out of stock" : "Add to cart"}
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product detail modal ──────────────────────────────────────────────────────

function ProductDetailModal({
  product, theme, selectedVariantId, onSelectVariant, onAdd, onClose,
}: {
  product: ShopProduct;
  theme: WebsiteTheme;
  selectedVariantId?: number;
  onSelectVariant: (variantId: number) => void;
  onAdd: (variant: ShopVariant) => void;
  onClose: () => void;
}) {
  const heroLight = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);
  const sub = heroLight ? "#475569" : "#94A3B8";
  const panelBg = heroLight ? "#FFFFFF" : "#0F172A";
  const border = heroLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)";
  const imgBg = heroLight ? `${theme.accentColor}0d` : `${theme.accentColor}18`;
  const pillBg = heroLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.07)";

  const variant = product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
  const outOfStock = !variant || variant.quantityOnHand <= 0;
  const allSold = product.variants.length > 0 && product.variants.every((v) => v.quantityOnHand <= 0);
  const hasCompareAt = variant && variant.compareAtPrice != null && variant.compareAtPrice > variant.price;

  const gallery = product.images?.length
    ? product.images
    : product.imageUrl
      ? [product.imageUrl]
      : [];
  const [imgIdx, setImgIdx] = useState(0);
  useEffect(() => { setImgIdx(0); }, [product.id]);
  const activeImg = gallery[Math.min(imgIdx, gallery.length - 1)] ?? null;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ fontFamily: fontStack(theme.fontFamily) }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88dvh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl"
        style={{ backgroundColor: panelBg, border: `1px solid ${border}` }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
          style={{ backgroundColor: heroLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.12)", color: sub }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col sm:flex-row overflow-y-auto sm:overflow-hidden flex-1 min-h-0">
          {/* Image panel — gallery */}
          <div className="w-full sm:w-[42%] shrink-0 flex flex-col">
            <div
              className="relative aspect-[4/3] sm:aspect-square flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: imgBg }}
            >
              {activeImg ? (
                <img src={activeImg} alt={product.name} className="w-full h-full object-contain p-6" />
              ) : (
                <span className="text-6xl font-black select-none" style={{ color: `${theme.accentColor}44` }}>
                  {initials(product.name)}
                </span>
              )}
              {allSold && (
                <div
                  className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ backgroundColor: "rgba(15,23,42,0.70)", color: "#FFFFFF" }}
                >
                  Sold
                </div>
              )}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setImgIdx((i) => (i - 1 + gallery.length) % gallery.length)}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: heroLight ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.65)", color: sub }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgIdx((i) => (i + 1) % gallery.length)}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: heroLight ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.65)", color: sub }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 p-2 overflow-x-auto" style={{ backgroundColor: imgBg }}>
                {gallery.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    aria-label={`View image ${i + 1}`}
                    className="w-14 h-14 shrink-0 rounded-lg overflow-hidden cursor-pointer"
                    style={{
                      border: `2px solid ${i === imgIdx ? theme.accentColor : "transparent"}`,
                      backgroundColor: heroLight ? "#FFFFFF" : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <img src={src} alt="" className="w-full h-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details panel */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-4">
            {/* Brand */}
            {product.brandName && (
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.accentColor }}>
                {product.brandName}
              </span>
            )}

            {/* Name */}
            <h2 className="text-xl font-black leading-tight" style={{ color: theme.heroTextColor }}>
              {product.name}
            </h2>

            {/* Category */}
            {product.categoryName && (
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: sub }}>
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h1.5L8 1l4.5 3H14v9H2V4Z" />
                  <path d="M6 14V9h4v5" />
                </svg>
                {product.categoryName}
              </span>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-sm leading-relaxed" style={{ color: sub }}>
                {product.description}
              </p>
            )}

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${border}` }} />

            {/* Variants */}
            {product.variants.length > 1 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: sub }}>
                  Options
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const isSelected = v.id === (variant?.id);
                    const soldOut = v.quantityOnHand <= 0;
                    const vHasCompare = v.compareAtPrice != null && v.compareAtPrice > v.price;
                    return (
                      <button
                        key={v.id}
                        onClick={() => !soldOut && onSelectVariant(v.id)}
                        disabled={soldOut}
                        title={soldOut ? "Out of stock" : v.label || "Standard"}
                        className="flex flex-col items-start px-3 py-2 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: isSelected ? theme.accentColor : pillBg,
                          color: isSelected ? accentText : theme.heroTextColor,
                          border: `1.5px solid ${isSelected ? theme.accentColor : border}`,
                          opacity: soldOut ? 0.4 : 1,
                        }}
                      >
                        <span className="text-xs font-semibold" style={{ textDecoration: soldOut ? "line-through" : undefined }}>
                          {v.label || "Standard"}
                        </span>
                        <span className="text-[10px] mt-0.5 flex items-center gap-1">
                          {vHasCompare && (
                            <span style={{ textDecoration: "line-through", opacity: 0.6 }}>
                              {formatPrice(v.compareAtPrice!, v.currency)}
                            </span>
                          )}
                          <span style={{ color: isSelected ? accentText : vHasCompare ? "#DC2626" : "inherit" }}>
                            {formatPrice(v.price, v.currency)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price block */}
            <div className="flex items-end gap-3 mt-auto">
              <div className="flex flex-col">
                {hasCompareAt && (
                  <span className="text-sm line-through" style={{ color: sub }}>
                    {formatPrice(variant!.compareAtPrice!, variant!.currency)}
                  </span>
                )}
                <span
                  className="text-2xl font-black tracking-tight"
                  style={{ color: allSold ? sub : hasCompareAt ? "#DC2626" : theme.accentColor }}
                >
                  {variant ? formatPrice(variant.price, variant.currency) : "—"}
                </span>
              </div>

              {/* Stock note */}
              {!allSold && variant && variant.quantityOnHand > 0 && variant.quantityOnHand <= 5 && (
                <span className="text-xs mb-1" style={{ color: "#F59E0B" }}>
                  Only {variant.quantityOnHand} left
                </span>
              )}
            </div>

            {/* Add to cart */}
            <button
              disabled={outOfStock}
              onClick={() => variant && onAdd(variant)}
              className="w-full flex items-center justify-center gap-2 text-sm font-bold px-5 py-3.5 rounded-2xl transition-opacity hover:opacity-90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: theme.accentColor, color: accentText }}
            >
              <ShoppingBag className="w-4 h-4" />
              {allSold ? "Sold out" : outOfStock ? "This option is out of stock" : "Add to cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cart drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  open, onClose, theme, cart, onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  theme: WebsiteTheme;
  cart: ReturnType<typeof useCart>;
  onCheckout: () => void;
}) {
  const heroLight = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);
  const sub = heroLight ? "#475569" : "#94A3B8";
  const panelBg = heroLight ? "#FFFFFF" : "#0F172A";
  const border = heroLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ fontFamily: fontStack(theme.fontFamily) }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        className="relative w-full max-w-sm h-full flex flex-col shadow-2xl"
        style={{ backgroundColor: panelBg }}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: border }}>
          <span className="text-sm font-bold" style={{ color: theme.heroTextColor }}>
            Your cart ({cart.count})
          </span>
          <button onClick={onClose} className="cursor-pointer" style={{ color: sub }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {cart.lines.length === 0 && (
            <p className="text-sm text-center py-10" style={{ color: sub }}>Your cart is empty.</p>
          )}
          {cart.lines.map((l) => (
            <div key={l.variantId} className="flex gap-3">
              <div
                className="w-14 h-14 rounded-lg shrink-0 overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: `${theme.accentColor}14` }}
              >
                {l.imageUrl ? (
                  <img src={l.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="w-5 h-5" style={{ color: `${theme.accentColor}99` }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: theme.heroTextColor }}>{l.productName}</p>
                {l.variantLabel && <p className="text-[11px]" style={{ color: sub }}>{l.variantLabel}</p>}
                <p className="text-xs mt-0.5" style={{ color: sub }}>{formatPrice(l.unitPrice, l.currency)} each</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={() => cart.setQty(l.variantId, l.quantity - 1)}
                    className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer"
                    style={{ border: `1px solid ${border}`, color: theme.heroTextColor }}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm w-6 text-center" style={{ color: theme.heroTextColor }}>{l.quantity}</span>
                  <button
                    onClick={() => cart.setQty(l.variantId, l.quantity + 1)}
                    disabled={l.quantity >= (l.maxQuantity || 1)}
                    className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ border: `1px solid ${border}`, color: theme.heroTextColor }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => cart.remove(l.variantId)}
                    className="ml-auto cursor-pointer"
                    style={{ color: sub }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <span className="text-sm font-semibold shrink-0" style={{ color: theme.heroTextColor }}>
                {formatPrice(l.unitPrice * l.quantity, l.currency)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t px-4 py-4" style={{ borderColor: border }}>
          <div className="flex items-center justify-between text-sm font-bold mb-3" style={{ color: theme.heroTextColor }}>
            <span>Subtotal</span>
            <span>{formatPrice(cart.subtotal, cart.currency)}</span>
          </div>
          <button
            disabled={cart.lines.length === 0}
            onClick={onCheckout}
            className="w-full text-sm font-semibold px-4 py-3 rounded-xl transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.accentColor, color: accentText }}
          >
            Proceed to checkout
          </button>
        </div>
      </aside>
    </div>
  );
}

// ── Checkout ─────────────────────────────────────────────────────────────────

function CheckoutForm({
  salon, theme, lines, currency, subtotal, countries, onCancel, onPlaced,
}: {
  salon: Salon;
  theme: WebsiteTheme;
  lines: CartLine[];
  currency: string;
  subtotal: number;
  countries: Country[];
  onCancel: () => void;
  onPlaced: (order: ShopOrder) => void;
}) {
  const heroLight = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);
  const sub = heroLight ? "#475569" : "#94A3B8";
  const cardBg = heroLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)";
  const cardBorder = heroLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)";
  const inputBg = heroLight ? "#FFFFFF" : "rgba(255,255,255,0.06)";
  const inputBorder = heroLight ? "rgba(15,23,42,0.15)" : "rgba(255,255,255,0.2)";
  const errorColor = "#DC2626";

  const [f, setF] = useState({
    customerName: "", customerEmail: "", customerPhone: "",
    line1: "", line2: "", city: "", state: "",
    country: salon.location?.country ?? "",
    zipCode: "",
    communicationPreference: "IMPORTANT_ONLY" as "ALL" | "IMPORTANT_ONLY",
  });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // touched: set per-field on blur, or all at once when user clicks Pay
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const touch = (k: string) => setTouched((p) => ({ ...p, [k]: true }));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((p) => ({ ...p, [k]: e.target.value }));
    touch(k);
  };

  // Field-level validation
  const errors: Record<string, string> = {};
  if (!f.customerName.trim()) errors.customerName = "Full name is required.";
  if (!f.customerEmail.trim()) {
    errors.customerEmail = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.customerEmail.trim())) {
    errors.customerEmail = "Please enter a valid email address.";
  }

  const isValid = Object.keys(errors).length === 0 && lines.length > 0;

  const inputCls = "w-full text-sm rounded-lg px-3 py-2 outline-none mt-1";
  const inputStyle = (field: string): React.CSSProperties => ({
    backgroundColor: inputBg,
    border: `1px solid ${touched[field] && errors[field] ? errorColor : inputBorder}`,
    color: theme.heroTextColor,
  });
  const labelStyle: React.CSSProperties = { color: sub };

  if (lines.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-sm mb-4" style={{ color: sub }}>Your cart is empty.</p>
        <button onClick={onCancel} className="text-sm font-semibold cursor-pointer" style={{ color: theme.accentColor }}>
          ← Back to shop
        </button>
      </div>
    );
  }

  async function submit() {
    if (!isValid) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const address: ShopShippingAddress = {
        line1: f.line1 || undefined, line2: f.line2 || undefined, city: f.city || undefined,
        state: f.state || undefined, country: f.country || undefined, zipCode: f.zipCode || undefined,
      };
      const order = await apiFetch<ShopOrder>(`${API_BASE}/api/salon/${salon.id}/shop/orders`, {
        method: "POST",
        body: JSON.stringify({
          customerName: f.customerName.trim(),
          customerEmail: f.customerEmail.trim(),
          customerPhone: f.customerPhone.trim() || undefined,
          shippingAddress: address,
          items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          communicationPreference: f.communicationPreference,
        }),
      });
      onPlaced(order);
    } catch (e) {
      setSubmitError(friendlyMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <button onClick={onCancel} className="text-xs font-semibold mb-5 inline-flex items-center gap-1.5 cursor-pointer" style={{ color: sub }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back to shop
      </button>
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-6" style={{ color: theme.heroTextColor }}>
        Checkout
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>Your details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full name */}
              <div className="flex flex-col">
                <label className="text-xs" style={labelStyle}>
                  Full name <span style={{ color: errorColor }}>*</span>
                  <input
                    className={inputCls}
                    style={inputStyle("customerName")}
                    value={f.customerName}
                    onChange={set("customerName")}
                    onBlur={() => touch("customerName")}
                    autoComplete="name"
                  />
                </label>
                {touched.customerName && errors.customerName && (
                  <span className="text-[11px] mt-1" style={{ color: errorColor }}>{errors.customerName}</span>
                )}
              </div>

              {/* Email */}
              <div className="flex flex-col">
                <label className="text-xs" style={labelStyle}>
                  Email <span style={{ color: errorColor }}>*</span>
                  <input
                    className={inputCls}
                    style={inputStyle("customerEmail")}
                    type="email"
                    value={f.customerEmail}
                    onChange={set("customerEmail")}
                    onBlur={() => touch("customerEmail")}
                    autoComplete="email"
                  />
                </label>
                {touched.customerEmail && errors.customerEmail && (
                  <span className="text-[11px] mt-1" style={{ color: errorColor }}>{errors.customerEmail}</span>
                )}
              </div>

              {/* Phone */}
              <div className="text-xs sm:col-span-2" style={labelStyle}>
                Phone <span className="text-[10px]" style={{ color: sub }}>(optional)</span>
                <div className="mt-1">
                  <PhoneInput
                    value={f.customerPhone}
                    onChange={(v) => setF((p) => ({ ...p, customerPhone: v }))}
                    countries={countries}
                    defaultCountry={salon.location?.country}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>Shipping address <span className="text-[10px] font-normal normal-case tracking-normal" style={{ color: sub }}>(optional)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs sm:col-span-2" style={labelStyle}>
                Address line 1
                <input className={inputCls} style={inputStyle("line1")} value={f.line1} onChange={set("line1")} autoComplete="address-line1" />
              </label>
              <label className="text-xs sm:col-span-2" style={labelStyle}>
                Address line 2
                <input className={inputCls} style={inputStyle("line2")} value={f.line2} onChange={set("line2")} autoComplete="address-line2" />
              </label>
              <label className="text-xs" style={labelStyle}>
                City
                <input className={inputCls} style={inputStyle("city")} value={f.city} onChange={set("city")} autoComplete="address-level2" />
              </label>
              <label className="text-xs" style={labelStyle}>
                State / region
                <input className={inputCls} style={inputStyle("state")} value={f.state} onChange={set("state")} autoComplete="address-level1" />
              </label>
              <label className="text-xs" style={labelStyle}>
                Country
                {countries.length > 0 ? (
                  <select
                    className={inputCls}
                    style={inputStyle("country")}
                    value={f.country}
                    onChange={set("country")}
                    autoComplete="country-name"
                  >
                    <option value="">— Select country —</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input className={inputCls} style={inputStyle("country")} value={f.country} onChange={set("country")} autoComplete="country-name" />
                )}
              </label>
              <label className="text-xs" style={labelStyle}>
                ZIP / postcode
                <input className={inputCls} style={inputStyle("zipCode")} value={f.zipCode} onChange={set("zipCode")} autoComplete="postal-code" />
              </label>
            </div>
          </div>

          {/* Communication preference */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>
              Order notifications
            </p>
            <div className="flex flex-col gap-2">
              {(["IMPORTANT_ONLY", "ALL"] as const).map((opt) => {
                const selected = f.communicationPreference === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setF((p) => ({ ...p, communicationPreference: opt }))}
                    className="flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-all cursor-pointer"
                    style={{
                      backgroundColor: selected ? `${theme.accentColor}18` : cardBg,
                      border: `1.5px solid ${selected ? theme.accentColor : cardBorder}`,
                    }}
                  >
                    <span
                      className="mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                      style={{ border: `2px solid ${selected ? theme.accentColor : cardBorder}` }}
                    >
                      {selected && (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                      )}
                    </span>
                    <span>
                      <span className="text-xs font-bold block" style={{ color: theme.heroTextColor }}>
                        {opt === "IMPORTANT_ONLY" ? "Important only" : "All updates"}
                      </span>
                      <span className="text-[11px]" style={{ color: sub }}>
                        {opt === "IMPORTANT_ONLY"
                          ? "Shipping, invoice, refund & credit notifications"
                          : "Every status change and activity on your order"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl p-4 h-fit"
          style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: theme.accentColor }}>Order summary</p>
          <div className="flex flex-col gap-2 mb-3">
            {lines.map((l) => (
              <div key={l.variantId} className="flex items-start justify-between text-xs" style={{ color: theme.heroTextColor }}>
                <span className="pr-2">
                  {l.quantity} × {l.productName}
                  {l.variantLabel ? ` · ${l.variantLabel}` : ""}
                </span>
                <span>{formatPrice(l.unitPrice * l.quantity, l.currency)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 flex items-center justify-between text-sm font-bold" style={{ borderColor: cardBorder, color: theme.heroTextColor }}>
            <span>Total</span>
            <span>{formatPrice(subtotal, currency)}</span>
          </div>

          {submitError && (
            <p className="text-xs mt-3 p-2 rounded-lg" style={{ color: errorColor, backgroundColor: `${errorColor}14`, border: `1px solid ${errorColor}33` }}>
              {submitError}
            </p>
          )}

          <button
            disabled={!isValid || busy}
            onClick={submit}
            className="w-full mt-4 text-sm font-semibold px-4 py-3 rounded-xl transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            style={{ backgroundColor: theme.accentColor, color: accentText }}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? "Processing…" : `Pay ${formatPrice(subtotal, currency)}`}
          </button>

          <p className="text-[10px] text-center mt-2" style={{ color: sub }}>
            Payment is simulated — no card is charged.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── User account panel ────────────────────────────────────────────────────────

function UserAccountPanel({
  open, onClose, theme,
}: {
  open: boolean;
  onClose: () => void;
  theme: WebsiteTheme;
}) {
  const heroLight = isLightColor(theme.heroBg);
  const sub = heroLight ? "#475569" : "#94A3B8";
  const panelBg = heroLight ? "#FFFFFF" : "#0F172A";
  const border = heroLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)";
  const inputBg = heroLight ? "#F8FAFC" : "rgba(255,255,255,0.06)";
  const inputBorder = heroLight ? "rgba(15,23,42,0.15)" : "rgba(255,255,255,0.18)";

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ fontFamily: fontStack(theme.fontFamily) }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-in panel */}
      <aside
        className="relative w-full max-w-xs h-full flex flex-col shadow-2xl"
        style={{ backgroundColor: panelBg }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: border }}>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: theme.accentColor }} />
            <span className="text-sm font-bold" style={{ color: heroLight ? "#0F172A" : "#F8FAFC" }}>
              My Account
            </span>
          </div>
          <button onClick={onClose} className="cursor-pointer" style={{ color: sub }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col px-5 py-6 gap-5">
          {/* Coming soon banner */}
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs"
            style={{
              backgroundColor: `${theme.accentColor}12`,
              border: `1px solid ${theme.accentColor}30`,
              color: theme.accentColor,
            }}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">Customer accounts — coming soon</span>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: sub }}>
            Sign in with your email or mobile number to track orders, manage returns, and save your details for faster checkout.
          </p>

          {/* Email input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: sub }}>
              Email
            </label>
            <input
              type="email"
              disabled
              placeholder="your@email.com"
              className="w-full text-sm rounded-lg px-3 py-2.5 outline-none cursor-not-allowed opacity-50"
              style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, color: heroLight ? "#0F172A" : "#F8FAFC" }}
            />
          </div>

          <div className="flex items-center gap-2" style={{ color: sub }}>
            <div className="flex-1 h-px" style={{ backgroundColor: border }} />
            <span className="text-[10px] font-medium">or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: border }} />
          </div>

          {/* Mobile input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: sub }}>
              Mobile number
            </label>
            <input
              type="tel"
              disabled
              placeholder="+1 (555) 000-0000"
              className="w-full text-sm rounded-lg px-3 py-2.5 outline-none cursor-not-allowed opacity-50"
              style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, color: heroLight ? "#0F172A" : "#F8FAFC" }}
            />
          </div>

          {/* Disabled continue button */}
          <button
            disabled
            className="w-full text-sm font-semibold px-4 py-3 rounded-xl opacity-40 cursor-not-allowed"
            style={{ backgroundColor: theme.accentColor, color: contrastText(theme.accentColor) }}
          >
            Continue
          </button>
        </div>
      </aside>
    </div>
  );
}
