import { useState } from "react";
import { useLoaderData, useLocation } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  Scissors, MapPin, Phone, Mail, Globe, Clock, Timer,
  Sparkles, X, ChevronRight,
} from "lucide-react";
import { API, HANDLER_API, apiFetch } from "~/lib/api";
import { FEATURE_LABEL, DAY_SHORT, STAFF_ROLE_LABEL, CATEGORY_LABEL, formatPrice } from "~/lib/constants";
import type { Saloon, StaffMember, ServiceItem, OperatingHours } from "~/lib/types";

// ── Loader ────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const id = params.saloonId!;
  const saloon = await apiFetch<Saloon>(
    UUID_RE.test(id) ? `${API}/${id}` : `${HANDLER_API}/${id}`
  );
  const [staff, services] = await Promise.all([
    apiFetch<StaffMember[]>(`${API}/${saloon.id}/staff`).catch((): StaffMember[] => []),
    apiFetch<ServiceItem[]>(`${API}/${saloon.id}/services`).catch((): ServiceItem[] => []),
  ]);
  return { saloon, staff, services };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_ORDER = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function isOpenNow(hours?: OperatingHours[]): boolean {
  if (!hours?.length) return false;
  const now = new Date();
  const today = hours.find((h) => h.day === DAY_ORDER[now.getDay()]);
  if (!today || today.closed) return false;
  const [oh, om] = today.openTime.split(":").map(Number);
  const [ch, cm] = today.closeTime.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= oh * 60 + om && cur < ch * 60 + cm;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const PALETTES = [
  "bg-violet-100 text-violet-700 ring-violet-200",
  "bg-sky-100 text-sky-700 ring-sky-200",
  "bg-amber-100 text-amber-800 ring-amber-200",
  "bg-rose-100 text-rose-700 ring-rose-200",
  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "bg-orange-100 text-orange-700 ring-orange-200",
  "bg-indigo-100 text-indigo-700 ring-indigo-200",
];
function avatarColor(name: string) {
  return PALETTES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTES.length];
}

function groupByCategory(list: ServiceItem[]): [string, ServiceItem[]][] {
  const map = new Map<string, ServiceItem[]>();
  for (const s of list) {
    const cat = s.category ?? "OTHER";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(s);
  }
  return [...map.entries()];
}

// ── AI modal ──────────────────────────────────────────────────────────────────

const AI_SUGGESTIONS = [
  "Dark & luxurious — midnight black with gold accents",
  "Bright & airy — clean whites with pops of coral",
  "Warm & cozy — terracotta tones, soft lighting feel",
  "Minimalist — maximum whitespace, understated elegance",
];

