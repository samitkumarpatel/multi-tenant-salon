import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "right" | "bottom" | "top" | "left";
  delay?: number;
  className?: string;
}

export function Tooltip({ content, children, side = "right", delay = 350, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    if (side === "right")  setCoords({ top: r.top + r.height / 2, left: r.right + 10 });
    if (side === "left")   setCoords({ top: r.top + r.height / 2, left: r.left  - 10 });
    if (side === "bottom") setCoords({ top: r.bottom + 8,         left: r.left  + r.width / 2 });
    if (side === "top")    setCoords({ top: r.top - 8,            left: r.left  + r.width / 2 });
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [side, delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const style =
    side === "right"  ? { top: coords.top, left: coords.left, transform: "translateY(-50%)" } :
    side === "left"   ? { top: coords.top, left: coords.left, transform: "translate(-100%, -50%)" } :
    side === "bottom" ? { top: coords.top, left: coords.left, transform: "translateX(-50%)" } :
                        { top: coords.top, left: coords.left, transform: "translate(-50%, -100%)" };

  return (
    <>
      <div ref={wrapRef} onMouseEnter={show} onMouseLeave={hide} className={className ?? "block"}>
        {children}
      </div>

      {visible &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[9999] pointer-events-none animate-[fadeIn_0.12s_ease]"
            style={style}
          >
            {/* Arrow */}
            {side === "right" && (
              <span className="absolute -left-[5px] top-1/2 -translate-y-1/2 border-y-[5px] border-y-transparent border-r-[5px] border-r-slate-800" />
            )}
            {side === "left" && (
              <span className="absolute -right-[5px] top-1/2 -translate-y-1/2 border-y-[5px] border-y-transparent border-l-[5px] border-l-slate-800" />
            )}
            {side === "bottom" && (
              <span className="absolute -top-[5px] left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-b-[5px] border-b-slate-800" />
            )}
            {side === "top" && (
              <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-slate-800" />
            )}

            <div className="bg-slate-800 text-white text-[11px] leading-snug rounded-lg px-3 py-2 max-w-[220px] shadow-xl">
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
