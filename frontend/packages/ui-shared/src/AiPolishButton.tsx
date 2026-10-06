import { useI18n } from "@salon/i18n";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

export interface AiPolishResponse {
  text: string;
  suggestions: { polished: string; friendly: string; concise: string };
}

const versions = ["polished", "friendly", "concise"] as const;
type Version = typeof versions[number];

export interface AiPolishButtonProps {
  value: string;
  onApply: (text: string) => void;
  polish: (text: string) => Promise<AiPolishResponse>;
  children: ReactNode;
}

/** Suggestions stay local until explicitly applied; saving remains the form's job. */
export function AiPolishButton({ value, onApply, polish, children }: AiPolishButtonProps) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<{ original: string; suggestions: AiPolishResponse["suggestions"] } | null>(null);
  const [selected, setSelected] = useState<Version>("polished");
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => {
    request.current++;
    setBusy(false);
    setSuggestion(null);
    setError("");
    return () => { request.current++; };
  }, [value]);

  async function improve() {
    const id = ++request.current;
    setBusy(true);
    setError("");
    setSuggestion(null);
    try {
      const result = await polish(value);
      if (versions.some((version) => !result.suggestions?.[version]?.trim())) throw new Error("Missing suggestions.");
      if (id === request.current) {
        setSelected("polished");
        setSuggestion({ original: value, suggestions: result.suggestions });
      }
    } catch {
      if (id === request.current) setError("Could not improve this text. Please try again.");
    } finally {
      if (id === request.current) setBusy(false);
    }
  }

  return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-xs transition-[border-color,box-shadow] focus-within:border-matcha-500 focus-within:ring-2 focus-within:ring-matcha-500/10">
    <div className="[&>textarea]:block [&>textarea]:border-0 [&>textarea]:rounded-none [&>textarea]:bg-transparent [&>textarea]:focus:ring-0 [&>input]:block [&>input]:border-0 [&>input]:rounded-none [&>input]:bg-transparent [&>input]:focus:ring-0">
      {children}
    </div>
    <div className="flex justify-end px-2 pb-2 pt-1">
    <button type="button" onClick={improve} disabled={busy || !value.trim() || value.length > 5000}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-matcha-200 bg-matcha-50 px-2.5 py-1 font-semibold text-matcha-700 transition-colors hover:bg-matcha-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 disabled:opacity-40 disabled:cursor-not-allowed"
      title={translateUi("Improve spelling and wording while keeping your meaning")}>
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
      {busy ? translateUi("Improving…") : translateUi("Fix with AI")}
    </button>
    </div>
    {busy && <span role="status" className="sr-only">{translateUi("Improving your text")}</span>}
    {value.length > 5000 && <p className="px-3 pb-2 text-slate-500">{translateUi("AI editing supports up to 5,000 characters.")}</p>}
    {error && <p role="alert" className="px-3 pb-2 text-red-600">{error}</p>}
    {suggestion && suggestion.original === value && <div className="border-t border-matcha-200 bg-matcha-50/50 p-3" role="status">
      <p className="flex items-center gap-1.5 font-semibold text-matcha-700"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {translateUi("Choose a version")}</p>
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={translateUi("Suggestion style")}>
        {versions.map((version) => <button key={version} type="button" aria-pressed={selected === version}
          onClick={() => setSelected(version)}
          className={`min-h-8 rounded-md border px-3 py-1.5 font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 ${selected === version ? "border-matcha-300 bg-white text-matcha-700 shadow-sm" : "border-transparent text-slate-500 hover:bg-white/70"}`}>
          {version}
        </button>)}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{suggestion.suggestions[selected]}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="min-h-8 rounded-md bg-matcha-600 px-3 py-1.5 font-semibold text-white hover:bg-matcha-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 focus-visible:ring-offset-2" onClick={() => { onApply(suggestion.suggestions[selected]); setSuggestion(null); }}>{translateUi("Use this text")}</button>
        <button type="button" className="min-h-8 rounded-md px-3 py-1.5 text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500" onClick={() => setSuggestion(null)}>{translateUi("Dismiss")}</button>
      </div>
    </div>}
  </div>;
}
