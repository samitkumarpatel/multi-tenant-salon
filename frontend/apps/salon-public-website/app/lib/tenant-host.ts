const RESERVED = new Set(["www", "admin", "api", "auth", "book", "staff", "dashboard", "super-admin", "customers"]);

/** Only local development may select a tenant through a query parameter. */
export function tenantHost(url: URL, platformDomain: string): { slug: string | null; customHostname: string | null } {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { slug: url.searchParams.get("slug"), customHostname: null };
  }
  if (hostname === platformDomain) return { slug: null, customHostname: null };
  if (hostname.endsWith(`.${platformDomain}`)) {
    const slug = hostname.slice(0, -(platformDomain.length + 1));
    return { slug: slug && !slug.includes(".") && !RESERVED.has(slug) ? slug : null, customHostname: null };
  }
  return { slug: null, customHostname: hostname };
}
