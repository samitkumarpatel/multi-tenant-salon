const SALON_DOMAIN = import.meta.env.VITE_SALON_DOMAIN || "salonsaas.org";

export default function IndexPage() {
  const exampleUrl =
    typeof window !== "undefined" && window.location.hostname === "localhost"
      ? `${window.location.host}/your-salon`
      : `book.${SALON_DOMAIN}/your-salon`;

  return (
    <div
      className="min-h-[100dvh] relative flex flex-col items-center justify-center px-6 text-center overflow-hidden select-none"
      style={{ backgroundColor: "#0F172A", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes snip { 0%,100% { transform: rotate(-12deg) scale(1); } 50% { transform: rotate(12deg) scale(1.1); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .sc-snip  { animation: snip  2.6s ease-in-out infinite; }
        .sc-float { animation: float 4s   ease-in-out infinite; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.035, backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "28px 28px" }} />

      <div className="sc-float mb-8">
        <div className="sc-snip text-6xl leading-none">✂️</div>
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-white mb-3 leading-snug">
        Book your appointment
      </h1>
      <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
        Use the booking link your salon shared with you, e.g.{" "}
        <code className="text-xs text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md whitespace-nowrap">
          {exampleUrl}
        </code>
      </p>

      <p className="absolute bottom-7 text-[11px] font-medium tracking-widest uppercase text-slate-700">{SALON_DOMAIN}</p>
    </div>
  );
}
