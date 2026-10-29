import { useEffect, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import { useI18n } from "@salon/i18n";
import { apiFetch, API_BASE, ProductDetailModal, productPath, productDescription, productStructuredData, jsonLd,
  addToCart, fontStack, friendlyMessage, isNotFoundError } from "@salon/ui-website";
import { SiteHeader, SiteFooter } from "@salon/ui-website";
import type { ShopProduct } from "@salon/ui-website";
import type { TenantData } from "./website-shell";

export default function ProductPage() {
  const data = useOutletContext<TenantData | undefined>();
  const { handle } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [retry, setRetry] = useState(0);
  const [variantId, setVariantId] = useState<number | undefined>(() => Number(new URLSearchParams(location.search).get("variant")) || undefined);
  const salonId = data?.salon.id;
  const available = !!data?.salon.features?.includes("WEBSHOP");
  useEffect(() => {
    if (!salonId || !available) return;
    const controller = new AbortController();
    setProduct(null); setError(""); setNotFound(false);
    apiFetch<ShopProduct>(`${API_BASE}/api/salon/${salonId}/shop/products/by-handle/${encodeURIComponent(handle ?? "")}`, { signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return;
        if (value.handle !== handle) {
          const target = new URL(productPath(value.handle, location.search), window.location.origin);
          const variant = new URLSearchParams(location.search).get("variant");
          if (variant) target.searchParams.set("variant", variant);
          navigate(`${target.pathname}${target.search}`, { replace: true });
        } else setProduct(value);
      })
      .catch((e) => { if (!controller.signal.aborted) { setNotFound(isNotFoundError(e)); setError(friendlyMessage(e)); } });
    return () => controller.abort();
  }, [salonId, available, handle, retry, navigate]);

  useEffect(() => {
    if (!product || !data) return;
    const oldTitle = document.title;
    document.title = `${product.name} | ${data.salon.name}`;
    const canonical = new URL(`/shop/products/${encodeURIComponent(product.handle)}`, data.canonicalOrigin).href;
    const tags: HTMLElement[] = [];
    const meta = (key: string, value: string, property = false) => {
      const element = document.createElement("meta"); element.setAttribute(property ? "property" : "name", key); element.content = value;
      document.head.appendChild(element); tags.push(element);
    };
    meta("description", productDescription(product));
    meta("og:title", document.title, true); meta("og:description", productDescription(product), true);
    meta("og:url", canonical, true); meta("og:type", "product", true);
    if (product.imageUrl) meta("og:image", product.imageUrl, true);
    const script = document.createElement("script"); script.type = "application/ld+json";
    script.textContent = jsonLd(productStructuredData(product, data.salon, canonical));
    document.head.appendChild(script); tags.push(script);
    return () => { document.title = oldTitle; tags.forEach((tag) => tag.remove()); };
  }, [product, data]);

  useEffect(() => {
    if (available && !notFound) return;
    const robots = document.createElement("meta"); robots.name = "robots"; robots.content = "noindex";
    document.head.appendChild(robots); return () => robots.remove();
  }, [available, notFound]);

  if (!data) return null;
  const search = new URLSearchParams();
  const source = new URLSearchParams(location.search);
  for (const key of ["slug", "lang"]) if (source.get(key)) search.set(key, source.get(key)!);
  const suffix = search.size ? `?${search}` : "";
  const pagePath = (page: string) => `/${page}${suffix}`;
  const go = (page: string | null) => navigate(page ? pagePath(page) : `/${suffix}`);
  return <div className="flex min-h-dvh flex-col" style={{ backgroundColor: data.theme.heroBg, color: data.theme.heroTextColor, fontFamily: fontStack(data.theme.fontFamily) }}>
    <SiteHeader salon={data.salon} theme={data.theme} current="shop" getPagePath={pagePath} onNavigate={go} onBack={() => go("shop")} />
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <a href={pagePath("shop")} className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold underline">← {t("Shop")}</a>
      {!available || notFound ? <div><h1 className="text-2xl font-bold">{t("Product not found")}</h1><p className="mt-3">{t("This product is no longer available.")}</p></div>
        : error ? <div role="alert"><p>{error}</p><button className="min-h-11 cursor-pointer underline" onClick={() => setRetry((value) => value + 1)}>{t("Try again")}</button></div>
        : !product ? <p role="status">{t("Loading…")}</p>
        : <ProductDetailModal inline product={product} theme={data.theme} selectedVariantId={variantId}
          onSelectVariant={(id) => {
            setVariantId(id);
            const query = new URLSearchParams(location.search); query.set("variant", String(id));
            navigate(`${location.pathname}?${query}`, { replace: true });
          }}
          onClose={() => go("shop")}
          onAdd={(variant) => {
            addToCart(String(data.salon.id), { variantId: variant.id, productId: product.id, productName: product.name,
              variantLabel: variant.label ?? null, unitPrice: variant.price, currency: variant.currency,
              imageUrl: product.imageUrl ?? null, maxQuantity: variant.quantityOnHand });
            const target = new URL(pagePath("shop"), window.location.origin); target.searchParams.set("cart", "1");
            navigate(`${target.pathname}${target.search}`);
          }} />}
    </main>
    <SiteFooter salon={data.salon} theme={data.theme} policies={data.shopPolicies} current="shop" getPagePath={pagePath} onBack={() => go("shop")} />
  </div>;
}