function AiModal({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "thinking" | "done">("idle");

  function handleApply() {
    if (!prompt.trim()) return;
    setPhase("thinking");
    setTimeout(() => setPhase("done"), 2200);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">Customise with AI</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4">
          {phase === "done" ? (
            <div className="text-center py-6 flex flex-col items-center gap-3">
              <Sparkles className="w-6 h-6 text-amber-500" />
              <p className="text-sm font-semibold text-slate-900">AI personalisation is coming soon</p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">We've noted your style preference and will notify you when it launches.</p>
              <button onClick={onClose} className="text-xs text-amber-600 hover:underline cursor-pointer">Got it, close</button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">Describe the look and feel you want for your customer website.</p>
              <textarea
                className="w-full h-24 px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 placeholder:text-slate-300"
                placeholder="e.g. High-end and modern, dark backgrounds with gold accents…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={phase === "thinking"}
              />
              <div className="flex flex-col gap-1.5 mt-3">
                {AI_SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => setPrompt(s)}
                    className={`text-left text-xs px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                      prompt === s ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {phase !== "done" && (
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-between items-center">
            <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer">Cancel</button>
            <button onClick={handleApply} disabled={!prompt.trim() || phase === "thinking"}
              className="inline-flex items-center gap-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl cursor-pointer">
              {phase === "thinking"
                ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Thinking…</>
                : <><Sparkles className="w-3 h-3" /> Apply with AI</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Preview banner ────────────────────────────────────────────────────────────

function PreviewBanner({ handler, onCustomise }: { handler: string; onCustomise: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="bg-slate-950 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span className="text-slate-400 truncate">
          Admin preview — customers see this at{" "}
          <span className="text-white font-mono font-medium">{handler}.my-saloon.dk</span>
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={onCustomise}
          className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
          <Sparkles className="w-3 h-3" /> Customise with AI
        </button>
        <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SaloonPage() {
  const { saloon, staff, services } = useLoaderData<typeof clientLoader>();
  const location = useLocation();
  const isPreview = location.pathname.endsWith("/c");

  const [showAi, setShowAi] = useState(false);

  const open           = isOpenNow(saloon.operatingHours);
  const todayName      = DAY_ORDER[new Date().getDay()];
  const city           = [saloon.location?.city, saloon.location?.country].filter(Boolean).join(", ");
  const activeStaff    = staff.filter((m) => m.status === "ACTIVE");
  const activeServices = services.filter((s) => s.active);
  const grouped        = groupByCategory(activeServices);
  const openHours      = saloon.operatingHours?.filter((h) => !h.closed) ?? [];
  const hasBooking     = saloon.features?.includes("BOOKING");
  const featureBadges  = (saloon.features ?? []).filter((f) => f !== "STATIC_WEBSITE" && f !== "ANALYTICS");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white text-slate-900">
      {isPreview && (
        <PreviewBanner
          handler={saloon.handler ?? saloon.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}
          onCustomise={() => setShowAi(true)}
        />
      )}
      {showAi && <AiModal onClose={() => setShowAi(false)} />}

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <a href="#top" className="flex items-center gap-2 no-underline group shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#0F172A] flex items-center justify-center group-hover:bg-slate-700 transition-colors">
              <Scissors className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-sm font-bold text-slate-900">{saloon.name}</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-500">
            {activeServices.length > 0 && <a href="#services" className="hover:text-slate-900 no-underline transition-colors">Services</a>}
            {activeStaff.length > 0   && <a href="#team"     className="hover:text-slate-900 no-underline transition-colors">Team</a>}
            <a href="#contact" className="hover:text-slate-900 no-underline transition-colors">Contact</a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
              open
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}>
              {open && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
              {open ? "Open now" : "Closed"}
            </span>
            {hasBooking && (
              <a href="#contact"
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl no-underline transition-colors">
                Book now
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section id="top" className="bg-[#0F172A] text-white">
        <div className="max-w-5xl mx-auto px-6 py-20 sm:py-28">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {open ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-900/40 border border-amber-700/50 px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Open now
                </span>
              ) : (
                <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-3 py-1 rounded-full">
                  Currently closed
                </span>
              )}
              {city && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="w-3 h-3" /> {city}
                </span>
              )}
            </div>

            <h1 className="text-5xl sm:text-7xl font-bold text-white leading-[0.95] tracking-tight">
              {saloon.name}
            </h1>

            {/* Gold rule under the name */}
            <div className="w-16 h-0.5 bg-amber-400 mt-6" />

            {featureBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5">
                {featureBadges.map((f) => (
                  <span key={f} className="text-[11px] font-medium px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {FEATURE_LABEL[f] ?? f}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-8">
              {hasBooking && (
                <a href="#contact"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-6 py-3 rounded-xl no-underline transition-colors">
                  Book an appointment <ChevronRight className="w-4 h-4" />
                </a>
              )}
              {saloon.contact?.phone && (
                <a href={`tel:${saloon.contact.phone}`}
                  className="inline-flex items-center gap-2 border border-slate-600 hover:border-amber-500 text-slate-300 hover:text-amber-300 text-sm font-medium px-6 py-3 rounded-xl no-underline transition-colors">
                  <Phone className="w-4 h-4" /> {saloon.contact.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ────────────────────────────────────────────────────── */}
      {activeServices.length > 0 && (
        <section id="services" className="max-w-5xl mx-auto px-6 py-16 sm:py-20 w-full">
          <div className="mb-10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-2">What we offer</p>
            <h2 className="text-3xl font-bold text-slate-900">Services &amp; pricing</h2>
          </div>
          <div className="space-y-10">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 pb-3 border-b border-slate-100 mb-1">
                  {CATEGORY_LABEL[cat] ?? cat}
                </h3>
                {items.map((s) => (
                  <div key={s.id} className="flex items-start gap-4 py-4 border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-5 shrink-0 pt-0.5">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Timer className="w-3 h-3" /> {s.durationMinutes} min
                      </span>
                      <span className="text-sm font-bold text-slate-900 min-w-[56px] text-right tabular-nums">
                        {formatPrice(s.price, s.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Team ────────────────────────────────────────────────────────── */}
      {activeStaff.length > 0 && (
        <section id="team" className="bg-slate-50 border-y border-slate-100">
          <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
            <div className="mb-10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-2">The people behind your look</p>
              <h2 className="text-3xl font-bold text-slate-900">Meet our team</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeStaff.map((m, i) => (
                <div key={m.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col items-center text-center hover:shadow-md hover:border-amber-200 hover:-translate-y-0.5 transition-all"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold mb-3 ring-4 ${avatarColor(m.name)}`}>
                    {initials(m.name)}
                  </div>
                  <p className="text-sm font-bold text-slate-900 leading-tight">{m.name}</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium uppercase tracking-wide">
                    {STAFF_ROLE_LABEL[m.role] ?? m.role}
                  </p>
                  {m.specializations && m.specializations.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mt-2.5">
                      {m.specializations.slice(0, 3).map((s) => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {CATEGORY_LABEL[s] ?? s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Contact / Hours / Location ───────────────────────────────────── */}
      <section id="contact" className="max-w-5xl mx-auto px-6 py-16 sm:py-20 w-full">
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-2">Get in touch</p>
          <h2 className="text-3xl font-bold text-slate-900">Find us</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">

          {openHours.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Opening hours
              </h3>
              <div className="space-y-0.5">
                {openHours.map((h) => {
                  const isToday = h.day === todayName;
                  return (
                    <div key={h.day}
                      className={`flex items-center gap-3 text-sm rounded-md py-1.5 px-2 -mx-2 ${
                        isToday ? "bg-amber-50 text-amber-800 font-semibold" : "text-slate-600"
                      }`}>
                      <span className="w-7 shrink-0 text-xs">{DAY_SHORT[h.day] ?? h.day}</span>
                      <span className="font-mono text-xs">{h.openTime}–{h.closeTime}</span>
                      {isToday && <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-amber-500">today</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {saloon.contact && (saloon.contact.phone || saloon.contact.email || saloon.contact.website) && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> Contact
              </h3>
              <div className="flex flex-col gap-2.5">
                {saloon.contact.phone && (
                  <a href={`tel:${saloon.contact.phone}`} className="flex items-center gap-2.5 group no-underline">
                    <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 shrink-0 transition-colors" />
                    <span className="text-sm text-slate-700 group-hover:text-amber-600 transition-colors">{saloon.contact.phone}</span>
                  </a>
                )}
                {saloon.contact.email && (
                  <a href={`mailto:${saloon.contact.email}`} className="flex items-center gap-2.5 group no-underline">
                    <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 shrink-0 transition-colors" />
                    <span className="text-sm text-slate-700 group-hover:text-amber-600 transition-colors">{saloon.contact.email}</span>
                  </a>
                )}
                {saloon.contact.website && (
                  <a href={saloon.contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group no-underline">
                    <Globe className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 shrink-0 transition-colors" />
                    <span className="text-sm text-slate-700 group-hover:text-amber-600 transition-colors truncate">{saloon.contact.website}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {saloon.location && (saloon.location.address || saloon.location.city) && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> Address
              </h3>
              <address className="not-italic flex flex-col gap-0.5">
                {saloon.location.address && <p className="text-sm font-semibold text-slate-900">{saloon.location.address}</p>}
                {(saloon.location.zipCode || saloon.location.city) && (
                  <p className="text-sm text-slate-600">
                    {[saloon.location.zipCode, saloon.location.city].filter(Boolean).join(" ")}
                    {saloon.location.state ? `, ${saloon.location.state}` : ""}
                  </p>
                )}
                {saloon.location.country && <p className="text-sm text-slate-500">{saloon.location.country}</p>}
              </address>
              {saloon.location.city && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(city + " " + saloon.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-amber-600 hover:text-amber-700 no-underline transition-colors">
                  Open in Maps <ChevronRight className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-[#0F172A] mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center shrink-0">
              <Scissors className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{saloon.name}</p>
              {city && <p className="text-xs text-slate-500">{city}</p>}
            </div>
          </div>
          <p className="text-[11px] text-slate-600">© {new Date().getFullYear()} {saloon.name} · All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
