import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, ChevronLeft, Play, Film, X, CalendarCheck, Quote, Images } from "lucide-react";
import { isVideoUrl, STAFF_ROLE_LABEL, CATEGORY_LABEL } from "./constants";
import type { StaffMember, WebsiteTheme } from "./types";

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

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const CARD_COLORS = ["#7C3AED", "#0284C7", "#D97706", "#DC2626", "#059669", "#EA580C", "#4F46E5"];
function cardColor(name: string) {
  return CARD_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % CARD_COLORS.length];
}

/** Focused "meet this stylist" panel: about + work grid + book CTA.
 *  Bottom-sheet on mobile, centred card on larger screens. Shared by the salon
 *  website's team section and the booking wizard's staff picker. */
export function StaffSpotlight({ member, theme, accentText, hasBooking, onBook, onClose }: {
  member: StaffMember; theme: WebsiteTheme; accentText: string;
  hasBooking?: boolean; onBook?: (m: StaffMember) => void; onClose: () => void;
}) {
  const media = member.workMedia ?? [];
  const avatar = staffAvatar(member);
  const firstName = member.name.split(" ")[0];
  const [lb, setLb] = useState<number | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { lb !== null ? setLb(null) : onClose(); return; }
      if (lb === null || media.length < 2) return;
      if (e.key === "ArrowRight") setLb((i) => ((i ?? 0) + 1) % media.length);
      if (e.key === "ArrowLeft") setLb((i) => ((i ?? 0) - 1 + media.length) % media.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb, media.length, onClose]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-6"
        style={{ animation: "sw-fade .18s ease" }}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${member.name} — profile`}
          className="flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
          style={{ maxHeight: "90vh", animation: "sw-sheet .22s cubic-bezier(0.16,1,0.3,1)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3.5 border-b border-slate-100 px-5 pb-3.5 pt-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: cardColor(member.name) }}>
              {avatar ? (
                <img src={avatar} alt={member.name} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <span className="text-base font-black text-white">{initials(member.name)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-tight text-slate-900">{member.name}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{STAFF_ROLE_LABEL[member.role] ?? member.role}</p>
              {member.specializations && member.specializations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {member.specializations.map((s) => (
                    <span key={s} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: theme.accentColor, color: accentText }}>
                      {CATEGORY_LABEL[s] ?? s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-m-1 shrink-0 p-1 text-slate-400 transition-colors hover:text-slate-700 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {member.bio && (
              <div className="relative pl-4">
                <span className="absolute bottom-0 left-0 top-1 w-1 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.accentColor }}>
                  <Quote className="h-3 w-3" /> About {firstName}
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{member.bio}</p>
              </div>
            )}

            {media.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <Images className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{firstName}&rsquo;s work</p>
                  <span className="text-[11px] text-slate-400">{media.length}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {media.map((url, i) => (
                    <MediaThumb key={url} url={url} className="aspect-square rounded-lg" onClick={() => setLb(i)} />
                  ))}
                </div>
              </div>
            )}

            {!member.bio && media.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400">
                {firstName} hasn&rsquo;t added a portfolio yet.
              </p>
            )}
          </div>

          {/* Footer CTA */}
          {hasBooking && onBook && (
            <div className="border-t border-slate-100 px-5 py-3.5">
              <button
                type="button"
                onClick={() => onBook(member)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: theme.accentColor, color: accentText }}
              >
                <CalendarCheck className="h-4 w-4" /> Book with {firstName}
              </button>
            </div>
          )}
        </div>
      </div>

      {lb !== null && media[lb] && (
        <Lightbox
          items={media}
          index={lb}
          title={member.name}
          onClose={() => setLb(null)}
          onPrev={() => setLb((i) => ((i ?? 0) - 1 + media.length) % media.length)}
          onNext={() => setLb((i) => ((i ?? 0) + 1) % media.length)}
        />
      )}
    </>,
    document.body,
  );
}
