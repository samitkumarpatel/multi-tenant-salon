/** The salon's no-show fee rule, as the API returns it. */
export interface BookingFeePolicy {
  noShowFeeType: "NONE" | "PERCENT" | "FIXED";
  noShowFeeValue: number;
}

/** What the salon charges for a missed appointment costing {@code price}; 0 when it charges nothing. Mirrors the server. */
export function noShowFeeFor(policy: BookingFeePolicy | null | undefined, price: number | undefined): number {
  if (!policy || price == null) return 0;
  if (policy.noShowFeeType === "PERCENT") return Math.round(price * policy.noShowFeeValue) / 100;
  if (policy.noShowFeeType === "FIXED") return Math.min(policy.noShowFeeValue, price);
  return 0;
}
