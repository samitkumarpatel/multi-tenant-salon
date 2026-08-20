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

const ADMIN_BASE_URL: string =
  import.meta.env.VITE_ADMIN_APP_URL ||
  (import.meta.env.DEV ? "http://localhost:5173" : `https://admin.${SALON_DOMAIN}`);

export const ADMIN_APP_URL = ADMIN_BASE_URL;

export const STAFF_APP_URL: string =
  import.meta.env.VITE_STAFF_APP_URL ??
  (import.meta.env.DEV ? "http://localhost:5176" : `https://staff.${SALON_DOMAIN}`);

const BOOKING_BASE_URL: string =
  import.meta.env.VITE_BOOKING_APP_URL ??
  (import.meta.env.DEV ? "http://localhost:5177" : `https://book.${SALON_DOMAIN}`);

export function bookingUrl(handler: string): string {
  return `${BOOKING_BASE_URL}/${handler}`;
}
