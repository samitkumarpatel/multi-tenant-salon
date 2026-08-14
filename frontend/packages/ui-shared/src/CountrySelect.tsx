import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Country } from "@salon/ui-website";
import { detectCountry } from "./locale";

interface Props {
  value: string;
  onChange: (value: string) => void;
  countries: Country[];
  className?: string;
}

export function CountrySelect({ value, onChange, countries, className = "" }: Props) {
  const [open, setOpen]             = useState(false);
  const [query, setQuery]           = useState("");
  const [highlighted, setHighlight] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (value || !countries.length) return;
    const detected = detectCountry(countries);
    if (detected) onChange(detected.name);
  }, [countries]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      // pre-highlight the currently selected item
      const idx = filtered.findIndex((c) => c.name === value);
      setHighlight(idx >= 0 ? idx : 0);
      searchRef.current?.focus();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // reset highlight when the filtered list changes
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // scroll highlighted item into view
  useEffect(() => {
    if (!open || highlighted < 0) return;
    const item = listRef.current?.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

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
    setHighlight(-1);
    triggerRef.current?.focus();
  }

  function select(c: Country) {
    onChange(c.name);
    close();
  }

  const filtered = query
    ? countries.filter((c) => {
        const q = query.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
      })
    : countries;

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => (h + 1 < filtered.length ? h + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => (h - 1 >= 0 ? h - 1 : filtered.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlighted >= 0 && filtered[highlighted]) select(filtered[highlighted]);
        break;
    }
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  }

  const inputCls = "w-full px-4 py-3 border border-stone-200 rounded-xl text-sm outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white transition-all text-left flex items-center justify-between";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${inputCls} ${!value ? "text-stone-300" : "text-stone-900"} ${className}`}
      >
        <span>{value || "Select country…"}</span>
        <svg className="w-3.5 h-3.5 text-stone-400 shrink-0" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={close} />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select country"
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
                onKeyDown={handleSearchKeyDown}
                placeholder="Search country…"
                aria-label="Search countries"
                aria-controls="country-listbox"
                aria-activedescendant={highlighted >= 0 ? `country-opt-${highlighted}` : undefined}
                className="flex-1 text-sm outline-none text-stone-900 placeholder:text-stone-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-stone-400 hover:text-stone-600 transition-colors px-1 text-base leading-none"
                >
                  ×
                </button>
              )}
            </div>

            <ul
              id="country-listbox"
              ref={listRef}
              role="listbox"
              aria-label="Countries"
              className="overflow-y-auto flex-1 overscroll-contain"
            >
              {filtered.map((c, i) => (
                <li key={c.code} role="option" aria-selected={c.name === value} id={`country-opt-${i}`}>
                  <button
                    type="button"
                    onClick={() => select(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-stone-100 ${
                      i === highlighted
                        ? "bg-matcha-100 text-matcha-800"
                        : c.name === value
                          ? "bg-matcha-50 text-matcha-700"
                          : "hover:bg-stone-50 text-stone-800"
                    }`}
                  >
                    <span className="text-sm flex-1">{c.name}</span>
                    <span className="text-xs text-stone-300 shrink-0">{c.code}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-12 text-center text-sm text-stone-400">No countries found</li>
              )}
            </ul>

            <p className="text-center text-[10px] text-stone-300 py-2 border-t border-stone-100 select-none">
              ↑ ↓ navigate · Enter select · Esc close
            </p>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
