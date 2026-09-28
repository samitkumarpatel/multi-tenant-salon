export function formatPrice(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(value);
}
