import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export interface SessionBadgeProps {
  /** The signed-in user's email, shown as-is. */
  email: string;
  /** Access token expiry as epoch ms. Pass null/undefined when there's no
   *  token to expire (e.g. local mock-mode login) — the countdown is hidden. */
  expiresAt?: number | null;
  tone?: "slate" | "stone";
  className?: string;
}

const TONE = {
  slate: { border: "border-slate-200", text: "text-slate-600", dim: "text-slate-400", divider: "text-slate-300" },
  stone: { border: "border-stone-200", text: "text-stone-600", dim: "text-stone-400", divider: "text-stone-300" },
};

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Header pill showing who's signed in and, when there's an OAuth2 access
 *  token, a live countdown to its expiry. */
export function SessionBadge({ email, expiresAt, tone = "slate", className = "" }: SessionBadgeProps) {
  const [now, setNow] = useState(() => Date.now());
  const c = TONE[tone];

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const remaining = expiresAt != null ? expiresAt - now : null;
  const expired = remaining !== null && remaining <= 0;
  const expiringSoon = remaining !== null && !expired && remaining <= 60_000;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md border ${c.border} bg-white text-xs ${c.text} ${className}`}
    >
      <span className="truncate max-w-[120px] sm:max-w-[200px]" title={email}>{email}</span>
      {remaining !== null && (
        <>
          <span className={`${c.divider} shrink-0`}>·</span>
          <span
            className={`inline-flex items-center gap-1 font-mono tabular-nums shrink-0 ${
              expired ? "text-red-500 font-semibold" : expiringSoon ? "text-amber-600 font-semibold" : c.dim
            }`}
            title="Time until your session expires"
          >
            <Clock className="w-3 h-3" />
            {expired ? "Expired" : formatRemaining(remaining)}
          </span>
        </>
      )}
    </div>
  );
}
