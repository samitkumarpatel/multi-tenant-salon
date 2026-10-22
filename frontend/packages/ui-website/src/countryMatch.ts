import type { Country } from "./types";

/**
 * Finds the country a salon's free-text `location.country` refers to. Salons store the country
 * name ("Denmark"), but older/imported data may hold the ISO code ("DK") or differ in case or
 * surrounding whitespace, so both are matched case-insensitively. Returns undefined when unknown.
 */
export function findCountry(countries: readonly Country[], value?: string | null): Country | undefined {
  const needle = value?.trim().toLowerCase();
  if (!needle) return undefined;
  return countries.find((c) => c.name.toLowerCase() === needle)
    ?? countries.find((c) => c.code.toLowerCase() === needle);
}
