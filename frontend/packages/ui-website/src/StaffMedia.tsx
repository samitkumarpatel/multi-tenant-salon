import { createPortal } from "react-dom";
import { ChevronRight, ChevronLeft, Play, Film, X } from "lucide-react";
import { isVideoUrl } from "./constants";
import type { StaffMember } from "./types";

/** The staff member's profile avatar, falling back to the first non-video item
 *  of their work gallery when no dedicated avatar is set. */
export function staffAvatar(m: StaffMember): string | undefined {
  if (m.avatarUrl && !isVideoUrl(m.avatarUrl)) return m.avatarUrl;
  return (m.workMedia ?? []).find((u) => !isVideoUrl(u));
}

/** A single work-sample tile — image, or video with a play affordance. Opens the lightbox on click. */
export function MediaThumb({ url, onClick, className = "" }: { url: string; onClick: () => void; className?: string }) {
  const video = isVideoUrl(url);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/thumb relative block overflow-hidden bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 ${className}`}
    >
      {video ? (
        <>
          <video src={url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center transition-transform group-hover/thumb:scale-110">
              <Play className="w-4 h-4 text-white translate-x-[1px]" fill="currentColor" />
            </span>
          </span>
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold uppercase tracking-wide">
            <Film className="w-2.5 h-2.5" /> Video
          </span>
        </>
      ) : (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
    </button>
  );
}

/** Full-screen photo / video viewer. Purely presentational — the parent owns index + keys. */
export function Lightbox({ items, index, title, onClose, onPrev, onNext }: {
  items: string[]; index: number; title: string;
  onClose: () => void; onPrev: () => void; onNext: () => void;
}) {
  const url = items[index];
  return createPortal(
    <div className="fixed inset-0 z-[130] flex flex-col bg-black/92 backdrop-blur-sm" style={{ animation: "sw-fade .15s ease" }} onClick={onClose}>
      <div className="flex items-center justify-between h-14 px-4 text-white/75 text-xs font-medium">
        <span className="tabular-nums">{title} · {index + 1} / {items.length}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="p-2 -m-2 hover:text-white transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-6 sm:px-16" onClick={(e) => e.stopPropagation()}>
        {isVideoUrl(url) ? (
          <video key={url} src={url} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg bg-black" />
        ) : (
          <img key={url} src={url} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
        )}
      </div>
      {items.length > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
