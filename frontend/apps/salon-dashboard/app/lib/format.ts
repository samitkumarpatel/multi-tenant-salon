export function formatPrice(value: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency || "USD" }).format(value);
}
