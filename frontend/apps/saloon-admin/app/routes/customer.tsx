import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { ONBOARDING_API as SALOON_ONBOARDING_API, apiFetch } from "~/lib/api";
import type { Saloon } from "~/lib/types";
import { FEATURE_LABEL } from "~/lib/constants";


export async function clientLoader() {
  try {
    return { saloons: await apiFetch<Saloon[]>(SALOON_ONBOARDING_API), error: null };
  } catch (e: unknown) {
    return { saloons: [] as Saloon[], error: e instanceof Error ? e.message : "Failed to load saloons" };
  }
}

function SaloonCard({ saloon: s }: { saloon: Saloon }) {
  const hasBooking = s.features?.includes("BOOKING");
  const place = [s.location?.city, s.location?.country].filter(Boolean).join(", ");

  return (
    <div className="bg-white rounded-2xl border border-stone-200 flex flex-col overflow-hidden">
      <div className="p-5 flex-1">
        <p className="font-semibold text-stone-900">{s.name}</p>
        {s.owner?.name && <p className="text-stone-500 text-xs mt-0.5">{s.owner.name}</p>}
        {place && <p className="text-stone-400 text-xs mt-0.5">{place}</p>}

        {s.features && s.features.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {s.features.map((f) => (
              <span key={f} className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                {FEATURE_LABEL[f] ?? f}
              </span>
            ))}
          </div>
        )}

        {(s.contact?.phone || s.contact?.email) && (
          <div className="mt-3 flex flex-col gap-1 border-t border-stone-100 pt-3">
            {s.contact?.phone && (
              <a href={`tel:${s.contact.phone}`} className="text-xs text-stone-400 no-underline hover:text-stone-700">
                {s.contact.phone}
              </a>
            )}
            {s.contact?.email && (
              <a href={`mailto:${s.contact.email}`} className="text-xs text-stone-400 no-underline hover:text-stone-700">
                {s.contact.email}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-5">
        <Link
          to={hasBooking ? `/${s.id}/book` : `/${s.id}`}
          className="block text-center w-full py-2.5 rounded-xl bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors no-underline"
        >
          {hasBooking ? "Book now" : "Visit saloon"}
        </Link>
      </div>
    </div>
  );
}

export default function Customer() {
  const { saloons, error } = useLoaderData<typeof clientLoader>();
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
    <div className="min-h-[100dvh] bg-cream">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-stone-400 hover:text-stone-700 no-underline shrink-0 text-sm">←</Link>
          <input
            type="search"
            placeholder="Search by name or city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl border border-stone-200 text-sm bg-stone-50 placeholder:text-stone-400 outline-none focus:border-stone-400 transition-colors"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-stone-400 hover:text-stone-600 shrink-0 text-xs">
              Clear
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <p className="text-xs text-stone-400 mb-4">
          {filtered.length} saloon{filtered.length !== 1 ? "s" : ""}
          {query ? ` for "${query}"` : ""}
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-500 text-sm">{query ? "No results found" : "No saloons yet"}</p>
            {!query && (
              <Link to="/new" className="inline-block mt-3 text-sm text-matcha-600 underline no-underline">
                Register yours →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((s) => (
              <SaloonCard key={s.id} saloon={s} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
