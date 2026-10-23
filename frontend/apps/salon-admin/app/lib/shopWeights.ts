/**
 * Estimates a variant's gross shipping weight from its label value + unit — the same rule as the
 * server's VariantWeights: contents (1 ml ≈ 1 g) plus 10 % packaging, rounded up to the next 10 g.
 * Counted units with no physical size (pcs, set, pair…) return null: the owner enters the weight.
 */
const GRAMS_PER_UNIT: Record<string, number> = {
  ml: 1, g: 1, l: 1000, kg: 1000, oz: 28.35, "fl oz": 29.57, lb: 453.59, tablet: 1, capsule: 1, sachet: 15,
};

export function estimateWeightGrams(value: string, unit: string): number | null {
  const perUnit = GRAMS_PER_UNIT[unit.trim().toLowerCase()];
  const amount = Number(value.trim().replace(",", "."));
  if (!perUnit || !Number.isFinite(amount) || amount <= 0) return null;
  // The epsilon absorbs float noise (250 × 1.1 = 275.00000000000006) so 250 ml gives 280, as on the server.
  return Math.ceil((amount * perUnit * 1.1) / 10 - 1e-9) * 10;
}

/** "280 g" / "1.25 kg" for display. */
export function formatWeight(grams: number, locale?: string): string {
  return grams >= 1000
    ? `${(grams / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} kg`
    : `${grams.toLocaleString(locale)} g`;
}

/** The salon's currency: that of the country it is in (`location.country` holds the country's name). */
export function salonCurrencyCode(
  salonCountry: string | undefined,
  countries: { name: string; code: string; currencyCode: string }[],
): string {
  if (!salonCountry) return "USD";
  const country = countries.find((c) => c.name.toLowerCase() === salonCountry.toLowerCase())
    ?? countries.find((c) => c.code === salonCountry.toUpperCase());
  return country?.currencyCode || "USD";
}
