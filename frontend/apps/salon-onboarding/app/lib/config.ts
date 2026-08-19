export const SALON_DOMAIN =
  import.meta.env.VITE_SALON_DOMAIN ?? "salonsaas.org";

export const ADMIN_APP_URL =
  import.meta.env.VITE_ADMIN_APP_URL ||
  (import.meta.env.DEV
    ? "http://localhost:5173"
    : `https://admin.${SALON_DOMAIN}`);

export const CONTACT_EMAIL = `contact@${SALON_DOMAIN}`;

// In dev, the public website runs at localhost:5174 with path-based routing.
// In production, it uses subdomain routing: {handler}.{SALON_DOMAIN}.
// Set VITE_WEBSITE_BASE_URL=http://localhost:5174 in .env.local for dev.
const WEBSITE_BASE_URL: string =
  import.meta.env.VITE_WEBSITE_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:5174" : "");

export function websiteUrl(handler: string): string {
  return WEBSITE_BASE_URL
    ? `${WEBSITE_BASE_URL}/?slug=${handler}`
    : `https://${handler}.${SALON_DOMAIN}`;
}
