import { useI18n } from "@salon/i18n";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Heart, Loader2, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, Trash2, User, X,
} from "lucide-react";
import { apiFetch, API_BASE } from "./api";
import { friendlyMessage } from "./apiError";
import { DEFAULT_PRODUCT_EMOJI, formatPrice } from "./constants";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import type { SalonPolicy } from "./SalonPolicyLinks";
import { contrastText, fontStack, isLightColor, loadGoogleFont, shade } from "./theme";
import { useCart } from "./shopCart";
import { useWishlist } from "./shopWishlist";
import PhoneInput from "./PhoneInput";
import type { CartLine, Country, Salon, ShopBrand, ShopCategory, ShopOrder, ShopProduct, ShopShippingAddress, ShopVariant, WebsiteTheme } from "./types";

export interface ShopViewProps {
  salon: Salon;
  theme: WebsiteTheme;
  policies?: SalonPolicy[];
  /** Build the href for a page key (for the header's other nav links). */
  getPagePath?: (page: string) => string;
  /** Navigate to another page key, or null to return to the home page. */
  onNavigate?: (page: string | null) => void;
}

type Step = "browse" | "checkout" | "done";

export function ShopView({ salon, theme: themeProp, policies = [], getPagePath, onNavigate }: ShopViewProps) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const theme = themeProp;
  const fontStackCss = fontStack(theme.fontFamily);
  const heroLight = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);
  const sub = heroLight ? "#475569" : "#94A3B8";
  const cardBg = heroLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)";
  const cardBorder = heroLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)";

  const salonKey = String(salon.id);
  const cart = useCart(salonKey);
  const wishlist = useWishlist(salonKey);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;
    try {
      const pending = window.sessionStorage.getItem(`shop-pending-order:${salon.id}`);
      if (!pending) return;
      setPlaced(JSON.parse(pending) as ShopOrder);
      window.sessionStorage.removeItem(`shop-pending-order:${salon.id}`);
      cart.clear();
      setStep("done");
    } catch { /* Ignore stale checkout return data. */ }
  }, [salon.id]);

  // Card size is the shopper's browsing preference, not salon data — one setting shared
  // across every storefront, same as a device-wide theme choice.
  const [density, setDensity] = useState<"comfortable" | "compact">(() => {
    if (typeof window === "undefined") return "comfortable";
    return window.localStorage.getItem("shop-card-density") === "compact" ? "compact" : "comfortable";
  });
  useEffect(() => {
    window.localStorage.setItem("shop-card-density", density);
  }, [density]);

  // Advanced filters (price range, availability) live behind the sliders toggle, collapsed by
  // default — they see far less use than search/brand/category, which stay always visible.
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const isOutOfStock = (p: ShopProduct) => p.variants.length > 0 && p.variants.every((v) => v.quantityOnHand <= 0);
  const priceOf = (p: ShopProduct) => p.variants[0]?.price ?? 0;

  const priceBounds = useMemo(() => {
    const prices = products.map(priceOf).filter((n) => n > 0);
    if (!prices.length) return null;
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products]);

  // The two thumbs read/write the same minPrice/maxPrice the filter logic uses, defaulting to
  // the catalogue's actual bounds while unset, and clamping so neither thumb can cross the other.
  const sliderBounds = priceBounds ?? { min: 0, max: 1000 };
  const sliderMin = minPrice === "" ? sliderBounds.min : minPrice;
  const sliderMax = maxPrice === "" ? sliderBounds.max : maxPrice;

  const activeFilterCount = [
    search.trim() !== "", activeBrandId != null, activeCategoryId != null,
    minPrice !== "", maxPrice !== "", inStockOnly,
  ].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setActiveBrandId(null);
    setActiveCategoryId(null);
    setSort("default");
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.brandName ?? "").toLowerCase().includes(q)) return false;
      const price = priceOf(p);
      if (minPrice !== "" && price < minPrice) return false;
      if (maxPrice !== "" && price > maxPrice) return false;
      if (inStockOnly && isOutOfStock(p)) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === "price-desc") list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === "name-asc") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, search, sort, minPrice, maxPrice, inStockOnly]);

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
      <SiteFooter salon={salon} theme={theme} current="shop" onBack={goHome} getPagePath={getPagePath} policies={policies} />
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
          {translateUi("Order placed ")}</h1>
        <p className="text-sm mb-1" style={{ color: sub }}>
          {placed.paymentStatus === "PENDING" ? translateUi("Payment received. We’re confirming your order.") : `Thanks, ${placed.customerName.split(" ")[0]}! Your order number is`}
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
              <span>{formatPrice(l.lineTotal, placed.currency, uiLocale)}</span>
            </div>
          ))}
          <div className="border-t mt-2 pt-2 flex items-center justify-between text-sm font-bold" style={{ borderColor: cardBorder, color: theme.heroTextColor }}>
            <span>{placed.paymentStatus === "PENDING" ? translateUi("Total") : translateUi("Total paid")}</span>
            <span>{formatPrice(placed.subtotal, placed.currency, uiLocale)}</span>
          </div>
        </div>
        <button
          onClick={goHome}
          className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
          style={{ backgroundColor: theme.accentColor, color: accentText }}
        >
          <ArrowLeft className="w-4 h-4" /> {translateUi("Back to ")}{salon.name}
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

  const menuBg = heroLight ? "#FFFFFF" : "#0F172A";
  const menuHover = heroLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.08)";

  return shell(
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Filter bar — stacked full-width fields on mobile, one inline segmented row on sm+.
          Uses an in-DOM custom dropdown (FilterSelect), not a native <select>: a native
          popup ignores a phone's / DevTools' viewport and anchors to the window origin. */}
      <div
        className="mb-7 rounded-xl border flex flex-col sm:flex-row sm:flex-wrap sm:items-center"
        style={{ borderColor: cardBorder, backgroundColor: cardBg }}
      >
        {/* Count/filter-toggle + search — the top row on mobile; two inline segments on sm+ */}
        <div className="flex items-center border-b sm:border-b-0 sm:contents" style={{ borderColor: cardBorder }}>
          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            aria-expanded={filtersExpanded}
            aria-controls="shop-filter-expand"
            className="flex items-center gap-2 px-4 py-3 shrink-0 border-r cursor-pointer"
            style={{ borderColor: cardBorder }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" style={{ color: sub }} />
            <span className="text-xs font-medium whitespace-nowrap" style={{ color: sub }}>
              {filterLoading ? "…" : `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}`}
            </span>
            {activeFilterCount > 0 && (
              <span
                className="text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"
                style={{ backgroundColor: theme.accentColor, color: accentText }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className="w-3 h-3 shrink-0 transition-transform" style={{ color: sub, transform: filtersExpanded ? "rotate(180deg)" : undefined }} />
          </button>
          <input
            type="search"
            placeholder={translateUi("Search products…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 sm:min-w-[140px] px-4 py-3 text-base sm:text-sm outline-none bg-transparent"
            style={{ color: theme.heroTextColor }}
          />
        </div>

        {/* Brand / Category / Sort — stacked on mobile, inline segments on sm+ */}
        <div className="flex flex-col sm:contents">
          {brands.length > 0 && (
            <FilterSelect
              label={translateUi("Brand")} value={activeBrandId != null ? String(activeBrandId) : ""}
              sub={sub} border={cardBorder} text={theme.heroTextColor} menuBg={menuBg} menuHover={menuHover}
              options={[{ value: "", label: "All" }, ...brands.map((b) => ({ value: String(b.id), label: b.name }))]}
              onChange={(v) => setActiveBrandId(v ? Number(v) : null)}
            />
          )}

          {categories.length > 0 && (
            <FilterSelect
              label={translateUi("Category")} value={activeCategoryId != null ? String(activeCategoryId) : ""}
              sub={sub} border={cardBorder} text={theme.heroTextColor} menuBg={menuBg} menuHover={menuHover}
              options={[{ value: "", label: "All" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
              onChange={(v) => setActiveCategoryId(v ? Number(v) : null)}
            />
          )}

          <FilterSelect
            label={translateUi("Sort")} value={sort}
            sub={sub} border={cardBorder} text={theme.heroTextColor} menuBg={menuBg} menuHover={menuHover}
            options={[
              { value: "default", label: "Default" },
              { value: "price-asc", label: "Price: Low → High" },
              { value: "price-desc", label: "Price: High → Low" },
              { value: "name-asc", label: "Name A–Z" },
            ]}
            onChange={(v) => setSort(v as typeof sort)}
          />
        </div>

        {/* Advanced filters — price range + availability. A full-width row of its own
            (rather than another inline segment), toggled by the sliders button above. */}
        {filtersExpanded && (
          <div
            id="shop-filter-expand"
            className="w-full basis-full border-t px-4 py-4 flex flex-col sm:flex-row sm:items-end gap-4"
            style={{ borderColor: cardBorder }}
          >
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center justify-between text-xs font-medium mb-2.5">
                <span style={{ color: sub }}>{translateUi("Price range")}</span>
                <span style={{ color: theme.heroTextColor }}>{formatPrice(sliderMin)} – {formatPrice(sliderMax)}</span>
              </div>
              <PriceRangeSlider
                bounds={sliderBounds}
                min={sliderMin}
                max={sliderMax}
                accent={theme.accentColor}
                track={cardBorder}
                onChangeMin={(v) => setMinPrice(Math.min(v, sliderMax))}
                onChangeMax={(v) => setMaxPrice(Math.max(v, sliderMin))}
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer shrink-0 pb-1.5" style={{ color: theme.heroTextColor }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-3.5 h-3.5 cursor-pointer"
                style={{ accentColor: theme.accentColor }}
              />
              {translateUi("Only available ")}</label>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold shrink-0 cursor-pointer pb-1.5 self-start sm:self-auto"
                style={{ color: theme.accentColor }}
              >
                {translateUi("Clear filters ")}</button>
            )}
          </div>
        )}
      </div>

      {/* Card size — only worth offering once there's more than one card to compare.
          Sits below the filter bar so it reads as "how to view the results", not another filter. */}
      {!loading && !loadError && filteredProducts.length > 1 && (
        <div className="flex justify-end mb-5 -mt-3">
          <div
            role="group"
            aria-label={translateUi("Card size")}
            className="inline-flex rounded-lg border overflow-hidden"
            style={{ borderColor: cardBorder }}
          >
            {(["comfortable", "compact"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDensity(option)}
                aria-pressed={density === option}
                className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${option === "compact" ? "border-l" : ""}`}
                style={{
                  borderColor: cardBorder,
                  backgroundColor: density === option ? theme.accentColor : "transparent",
                  color: density === option ? accentText : sub,
                }}
              >
                {option === "comfortable" ? translateUi("Large") : translateUi("Compact")}
              </button>
            ))}
          </div>
        </div>
      )}

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
          <p className="text-sm font-semibold" style={{ color: theme.heroTextColor }}>{translateUi("No products yet")}</p>
          <p className="text-xs mt-1" style={{ color: sub }}>{translateUi("Check back soon — the shop is being stocked.")}</p>
        </div>
      )}

      {!loading && !loadError && products.length > 0 && filteredProducts.length === 0 && (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <Search className="w-8 h-8 mx-auto mb-3" style={{ color: sub }} />
          <p className="text-sm font-semibold" style={{ color: theme.heroTextColor }}>{translateUi("No matches")}</p>
          <p className="text-xs mt-1" style={{ color: sub }}>{translateUi("Try a different search, brand, or category.")}</p>
        </div>
      )}

      {!loading && !loadError && filteredProducts.length > 0 && (
        <div
          className={`grid transition-opacity duration-200 ${
            density === "compact" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          } ${filterLoading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              theme={theme}
              compact={density === "compact"}
              selectedVariantId={picked[product.id]}
              onSelectVariant={(vid) => setPicked((p) => ({ ...p, [product.id]: vid }))}
              onExpand={() => setDetailProduct(product)}
              wished={wishlist.has(product.id)}
              onToggleWish={() => wishlist.toggle(product.id)}
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

// ── Price range slider ────────────────────────────────────────────────────
// Two native <input type="range"> stacked on top of each other, one per thumb.
// Both are `pointer-events-none` with only their `::-webkit-slider-thumb` /
// `::-moz-range-thumb` set back to `pointer-events-auto` — so a click passes
// straight through the empty track to whichever thumb is actually under the
// cursor, and each thumb stays independently draggable however close they get.
function PriceRangeSlider({
  bounds, min, max, onChangeMin, onChangeMax, accent, track,
}: {
  bounds: { min: number; max: number };
  min: number;
  max: number;
  onChangeMin: (value: number) => void;
  onChangeMax: (value: number) => void;
  accent: string;
  track: string;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const span = Math.max(1, bounds.max - bounds.min);
  const minPct = ((min - bounds.min) / span) * 100;
  const maxPct = ((max - bounds.min) / span) * 100;

  const thumbClass = [
    "absolute inset-0 w-full h-full m-0 appearance-none bg-transparent cursor-pointer pointer-events-none",
    "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent",
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto",
    "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full",
    "[&::-webkit-slider-thumb]:bg-[var(--thumb)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white",
    "[&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer",
    "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:border-0",
    "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full",
    "[&::-moz-range-thumb]:bg-[var(--thumb)] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white",
    "[&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer",
  ].join(" ");
  const thumbStyle = { ["--thumb" as string]: accent } as React.CSSProperties;

  return (
    <div className="relative h-4 flex items-center">
      <div className="absolute inset-x-0 h-1 rounded-full" style={{ backgroundColor: track }} />
      <div
        className="absolute h-1 rounded-full"
        style={{ backgroundColor: accent, left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }}
      />
      <input
        type="range" min={bounds.min} max={bounds.max} value={min}
        onChange={(e) => onChangeMin(Number(e.target.value))}
        className={thumbClass} style={thumbStyle} aria-label={translateUi("Minimum price")}
      />
      <input
        type="range" min={bounds.min} max={bounds.max} value={max}
        onChange={(e) => onChangeMax(Number(e.target.value))}
        className={thumbClass} style={thumbStyle} aria-label={translateUi("Maximum price")}
      />
    </div>
  );
}

// ── Filter select ───────────────────────────────────────────────────────────
// An in-DOM custom dropdown — a full-width field on mobile, an inline segment
// (via the parent's `sm:contents`) on sm+. Deliberately NOT a native <select>:
// the native popup ignores a phone's / DevTools' emulated viewport and anchors
// to the window origin, so it opens off-screen. This menu is a positioned <ul>,
// so it always lands under the control.
function FilterSelect({
  label, value, options, onChange, sub, border, text, menuBg, menuHover,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  sub: string;
  border: string;
  text: string;
  menuBg: string;
  menuHover: string;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative flex items-center gap-2 px-4 py-2.5 sm:py-3 border-t first:border-t-0 sm:border-t-0 sm:border-l min-w-0 sm:shrink-0"
      style={{ borderColor: border }}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 w-16 sm:w-auto" style={{ color: sub }}>
        {translateUi(label)}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex-1 min-w-0 flex items-center justify-between gap-2 bg-transparent outline-none cursor-pointer text-base sm:text-xs font-medium"
        style={{ color: text }}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ color: sub, transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-3 right-3 sm:left-auto sm:right-0 top-full mt-1 z-40 max-h-64 overflow-y-auto rounded-xl py-1 shadow-xl sm:min-w-[200px]"
          style={{ backgroundColor: menuBg, border: `1px solid ${border}` }}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className="w-full text-left px-3.5 py-2 text-sm flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  style={{ color: text, backgroundColor: selected ? menuHover : "transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = menuHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selected ? menuHover : "transparent"; }}
                >
                  <span className="truncate">{o.label}</span>
                  {selected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: sub }} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product, theme, selectedVariantId, onSelectVariant, onExpand, onAdd, compact = false, wished = false, onToggleWish,
}: {
  product: ShopProduct;
  theme: WebsiteTheme;
  selectedVariantId?: number;
  onSelectVariant: (variantId: number) => void;
  onExpand: () => void;
  onAdd: (variant: ShopVariant) => void;
  compact?: boolean;
  wished?: boolean;
  onToggleWish?: () => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const heroLight = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);
  const sub = heroLight ? "#6B7280" : "#94A3B8";
  // Shaded off the page background rather than a hardcoded white/near-white — a fixed "#FFFFFF"
  // card disappears on a salon theme whose admin-chosen heroBg is already white.
  const cardBg = shade(theme.heroBg, heroLight ? -6 : 10);
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
            <span
              className={`select-none ${compact ? "text-4xl" : "text-6xl"}`}
              style={{ opacity: allSold ? 0.5 : 1 }}
              aria-hidden="true"
            >
              {DEFAULT_PRODUCT_EMOJI}
            </span>
          )}
        </button>

        {/* Sold / out-of-stock badge */}
        {allSold && (
          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
            style={{ backgroundColor: "rgba(15,23,42,0.70)", color: "#FFFFFF" }}
          >
            {translateUi("Sold ")}</div>
        )}

        {/* Favourite — a sibling of the full-bleed "view details" button above, so it still
            paints on top and stays independently clickable without needing a z-index bump. */}
        {onToggleWish && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleWish(); }}
            aria-pressed={wished}
            aria-label={wished ? `Remove ${product.name} from favourites` : `Save ${product.name} to favourites`}
            title={wished ? translateUi("Remove from favourites") : translateUi("Save to favourites")}
            className={`absolute top-2.5 right-2.5 flex items-center justify-center rounded-full transition-colors cursor-pointer ${compact ? "w-7 h-7" : "w-8 h-8"}`}
            style={{ backgroundColor: heroLight ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.55)" }}
          >
            <Heart
              className={compact ? "w-3.5 h-3.5" : "w-4 h-4"}
              style={{ color: wished ? "#DC2626" : sub }}
              fill={wished ? "#DC2626" : "none"}
            />
          </button>
        )}
      </div>

      {/* Info — brand/name/category click opens detail; pills and add-to-cart stay interactive */}
      <div className={`flex flex-col flex-1 ${compact ? "p-2.5 gap-1" : "p-4 gap-2"}`} style={{ backgroundColor: cardBg, opacity: allSold ? 0.55 : 1 }}>
        {/* Brand */}
        <button onClick={onExpand} className="text-left cursor-pointer">
          {product.brandName && (
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.accentColor }}>
              {product.brandName}
            </span>
          )}

          {/* Name */}
          <h3 className={`font-bold leading-snug mt-0.5 ${compact ? "text-xs line-clamp-1" : "text-sm line-clamp-2"}`} style={{ color: theme.heroTextColor }}>
            {product.name}
          </h3>

          {/* Category */}
          {product.categoryName && !compact && (
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
        {product.variants.length > 1 && !compact && (
          <div className="flex flex-wrap gap-1 mt-1">
            {product.variants.map((v) => {
              const isSelected = v.id === (variant?.id);
              const soldOut = v.quantityOnHand <= 0;
              return (
                <button
                  key={v.id}
                  onClick={() => !soldOut && onSelectVariant(v.id)}
                  disabled={soldOut}
                  title={soldOut ? translateUi("Out of stock") : v.label || "Standard"}
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
        <div className={`mt-auto flex items-center justify-between gap-2 border-t ${compact ? "pt-2" : "pt-3"}`} style={{ borderColor: cardBorder }}>
          <div className="flex flex-col">
            {hasCompareAt && !compact && (
              <span className="text-[11px] line-through" style={{ color: sub }}>
                {formatPrice(variant!.compareAtPrice!, variant!.currency, uiLocale)}
              </span>
            )}
            <span
              className={`font-extrabold tracking-tight ${compact ? "text-sm" : "text-base"}`}
              style={{ color: outOfStock ? sub : hasCompareAt ? "#DC2626" : theme.accentColor }}
            >
              {variant ? formatPrice(variant.price, variant.currency, uiLocale) : "—"}
            </span>
          </div>
          <button
            disabled={outOfStock}
            onClick={() => variant && onAdd(variant)}
            className={`rounded-full flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 shrink-0 ${compact ? "w-7 h-7" : "w-9 h-9"}`}
            style={{ backgroundColor: `${theme.accentColor}18`, color: theme.accentColor, border: `1.5px solid ${theme.accentColor}44` }}
            title={outOfStock ? translateUi("Out of stock") : translateUi("Add to cart")}
          >
            <ShoppingBag className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
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
  const { t: translateUi, locale: uiLocale } = useI18n();
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
          aria-label={translateUi("Close")}
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
                <span className="text-8xl select-none" aria-hidden="true">{DEFAULT_PRODUCT_EMOJI}</span>
              )}
              {allSold && (
                <div
                  className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ backgroundColor: "rgba(15,23,42,0.70)", color: "#FFFFFF" }}
                >
                  {translateUi("Sold ")}</div>
              )}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setImgIdx((i) => (i - 1 + gallery.length) % gallery.length)}
                    aria-label={translateUi("Previous image")}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: heroLight ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.65)", color: sub }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgIdx((i) => (i + 1) % gallery.length)}
                    aria-label={translateUi("Next image")}
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
                    <img src={src} alt={""} className="w-full h-full object-contain p-1" />
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
                  {translateUi("Options ")}</p>
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
                        title={soldOut ? translateUi("Out of stock") : v.label || "Standard"}
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
                              {formatPrice(v.compareAtPrice!, v.currency, uiLocale)}
                            </span>
                          )}
                          <span style={{ color: isSelected ? accentText : vHasCompare ? "#DC2626" : "inherit" }}>
                            {formatPrice(v.price, v.currency, uiLocale)}
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
                    {formatPrice(variant!.compareAtPrice!, variant!.currency, uiLocale)}
                  </span>
                )}
                <span
                  className="text-2xl font-black tracking-tight"
                  style={{ color: allSold ? sub : hasCompareAt ? "#DC2626" : theme.accentColor }}
                >
                  {variant ? formatPrice(variant.price, variant.currency, uiLocale) : "—"}
                </span>
              </div>

              {/* Stock note */}
              {!allSold && variant && variant.quantityOnHand > 0 && variant.quantityOnHand <= 5 && (
                <span className="text-xs mb-1" style={{ color: "#F59E0B" }}>
                  {translateUi("Only ")}{variant.quantityOnHand} {translateUi("left ")}</span>
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
              {allSold ? translateUi("Sold out") : outOfStock ? translateUi("This option is out of stock") : translateUi("Add to cart")}
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
  const { t: translateUi, locale: uiLocale } = useI18n();
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
            {translateUi("Your cart (")}{cart.count})
          </span>
          <button onClick={onClose} className="cursor-pointer" style={{ color: sub }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {cart.lines.length === 0 && (
            <p className="text-sm text-center py-10" style={{ color: sub }}>{translateUi("Your cart is empty.")}</p>
          )}
          {cart.lines.map((l) => (
            <div key={l.variantId} className="flex gap-3">
              <div
                className="w-14 h-14 rounded-lg shrink-0 overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: `${theme.accentColor}14` }}
              >
                {l.imageUrl ? (
                  <img src={l.imageUrl} alt={""} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl select-none" aria-hidden="true">{DEFAULT_PRODUCT_EMOJI}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: theme.heroTextColor }}>{l.productName}</p>
                {l.variantLabel && <p className="text-[11px]" style={{ color: sub }}>{l.variantLabel}</p>}
                <p className="text-xs mt-0.5" style={{ color: sub }}>{formatPrice(l.unitPrice, l.currency, uiLocale)} {translateUi("each")}</p>
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
                {formatPrice(l.unitPrice * l.quantity, l.currency, uiLocale)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t px-4 py-4" style={{ borderColor: border }}>
          <div className="flex items-center justify-between text-sm font-bold mb-3" style={{ color: theme.heroTextColor }}>
            <span>{translateUi("Subtotal")}</span>
            <span>{formatPrice(cart.subtotal, cart.currency, uiLocale)}</span>
          </div>
          <button
            disabled={cart.lines.length === 0}
            onClick={onCheckout}
            className="w-full text-sm font-semibold px-4 py-3 rounded-xl transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.accentColor, color: accentText }}
          >
            {translateUi("Proceed to checkout ")}</button>
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
  const { t: translateUi, locale: uiLocale } = useI18n();
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
        <p className="text-sm mb-4" style={{ color: sub }}>{translateUi("Your cart is empty.")}</p>
        <button onClick={onCancel} className="text-sm font-semibold cursor-pointer" style={{ color: theme.accentColor }}>
          {translateUi("← Back to shop ")}</button>
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
      const result = await apiFetch<ShopOrder | { order: ShopOrder; checkoutUrl: string }>(`${API_BASE}/api/salon/${salon.id}/shop/orders`, {
        method: "POST",
        body: JSON.stringify({
          customerName: f.customerName.trim(),
          customerEmail: f.customerEmail.trim(),
          customerPhone: f.customerPhone.trim() || undefined,
          shippingAddress: address,
          items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          communicationPreference: f.communicationPreference,
          // Stripe returns here (same origin) so the pending-order hand-off in sessionStorage survives.
          returnUrl: window.location.href,
        }),
      });
      const order = "order" in result ? result.order : result;
      if ("checkoutUrl" in result && result.checkoutUrl) {
        window.sessionStorage.setItem(`shop-pending-order:${salon.id}`, JSON.stringify(order));
        window.location.assign(result.checkoutUrl);
        return;
      }
      onPlaced(order);
    } catch (e) {
      setSubmitError(friendlyMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <button onClick={onCancel} className="text-xs font-semibold mb-5 inline-flex items-center gap-1.5 cursor-pointer" style={{ color: sub }}>
        <ArrowLeft className="w-3.5 h-3.5" /> {translateUi("Back to shop ")}</button>
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-6" style={{ color: theme.heroTextColor }}>
        {translateUi("Checkout ")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>{translateUi("Your details")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full name */}
              <div className="flex flex-col">
                <label className="text-xs" style={labelStyle}>
                  {translateUi("Full name ")}<span style={{ color: errorColor }}>*</span>
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
                  {translateUi("Email ")}<span style={{ color: errorColor }}>*</span>
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
                {translateUi("Phone ")}<span className="text-[10px]" style={{ color: sub }}>{translateUi("(optional)")}</span>
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
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>{translateUi("Shipping address ")}<span className="text-[10px] font-normal normal-case tracking-normal" style={{ color: sub }}>{translateUi("(optional)")}</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs sm:col-span-2" style={labelStyle}>
                {translateUi("Address line 1 ")}<input className={inputCls} style={inputStyle("line1")} value={f.line1} onChange={set("line1")} autoComplete="address-line1" />
              </label>
              <label className="text-xs sm:col-span-2" style={labelStyle}>
                {translateUi("Address line 2 ")}<input className={inputCls} style={inputStyle("line2")} value={f.line2} onChange={set("line2")} autoComplete="address-line2" />
              </label>
              <label className="text-xs" style={labelStyle}>
                {translateUi("City ")}<input className={inputCls} style={inputStyle("city")} value={f.city} onChange={set("city")} autoComplete="address-level2" />
              </label>
              <label className="text-xs" style={labelStyle}>
                {translateUi("State / region ")}<input className={inputCls} style={inputStyle("state")} value={f.state} onChange={set("state")} autoComplete="address-level1" />
              </label>
              <label className="text-xs" style={labelStyle}>
                {translateUi("Country ")}{countries.length > 0 ? (
                  <select
                    className={inputCls}
                    style={inputStyle("country")}
                    value={f.country}
                    onChange={set("country")}
                    autoComplete="country-name"
                  >
                    <option value="">{translateUi("— Select country —")}</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input className={inputCls} style={inputStyle("country")} value={f.country} onChange={set("country")} autoComplete="country-name" />
                )}
              </label>
              <label className="text-xs" style={labelStyle}>
                {translateUi("ZIP / postcode ")}<input className={inputCls} style={inputStyle("zipCode")} value={f.zipCode} onChange={set("zipCode")} autoComplete="postal-code" />
              </label>
            </div>
          </div>

          {/* Communication preference */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>
              {translateUi("Order notifications ")}</p>
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
                        {opt === "IMPORTANT_ONLY" ? translateUi("Important only") : translateUi("All updates")}
                      </span>
                      <span className="text-[11px]" style={{ color: sub }}>
                        {opt === "IMPORTANT_ONLY"
                          ? translateUi("Shipping, invoice, refund & credit notifications")
                          : translateUi("Every status change and activity on your order")}
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
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: theme.accentColor }}>{translateUi("Order summary")}</p>
          <div className="flex flex-col gap-2 mb-3">
            {lines.map((l) => (
              <div key={l.variantId} className="flex items-start justify-between text-xs" style={{ color: theme.heroTextColor }}>
                <span className="pr-2">
                  {l.quantity} × {l.productName}
                  {l.variantLabel ? ` · ${l.variantLabel}` : ""}
                </span>
                <span>{formatPrice(l.unitPrice * l.quantity, l.currency, uiLocale)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 flex items-center justify-between text-sm font-bold" style={{ borderColor: cardBorder, color: theme.heroTextColor }}>
            <span>{translateUi("Total")}</span>
            <span>{formatPrice(subtotal, currency, uiLocale)}</span>
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
            {busy ? translateUi("Processing…") : `Pay ${formatPrice(subtotal, currency, uiLocale)}`}
          </button>

          <p className="text-[10px] text-center mt-2" style={{ color: sub }}>
            {translateUi("Payment is simulated — no card is charged. ")}</p>
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
  const { t: translateUi, locale: uiLocale } = useI18n();
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
              {translateUi("My Account ")}</span>
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
            <span className="font-semibold">{translateUi("Customer accounts — coming soon")}</span>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: sub }}>
            {translateUi("Sign in with your email or mobile number to track orders, manage returns, and save your details for faster checkout. ")}</p>

          {/* Email input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: sub }}>
              {translateUi("Email ")}</label>
            <input
              type="email"
              disabled
              placeholder={"your@email.com"}
              className="w-full text-sm rounded-lg px-3 py-2.5 outline-none cursor-not-allowed opacity-50"
              style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, color: heroLight ? "#0F172A" : "#F8FAFC" }}
            />
          </div>

          <div className="flex items-center gap-2" style={{ color: sub }}>
            <div className="flex-1 h-px" style={{ backgroundColor: border }} />
            <span className="text-[10px] font-medium">{translateUi("or")}</span>
            <div className="flex-1 h-px" style={{ backgroundColor: border }} />
          </div>

          {/* Mobile input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: sub }}>
              {translateUi("Mobile number ")}</label>
            <input
              type="tel"
              disabled
              placeholder={"+1 (555) 000-0000"}
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
            {translateUi("Continue ")}</button>
        </div>
      </aside>
    </div>
  );
}
