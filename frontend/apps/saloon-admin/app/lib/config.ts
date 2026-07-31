export const SALOON_DOMAIN =
  import.meta.env.VITE_SALOON_DOMAIN ?? "my-saloon.online";

export const CONTACT_EMAIL = `contact@${SALOON_DOMAIN}`;
export const SUPPORT_EMAIL  = `support@${SALOON_DOMAIN}`;

const WEBSITE_BASE_URL: string =
  import.meta.env.VITE_WEBSITE_BASE_URL ?? "";

export function websiteUrl(handler: string): string {
  return WEBSITE_BASE_URL
    ? `${WEBSITE_BASE_URL}/?slug=${handler}`
    : `https://${handler}.${SALOON_DOMAIN}`;
}
