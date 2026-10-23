const SALON_DOMAIN = import.meta.env.VITE_SALON_DOMAIN ?? "salonsaas.org";

export const DASHBOARD_APP_URL = import.meta.env.VITE_DASHBOARD_APP_URL ??
  (import.meta.env.DEV ? "http://localhost:5179" : `https://dashboard.${SALON_DOMAIN}`);

export const ADMIN_APP_URL = import.meta.env.VITE_ADMIN_APP_URL ??
  (import.meta.env.DEV ? "http://localhost:5173" : `https://admin.${SALON_DOMAIN}`);

/**
 * Minutes with no touch or key press before the desk signs itself out. The tablet at a counter is
 * shared by whoever is on shift; without this, whoever picked it up next acted as whoever signed in
 * first. Signing out also ends the auth server session, so signing back in needs a real login rather
 * than one tap. 0 turns it off — the default during development, where it would only get in the way.
 */
export const IDLE_SIGN_OUT_MINUTES = Number(import.meta.env.VITE_DESK_IDLE_MINUTES ?? (import.meta.env.DEV ? 0 : 20));
