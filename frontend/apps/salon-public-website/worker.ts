import { tenantHost } from "./app/lib/tenant-host.ts";
import { productDescription, productStructuredData, jsonLd } from "../../packages/ui-website/src/productSeo.ts";
import type { Salon, ShopProduct } from "../../packages/ui-website/src/types.ts";

declare const __PUBLIC_API_BASE__: string;
declare const __SALON_DOMAIN__: string;
type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };
class HttpError extends Error { status: number; constructor(status: number) { super(String(status)); this.status = status; } }
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const safeImage = (value: string | null | undefined) => { try { const url = new URL(value ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };

/** The same public HTML is served to people and crawlers; no user-agent branching. */
export async function handleRequest(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const productMatch = url.pathname.match(/^\/shop\/products\/([^/]+)\/?$/);
  if (!productMatch && !["/shop", "/shop/", "/sitemap.xml", "/robots.txt"].includes(url.pathname)) return env.ASSETS.fetch(request);
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  const platform = typeof __SALON_DOMAIN__ === "undefined" ? "salonsaas.org" : __SALON_DOMAIN__;
  const api = typeof __PUBLIC_API_BASE__ === "undefined" ? "https://api.salonsaas.org" : __PUBLIC_API_BASE__;
  const json = async <T,>(path: string): Promise<T> => {
    const response = await fetcher(`${api}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new HttpError(response.status === 404 ? 404 : 503);
    return response.json() as Promise<T>;
  };
  const respond = (body: string, status = 200, type = "text/html; charset=utf-8") => new Response(request.method === "HEAD" ? null : body, {
    status, headers: { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
  try {
    const tenant = tenantHost(url, platform);
    if (!tenant.slug && !tenant.customHostname) throw new HttpError(404);
    const resolved = tenant.customHostname ? await json<{ salonId: string }>(`/api/salon/domain/resolve?hostname=${encodeURIComponent(tenant.customHostname)}`) : null;
    const salon = await json<Salon>(`/api/salon/${encodeURIComponent(resolved?.salonId ?? tenant.slug!)}`);
    if (salon.status === "DISABLED" || !salon.features?.includes("STATIC_WEBSITE")) throw new HttpError(404);
    const preferred = await json<{ hostname: string | null }>(`/api/salon/${salon.id}/website/domain`);
    // One canonical origin for custom domains and the platform tenant alias.
    const canonicalOrigin = preferred.hostname ? new URL(`https://${preferred.hostname}`).origin : `https://${salon.handler}.${platform}`;
    const suffix = url.hostname === "localhost" || url.hostname === "127.0.0.1" ? `?slug=${encodeURIComponent(salon.handler ?? "")}` : "";
    if (url.pathname === "/robots.txt") return respond(`User-agent: *\nAllow: /\nSitemap: ${canonicalOrigin}/sitemap.xml\n`, 200, "text/plain; charset=utf-8");
    const enabled = salon.features?.includes("WEBSHOP");
    if (!enabled && url.pathname !== "/sitemap.xml") throw new HttpError(404);
    if (url.pathname === "/sitemap.xml") {
      const products = enabled ? await json<ShopProduct[]>(`/api/salon/${salon.id}/shop/products`) : [];
      const urls = ["/", ...(enabled ? ["/shop"] : []), ...products.filter((p) => p.active && p.handle && p.variants.some((v) => v.active))
        .map((p) => `/shop/products/${encodeURIComponent(p.handle)}`)];
      return respond(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>${escape(canonicalOrigin + path)}</loc></url>`).join("")}</urlset>`, 200, "application/xml; charset=utf-8");
    }
    const asset = await env.ASSETS.fetch(new Request(new URL("/index.html", url), { method: "GET" }));
    if (!asset.ok) throw new HttpError(503);
    let title: string, description: string, canonical: string, content: string, image = "", structured: unknown = null;
    if (productMatch) {
      let handle: string;
      try { handle = decodeURIComponent(productMatch[1]); } catch { throw new HttpError(404); }
      const product = await json<ShopProduct>(`/api/salon/${salon.id}/shop/products/by-handle/${encodeURIComponent(handle)}`);
      if (!product.active || !product.variants.some((variant) => variant.active)) throw new HttpError(404);
      const path = `/shop/products/${encodeURIComponent(product.handle)}`;
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (handle !== product.handle || url.pathname !== path || (!local && url.origin !== canonicalOrigin)) {
        const target = new URL(path, local ? url.origin : canonicalOrigin);
        for (const key of ["variant", "lang"]) if (url.searchParams.get(key)) target.searchParams.set(key, url.searchParams.get(key)!);
        if (local && url.searchParams.get("slug")) target.searchParams.set("slug", url.searchParams.get("slug")!);
        return new Response(null, { status: 301, headers: { Location: target.href, "Cache-Control": "no-store" } });
      }
      canonical = canonicalOrigin + path; title = `${product.name} | ${salon.name}`; description = productDescription(product);
      image = safeImage(product.imageUrl); structured = productStructuredData(product, salon, canonical);
      const variants = product.variants.filter((variant) => variant.active);
      const gallery = (product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : []).map(safeImage).filter(Boolean);
      content = `<nav><a href="/shop${escape(suffix)}">← ${escape(salon.name)} shop</a></nav><main><h1>${escape(product.name)}</h1>${product.brandName ? `<p>${escape(product.brandName)}</p>` : ""}<div class="product-gallery">${gallery.map((src) => `<img src="${escape(src)}" alt="${escape(product.name)}">`).join("")}</div><p>${escape(product.description)}</p><ul>${variants.map((v) => `<li><a href="${escape(path)}?variant=${v.id}${suffix ? `&amp;slug=${encodeURIComponent(salon.handler ?? "")}` : ""}">${escape(v.label || product.name)}</a> — ${escape(v.price)} ${escape(v.currency)} · ${v.quantityOnHand > 0 ? "In stock" : "Out of stock"}</li>`).join("")}</ul></main>`;
    } else {
      const products = await json<ShopProduct[]>(`/api/salon/${salon.id}/shop/products`);
      title = `${salon.name} | Shop`; description = `Shop products from ${salon.name}.`; canonical = canonicalOrigin + "/shop";
      content = `<nav><a href="/${escape(suffix)}">${escape(salon.name)}</a></nav><main><h1>${escape(salon.name)} shop</h1><ul>${products.filter((p) => p.active && p.handle && p.variants.some((v) => v.active)).map((p) => `<li><a href="/shop/products/${encodeURIComponent(p.handle)}${escape(suffix)}">${escape(p.name)}</a></li>`).join("")}</ul></main>`;
    }
    // Preserve the SPA's generated fallback markup. The entry removes only this progressive
    // preview and its head tags before hydration; React then renders the same product route.
    const tags = `<title data-product-edge>${escape(title)}</title><meta data-product-edge name="description" content="${escape(description)}"><link data-product-edge rel="canonical" href="${escape(canonical)}"><meta data-product-edge property="og:title" content="${escape(title)}"><meta data-product-edge property="og:description" content="${escape(description)}"><meta data-product-edge property="og:type" content="${structured ? "product" : "website"}"><meta data-product-edge property="og:url" content="${escape(canonical)}">${image ? `<meta data-product-edge property="og:image" content="${escape(image)}">` : ""}${structured ? `<script data-product-edge type="application/ld+json">${jsonLd(structured)}</script>` : ""}<style data-product-edge>body:has(#product-edge-content)>:not(#product-edge-content):not(script){display:none}#product-edge-content{max-width:1100px;margin:auto;padding:32px 20px;font:16px/1.6 system-ui;color:#172033}#product-edge-content a{color:inherit}#product-edge-content img{max-width:100%;height:280px;object-fit:contain}.product-gallery{display:flex;overflow:auto;gap:16px}</style>`;
    const html = (await asset.text()).replace(/<title[^>]*>[\s\S]*?<\/title>/i, "")
      .replace("</head>", `${tags}</head>`).replace(/<body([^>]*)>/i, `<body$1><section id="product-edge-content">${content}</section>`);
    return respond(html);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 503;
    const title = status === 404 ? "Product or shop not found" : "Shop temporarily unavailable";
    return respond(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body><main><h1>${title}</h1><a href="/">Return to salon</a></main></body></html>`, status);
  }
}
export default { fetch(request: Request, env: Env) { return handleRequest(request, env); } };
