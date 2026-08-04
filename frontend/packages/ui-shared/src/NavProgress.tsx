import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "loading" | "slow" | "completing";

export function NavProgress({ loading, slowAfterMs = 8000 }: { loading: boolean; slowAfterMs?: number }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [width,  setWidth] = useState(0);
  const timers             = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearAll() { timers.current.forEach(clearTimeout); timers.current = []; }

  useEffect(() => {
    clearAll();

    if (loading) {
      setPhase("loading");
      setWidth(8);
      timers.current.push(setTimeout(() => setWidth(35), 200));
      timers.current.push(setTimeout(() => setWidth(65), 700));
      timers.current.push(setTimeout(() => setWidth(80), 1800));
      timers.current.push(setTimeout(() => setPhase("slow"), slowAfterMs));
    } else {
      if (phase === "idle") return;
      setPhase("completing");
      setWidth(100);
      timers.current.push(setTimeout(() => { setPhase("idle"); setWidth(0); }, 350));
    }

    return clearAll;
  }, [loading]);

  if (phase === "idle") return null;

  if (phase === "slow") {
    return (
      <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-between gap-4 bg-amber-500 px-4 py-2 text-xs font-medium text-white shadow-md">
        <span>Taking longer than expected — check your connection.</span>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 rounded border border-white/40 px-2.5 py-1 hover:bg-white/10 cursor-pointer transition-colors"
        >
          ↻ Retry
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ width: `${width}%`, opacity: phase === "completing" ? 0 : 1 }}
      className="fixed top-0 left-0 h-0.5 bg-matcha-500 z-[9999] transition-[width,opacity] duration-300 ease-out pointer-events-none"
    />
  );
}
