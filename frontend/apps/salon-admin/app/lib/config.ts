export const SALON_DOMAIN =
  import.meta.env.VITE_SALON_DOMAIN ?? "salonsaas.org";

export const CONTACT_EMAIL = `contact@${SALON_DOMAIN}`;
export const SUPPORT_EMAIL  = `support@${SALON_DOMAIN}`;

const WEBSITE_BASE_URL: string =
  import.meta.env.VITE_WEBSITE_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:5174" : "");

export function websiteUrl(handler: string): string {
  return WEBSITE_BASE_URL
    ? `${WEBSITE_BASE_URL}/?slug=${handler}`
    : `https://${handler}.${SALON_DOMAIN}`;
}
