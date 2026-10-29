# Product pages and SEO

Each product has a tenant-scoped stable `handle` and a public URL such as
`https://bb.salonsaas.org/shop/products/repair-shampoo`. Numeric product and
variant IDs remain the keys used by inventory, carts, orders, and integrations.

## Publishing

Deploy the backend first. Its registered `V37__product_handles.sql` script backfills
existing products and reserves their handles. Then deploy the admin and public
website builds. The normal public website workflow uploads the complete
`build/client` directory, including `_worker.js` and `_routes.json`; deploying
only the SPA assets omits the server-rendered HTML, redirects, and sitemaps.
No new runtime secrets or Terraform resources are needed.

`npm run build:public` bundles a Cloudflare Pages advanced-mode Worker alongside
the SPA. It embeds the same public `VITE_API_BASE_URL` and `VITE_SALON_DOMAIN`
configuration used by the client. The Worker runs only for `/shop`,
`/shop/products/*`, `/sitemap.xml`, and `/robots.txt`; other pages and assets
continue through Pages static hosting.

## Rendering and routing

The Worker resolves the salon using the hostname (or `slug` only on localhost),
then uses public API endpoints to render product text, images, variant prices and
availability, canonical metadata, Open Graph metadata, and Product/Offer JSON-LD.
This HTML is identical for users and crawlers; there is no bot-only response.

The generated SPA fallback remains intact beneath the progressive product
preview. `entry.client.tsx` removes only the preview and its marked head tags
before hydration. React renders the interactive product route, reusing the
existing gallery, variant selector, and cart behavior. JavaScript-disabled
visitors can still read product information and follow product links.

Current product data and canonical URLs are requested on every HTML response;
`Cache-Control: no-store` prevents stale prices, visibility, or redirects. Future
edge caching must invalidate on product edits, inventory changes, and domain
changes. API outages produce retryable 503 responses, never a cached empty 200.
Unknown/deleted/unpublished products and disabled shops return 404 with noindex.
Products that are only out of stock remain visible with OutOfStock offers.

Old handles return the canonical handle through the API. The Worker issues a
301 redirect, preserving only variant/language context. Renamed and deleted
handles remain reserved so they cannot later identify a different product.
One canonical origin is used when a salon has an active preferred custom domain.
Product variants use `?variant=<variantId>`; their canonical URL is the parent
product. Sitemaps contain only current public URLs, and robots.txt advertises
the salon sitemap. Language controls currently change interface labels; product
names/descriptions are not translated, so localized product handles/hreflang are
outside this feature.

## Validation

- `npm run test:products --workspace=@salon/public-website`
- `npm run typecheck:all`
- `npm run build:public` and `npm run build:admin`
- `./mvnw -Dtest=ShopModuleTests,SchemaLocationsTest,DeskBookingPaymentTests test`

Browser verification should cover direct navigation and refresh, product-card
links, variant URLs, gallery images, cart IDs, mobile layout, canonical metadata,
and absence of hydration warnings. Production SEO verification should inspect
raw HTML and the deployed 301/404 responses as well as rendered content.
