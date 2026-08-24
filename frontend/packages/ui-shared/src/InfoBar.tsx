import { useState } from "react";
import { Info, X } from "lucide-react";

export function InfoBar({ id, children }: { id?: string; children: React.ReactNode }) {
  const storageKey = id ? `infobar-dismissed:${id}` : null;
  const [dismissed, setDismissed] = useState(() => {
    if (!storageKey) return false;
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    if (storageKey) {
      try { localStorage.setItem(storageKey, "1"); } catch {}
    }
  }

  return (
    <div className="relative flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg pl-4 pr-9 py-3 text-sm text-blue-800 leading-relaxed">
      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
      <span>{children}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
