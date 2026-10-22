/** Checkout results and renewal credentials belong only to the page that received them. */
export function navigationSearch(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of ["payment", "reference", "session_id", "renew"]) params.delete(key);
  const remaining = params.toString();
  return remaining ? `?${remaining}` : "";
}
