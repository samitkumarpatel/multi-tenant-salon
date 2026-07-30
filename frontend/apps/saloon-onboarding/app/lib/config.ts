export const SALOON_DOMAIN =
  import.meta.env.VITE_SALOON_DOMAIN ?? "my-saloon.online";

export const ADMIN_APP_URL =
  import.meta.env.VITE_ADMIN_APP_URL ?? "http://localhost:5173";

export const CONTACT_EMAIL = `contact@${SALOON_DOMAIN}`;

// In dev, the public website runs at localhost:5174 with path-based routing.
// In production, it uses subdomain routing: {handler}.my-saloon.online.
// Set VITE_WEBSITE_BASE_URL=http://localhost:5174 in .env.local for dev.
const WEBSITE_BASE_URL: string =
  import.meta.env.VITE_WEBSITE_BASE_URL ?? "";

export function websiteUrl(handler: string): string {
  return WEBSITE_BASE_URL
    ? `${WEBSITE_BASE_URL}/?slug=${handler}`
    : `https://${handler}.${SALOON_DOMAIN}`;
}
