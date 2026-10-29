/** Keep tenant/language context without carrying a previous entry point or checkout credentials. */
export function feedbackHref(path: string, staffId?: string | number): string {
  const url = new URL(path, "https://salon.invalid");
  for (const key of ["payment", "reference", "session_id", "renew", "source", "staff"]) url.searchParams.delete(key);
  url.searchParams.set("source", staffId != null ? "WEBSITE_STYLIST" : "WEBSITE_FOOTER");
  if (staffId != null) url.searchParams.set("staff", String(staffId));
  return `${url.pathname}${url.search}${url.hash}`;
}
