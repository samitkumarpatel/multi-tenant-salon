import type { Salon, ShopProduct } from "./types";

/** Public product URLs never carry checkout, account-tab or previous variant context. */
export function productPath(handle: string, search = ""): string {
  const source = new URLSearchParams(search);
  const params = new URLSearchParams();
  for (const key of ["slug", "lang"]) if (source.get(key)) params.set(key, source.get(key)!);
  return `/shop/products/${encodeURIComponent(handle)}${params.size ? `?${params}` : ""}`;
}

export function productDescription(product: ShopProduct): string {
  return (product.description?.replace(/\s+/g, " ").trim() || product.name).slice(0, 160);
}

export function productStructuredData(product: ShopProduct, salon: Pick<Salon, "name">, canonical: string) {
  return {
    "@context": "https://schema.org", "@type": "Product", name: product.name,
    description: product.description || product.name, url: canonical,
    image: product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : [],
    ...(product.brandName ? { brand: { "@type": "Brand", name: product.brandName } } : {}),
    offers: product.variants.filter((variant) => variant.active).map((variant) => ({
      "@type": "Offer", url: `${canonical}?variant=${variant.id}`,
      price: String(variant.price), priceCurrency: variant.currency,
      availability: variant.quantityOnHand > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition", seller: { "@type": "Organization", name: salon.name },
      ...(variant.sku ? { sku: variant.sku } : {}),
    })),
  };
}

/** Safe inside a script element, including product names containing </script>. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** Preview only: the server adds a suffix if another product already reserves this handle. */
export function suggestProductHandle(name: string): string {
  return name.toLowerCase().replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ø/g, "o").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "") || "product";
}
