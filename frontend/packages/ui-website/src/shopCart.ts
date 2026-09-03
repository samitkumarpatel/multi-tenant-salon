import { useSyncExternalStore } from "react";
import type { CartLine } from "./types";

/**
 * Browser-side shopping cart. One cart per salon, kept in `localStorage` under
 * `shop-cart:<salonId>` — there is no server-side cart; checkout POSTs the whole thing.
 * A tiny pub/sub keeps every `useCart` subscriber in the tab in sync after a mutation.
 */

const KEY_PREFIX = "shop-cart:";
const listeners = new Set<() => void>();

function keyFor(salonId: string) {
  return KEY_PREFIX + salonId;
}

function emit() {
  listeners.forEach((l) => l());
}

export function readCart(salonId: string): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(salonId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        l && typeof l.variantId === "number" && typeof l.quantity === "number" && l.quantity > 0,
    );
  } catch {
    return [];
  }
}

function writeCart(salonId: string, lines: CartLine[]) {
  if (typeof window === "undefined") return;
  try {
    if (lines.length === 0) window.localStorage.removeItem(keyFor(salonId));
    else window.localStorage.setItem(keyFor(salonId), JSON.stringify(lines));
  } catch {
    /* private mode / quota — cart just won't persist */
  }
  emit();
}

export function addToCart(salonId: string, line: Omit<CartLine, "quantity">, quantity = 1) {
  const lines = readCart(salonId);
  const existing = lines.find((l) => l.variantId === line.variantId);
  const cap = Math.max(1, line.maxQuantity || 1);
  if (existing) {
    existing.quantity = Math.min(cap, existing.quantity + quantity);
  } else {
    lines.push({ ...line, quantity: Math.min(cap, Math.max(1, quantity)) });
  }
  writeCart(salonId, lines);
}

export function setCartQty(salonId: string, variantId: number, quantity: number) {
  let lines = readCart(salonId);
  if (quantity <= 0) {
    lines = lines.filter((l) => l.variantId !== variantId);
  } else {
    lines = lines.map((l) =>
      l.variantId === variantId ? { ...l, quantity: Math.min(Math.max(1, l.maxQuantity || 1), quantity) } : l,
    );
  }
  writeCart(salonId, lines);
}

export function removeFromCart(salonId: string, variantId: number) {
  writeCart(salonId, readCart(salonId).filter((l) => l.variantId !== variantId));
}

export function clearCart(salonId: string) {
  writeCart(salonId, []);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

/** React binding — re-renders on every cart mutation in this tab. */
export function useCart(salonId: string) {
  // Snapshot is the serialised cart: equal carts produce an `Object.is`-equal string,
  // so `useSyncExternalStore` doesn't loop.
  const json = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => JSON.stringify(readCart(salonId)),
    () => "[]",
  );
  const parsed: CartLine[] = (() => {
    try {
      return JSON.parse(json) as CartLine[];
    } catch {
      return [];
    }
  })();
  return {
    lines: parsed,
    count: cartCount(parsed),
    subtotal: cartSubtotal(parsed),
    currency: parsed[0]?.currency ?? "USD",
    add: (line: Omit<CartLine, "quantity">, quantity?: number) => addToCart(salonId, line, quantity),
    setQty: (variantId: number, quantity: number) => setCartQty(salonId, variantId, quantity),
    remove: (variantId: number) => removeFromCart(salonId, variantId),
    clear: () => clearCart(salonId),
  };
}
