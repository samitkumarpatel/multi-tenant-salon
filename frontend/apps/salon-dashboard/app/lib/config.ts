const SALON_DOMAIN = import.meta.env.VITE_SALON_DOMAIN ?? "salonsaas.org";

export const DASHBOARD_APP_URL = import.meta.env.VITE_DASHBOARD_APP_URL ??
  (import.meta.env.DEV ? "http://localhost:5179" : `https://dashboard.${SALON_DOMAIN}`);

export const ADMIN_APP_URL = import.meta.env.VITE_ADMIN_APP_URL ??
  (import.meta.env.DEV ? "http://localhost:5173" : `https://admin.${SALON_DOMAIN}`);
