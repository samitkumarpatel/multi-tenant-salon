import { useEffect, useRef, useState } from "react";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import { ADMIN_API, apiFetch } from "~/lib/api";

/** Stripe's embedded account screens used by the admin app (all on the salon's own Stripe account). */
export type ConnectComponent = "account-onboarding" | "account-management" | "notification-banner" | "payments" | "payouts";

type AccountSession = { clientSecret: string; publishableKey: string; stripeAccountId: string };

// One Connect.js instance per salon: every component on the page shares its account session.
const instances = new Map<string, StripeConnectInstance>();

function connectFor(sid: string, publishableKey: string): StripeConnectInstance {
  let instance = instances.get(sid);
  if (!instance) {
    instance = loadConnectAndInitialize({
      publishableKey,
      // Called again by Connect.js whenever the short-lived session needs renewing.
      fetchClientSecret: async () =>
        (await apiFetch<AccountSession>(`${ADMIN_API}/${sid}/payments/stripe/account-session`, { method: "POST" })).clientSecret,
      appearance: { variables: { colorPrimary: "#2f6b4f", borderRadius: "10px", fontFamily: "inherit" } },
    });
    instances.set(sid, instance);
  }
  return instance;
}

/**
 * Mounts one of Stripe's embedded Connect components, so the owner works with payouts, payments, disputes and
 * account details here instead of signing in on stripe.com. The salon's account has full Stripe Dashboard access,
 * so Stripe may ask the owner to confirm their Stripe login inside the component for sensitive screens.
 */
export function StripeConnectEmbed({ sid, publishableKey, component, onExit }: {
  sid: string; publishableKey: string; component: ConnectComponent; onExit?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let element: HTMLElement | null = null;
    try {
      const created = connectFor(sid, publishableKey).create(component);
      if (component === "account-onboarding" && onExit) {
        (created as unknown as { setOnExit: (listener: () => void) => void }).setOnExit(onExit);
      }
      element = created;
      host.current?.appendChild(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => { element?.remove(); };
  }, [sid, publishableKey, component, onExit]);

  return error ? <p className="text-sm text-red-600">{error}</p> : <div ref={host} />;
}
