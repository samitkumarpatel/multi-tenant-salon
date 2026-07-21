import type { Country } from "@saloon/ui-website";

function regionCode(tag: string): string {
  try {
    return new Intl.Locale(tag).region?.toUpperCase() ?? "";
  } catch {
    return "";
  }
}

export function detectCountry(countries: Country[]): Country | undefined {
  if (typeof navigator === "undefined" || !countries.length) return undefined;
  const tags = navigator.languages?.length ? [...navigator.languages] : [navigator.language];
  for (const tag of tags) {
    const region = regionCode(tag);
    if (region) {
      const match = countries.find((c) => c.code === region);
      if (match) return match;
    }
  }
  return undefined;
}
