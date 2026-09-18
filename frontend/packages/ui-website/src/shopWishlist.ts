import { useSyncExternalStore } from "react";

/**
 * Browser-side product wishlist. One list per salon, kept in `localStorage` under
 * `shop-wishlist:<salonId>` — client-side only, same as the cart (see `shopCart.ts`).
 * A tiny pub/sub keeps every `useWishlist` subscriber in the tab in sync after a mutation.
 */

const KEY_PREFIX = "shop-wishlist:";
const listeners = new Set<() => void>();

function keyFor(salonId: string) {
  return KEY_PREFIX + salonId;
}

function emit() {
  listeners.forEach((l) => l());
}

export function readWishlist(salonId: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(salonId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function writeWishlist(salonId: string, ids: number[]) {
  if (typeof window === "undefined") return;
  try {
    if (ids.length === 0) window.localStorage.removeItem(keyFor(salonId));
    else window.localStorage.setItem(keyFor(salonId), JSON.stringify(ids));
  } catch {
    /* private mode / quota — wishlist just won't persist */
  }
  emit();
}

export function toggleWishlist(salonId: string, productId: number) {
  const ids = readWishlist(salonId);
  const idx = ids.indexOf(productId);
  if (idx >= 0) ids.splice(idx, 1);
  else ids.push(productId);
  writeWishlist(salonId, ids);
}

/** React binding — re-renders on every wishlist mutation in this tab. */
export function useWishlist(salonId: string) {
  const json = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => JSON.stringify(readWishlist(salonId)),
    () => "[]",
  );
  const ids: number[] = (() => {
    try {
      return JSON.parse(json) as number[];
    } catch {
      return [];
    }
  })();
  return {
    ids,
    count: ids.length,
    has: (productId: number) => ids.includes(productId),
    toggle: (productId: number) => toggleWishlist(salonId, productId),
  };
}
