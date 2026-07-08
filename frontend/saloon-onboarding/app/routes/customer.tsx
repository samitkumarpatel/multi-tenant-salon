import { useState } from "react";
import { useLoaderData, Link } from "react-router";
import {
  Scissors, MapPin, Phone, Mail, Globe, CalendarCheck, Star,
  ShoppingBag, BarChart3, CreditCard, ArrowLeft, Building2,
  Clock, Search, X,
} from "lucide-react";
import { API, apiFetch } from "~/lib/api";
import type { Saloon } from "~/lib/types";
import { DAY_SHORT } from "~/lib/constants";

export async function clientLoader() {
  return apiFetch<Saloon[]>(API);
}

const FEATURE_CONFIG: Record<string, { Icon: React.FC<{ className?: string }>; label: string; cls: string }> = {
  STATIC_WEBSITE:  { Icon: Globe,         label: "Website",    cls: "bg-blue-50   text-blue-700   border-blue-200"   },
  BOOKING:         { Icon: CalendarCheck, label: "Booking",    cls: "bg-green-50  text-green-700  border-green-200"  },
  MEMBERSHIP:      { Icon: CreditCard,    label: "Membership", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  WEBSHOP:         { Icon: ShoppingBag,   label: "Web Shop",   cls: "bg-orange-50 text-orange-700 border-orange-200" },
  ANALYTICS:       { Icon: BarChart3,     label: "Analytics",  cls: "bg-cyan-50   text-cyan-700   border-cyan-200"   },
  LOYALTY_PROGRAM: { Icon: Star,          label: "Loyalty",    cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
};

export default function Customer() {
  const saloons = useLoaderData<typeof clientLoader>();
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? saloons.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.location?.city?.toLowerCase().includes(query.toLowerCase()) ||
          s.location?.country?.toLowerCase().includes(query.toLowerCase()),
      )
    : saloons;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3 max-w-4xl mx-auto">
          <Link to="/" aria-label="Back" className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors shrink-0 no-underline">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 mr-auto">
            <div className="w-7 h-7 rounded-md bg-matcha-600 flex items-center justify-center shrink-0">
              <Scissors className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900 leading-none">SaloonHub</span>
          </div>
        </div>

        {/* Search bar — always visible below nav */}
        <div className="px-4 sm:px-6 pb-3 max-w-4xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search by name, city or country…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-matcha-500/30 focus:border-matcha-400 border border-transparent focus:border-matcha-300 transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Page title */}
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Discover Saloons</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} saloon{filtered.length !== 1 ? "s" : ""}
            {query ? ` matching "${query}"` : " available"}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-300" />
            </div>
            <h2 className="text-base font-bold text-slate-600 mb-1">
              {query ? "No results found" : "No saloons yet"}
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              {query ? `Try a different search term.` : "Be the first to list your saloon."}
            </p>
            {!query && (
              <Link
                to="/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 transition-colors no-underline"
              >
                Register a Saloon
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2">
            {filtered.map((s) => <SaloonCard key={s.id} saloon={s} />)}
          </div>
        )}
      </main>

      {/* Floating owner CTA */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-slate-200 px-4 py-3 sm:hidden">
        <Link
          to="/new"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 transition-colors no-underline"
        >
          <Scissors className="w-4 h-4" />
          Register Your Saloon
        </Link>
      </div>
    </div>
  );
}

function SaloonCard({ saloon: s }: { saloon: Saloon }) {
  const hasBooking = s.features?.includes("BOOKING");
  const openDays = s.operatingHours
    ?.filter((h) => !h.closed)
    .map((h) => DAY_SHORT[h.day] ?? h.day)
    .join("  ·  ") ?? "";
  const openCount = s.operatingHours?.filter((h) => !h.closed).length ?? 0;
  const adminUrl = `${import.meta.env.VITE_SALOON_APP_URL ?? "http://localhost:5174"}/${s.id}`;

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden">
      {/* Colour strip header */}
      <div className="bg-gradient-to-r from-matcha-600 to-matcha-500 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white leading-tight truncate">{s.name}</h2>
            <p className="text-matcha-200 text-xs mt-0.5">by {s.owner.name}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Scissors className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Location inline in header */}
        {(s.location?.city || s.location?.country) && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <MapPin className="w-3 h-3 text-matcha-300 shrink-0" />
            <span className="text-xs text-matcha-100">
              {[s.location.city, s.location.state, s.location.country].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5 flex-1">
        {/* Features */}
        {s.features?.length ? (
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400 mb-2">What we offer</p>
            <div className="flex flex-wrap gap-1.5">
              {s.features.map((f) => {
                const cfg = FEATURE_CONFIG[f];
                if (!cfg) return null;
                const { Icon, label, cls } = cfg;
                return (
                  <span key={f} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${cls}`}>
                    <Icon className="w-3 h-3" />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Contact */}
        {(s.contact?.phone || s.contact?.email || s.contact?.website) && (
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400 mb-2">Contact</p>
            <div className="flex flex-col gap-2">
              {s.contact?.phone && (
                <a href={`tel:${s.contact.phone}`} className="flex items-center gap-2.5 text-sm text-slate-700 hover:text-matcha-600 transition-colors no-underline group min-h-[36px]">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-matcha-100 transition-colors">
                    <Phone className="w-3.5 h-3.5 text-slate-500 group-hover:text-matcha-600" />
                  </span>
                  {s.contact.phone}
                </a>
              )}
              {s.contact?.email && (
                <a href={`mailto:${s.contact.email}`} className="flex items-center gap-2.5 text-sm text-slate-700 hover:text-matcha-600 transition-colors no-underline group min-h-[36px]">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-matcha-100 transition-colors">
                    <Mail className="w-3.5 h-3.5 text-slate-500 group-hover:text-matcha-600" />
                  </span>
                  {s.contact.email}
                </a>
              )}
              {s.contact?.website && (
                <a href={s.contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-slate-700 hover:text-matcha-600 transition-colors no-underline group min-h-[36px]">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-matcha-100 transition-colors">
                    <Globe className="w-3.5 h-3.5 text-slate-500 group-hover:text-matcha-600" />
                  </span>
                  <span className="truncate">{s.contact.website.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Hours */}
        {openCount > 0 && (
          <div className="flex items-start gap-2.5 text-sm text-slate-500 pt-1 border-t border-slate-100">
            <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </span>
            <div>
              <span className="font-medium text-slate-700">Open {openCount} days/week</span>
              {openDays && <p className="text-xs text-slate-400 mt-0.5">{openDays}</p>}
            </div>
          </div>
        )}
      </div>

      {/* CTA footer */}
      <div className="px-5 pb-5 pt-1">
        {hasBooking ? (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={adminUrl}
              className="flex items-center justify-center py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors no-underline"
            >
              View Details
            </a>
            <a
              href={adminUrl}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-matcha-600 text-sm font-semibold text-white hover:bg-matcha-700 transition-colors no-underline"
            >
              <CalendarCheck className="w-4 h-4" /> Book Now
            </a>
          </div>
        ) : (
          <a
            href={adminUrl}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-matcha-600 text-sm font-semibold text-white hover:bg-matcha-700 transition-colors no-underline"
          >
            Visit Saloon →
          </a>
        )}
      </div>
    </article>
  );
}
