import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Country } from "./types";
import { detectCountry } from "./locale";

interface Props {
  value: string;
  onChange: (value: string) => void;
  countries: Country[];
  defaultCountry?: string;
  autoFocus?: boolean;
}

function parsePhone(value: string): { dialCode: string; local: string } {
  if (!value) return { dialCode: "", local: "" };
  const space = value.indexOf(" ");
  if (space > 0 && value.startsWith("+")) {
    return { dialCode: value.slice(0, space), local: value.slice(space + 1) };
  }
  return { dialCode: "", local: value };
}

function defaultDialCode(countries: Country[], countryName?: string): string {
  if (countryName) {
    const match = countries.find((c) => c.name === countryName);
    if (match) return match.dialCode;
  }
  return detectCountry(countries)?.dialCode ?? countries[0]?.dialCode ?? "";
}

export default function PhoneInput({ value, onChange, countries, defaultCountry, autoFocus }: Props) {
  const parsed = parsePhone(value);
  const [dialCode, setDialCode] = useState(() => parsed.dialCode || defaultDialCode(countries, defaultCountry));
  const [local, setLocal]       = useState(parsed.local);
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus pops the on-screen keyboard, which shrinks the dvh-sized sheet a beat
    // after it mounts — a visible jump on touch devices. Desktop has no virtual
    // keyboard, so it keeps the instant-focus keyboard-nav-friendly behavior.
    if (open && !window.matchMedia("(pointer: coarse)").matches) searchRef.current?.focus();
  }, [open]);

  // Lock background scroll while the sheet is open (prevents scroll bleed-through
  // behind the fixed sheet on touch devices).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function emit(dc: string, loc: string) {
    onChange(dc && loc ? `${dc} ${loc}` : loc);
  }

  function select(c: Country) {
    setDialCode(c.dialCode);
    emit(c.dialCode, local);
    close();
  }

  const filtered = query
    ? countries.filter((c) => {
        const q = query.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.dialCode.includes(q);
      })
    : countries;

  const selected = countries.find((c) => c.dialCode === dialCode);

  return (
    <>
      <div className="flex border border-stone-200 rounded-xl bg-white focus-within:border-matcha-500 focus-within:ring-2 focus-within:ring-matcha-500/10 transition-all">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-3 border-r border-stone-200 bg-stone-50 rounded-l-xl text-sm font-mono text-stone-700 hover:bg-stone-100 active:bg-stone-200 transition-colors whitespace-nowrap select-none"
        >
          <span>{dialCode || "+"}</span>
          {selected && <span className="text-stone-400 text-xs">{selected.code}</span>}
          <svg className="w-3 h-3 text-stone-400" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <input
          autoFocus={autoFocus}
          type="tel"
          inputMode="numeric"
          value={local}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d\s\-()+]/g, "");
            setLocal(cleaned);
            emit(dialCode, cleaned);
          }}
          placeholder="555 000 0000"
          className="flex-1 min-w-0 px-4 py-3 text-sm outline-none text-stone-900 placeholder:text-stone-300 bg-white rounded-r-xl"
        />
      </div>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={close} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select country code"
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white rounded-t-2xl shadow-2xl max-h-[80dvh] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:w-80 sm:max-h-[70vh]"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
              <svg className="w-4 h-4 text-stone-400 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="9" cy="9" r="6"/>
                <path d="M15 15l-2.5-2.5" strokeLinecap="round"/>
              </svg>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or dial code…"
                className="flex-1 text-sm outline-none text-stone-900 placeholder:text-stone-400"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")}
                  className="text-stone-400 hover:text-stone-600 transition-colors px-1 text-base leading-none">
                  ×
                </button>
              )}
            </div>

            <ul className="overflow-y-auto flex-1 overscroll-contain">
              {filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => select(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-stone-100 ${
                      c.dialCode === dialCode ? "bg-matcha-50 text-matcha-700" : "hover:bg-stone-50 text-stone-800"
                    }`}
                  >
                    <span className="font-mono text-sm text-stone-400 w-10 shrink-0">{c.dialCode}</span>
                    <span className="text-sm flex-1">{c.name}</span>
                    <span className="text-xs text-stone-300 shrink-0">{c.code}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-12 text-center text-sm text-stone-400">No countries found</li>
              )}
            </ul>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
