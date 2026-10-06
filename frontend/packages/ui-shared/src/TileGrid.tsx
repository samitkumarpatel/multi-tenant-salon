import { useI18n } from "@salon/i18n";

interface Props {
  options: readonly string[];
  labels: Record<string, string>;
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Optional helper text shown under each tile's label. */
  descriptions?: Record<string, string>;
}

function toggle(list: string[], val: string): string[] {
  return list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
}

export function TileGrid({ options, labels, selected, onChange, descriptions }: Props) {
  const { t } = useI18n();
  const hasDescriptions = !!descriptions && options.some((f) => descriptions[f]);
  return (
    <div className={hasDescriptions ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "grid grid-cols-2 sm:grid-cols-3 gap-2.5"}>
      {options.map((f) => {
        const on = selected.includes(f);
        const desc = descriptions?.[f];
        return (
          <button
            key={f}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggle(selected, f))}
            className={`flex gap-3 px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer select-none ${
              desc ? "items-start" : "items-center"
            } ${
              on
                ? "border-matcha-500 bg-matcha-50 text-matcha-700"
                : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
            }`}
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
              desc ? "mt-0.5" : ""
            } ${
              on ? "bg-matcha-600 border-matcha-600" : "border-stone-300"
            }`}>
              {on && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{t(labels[f] ?? f)}</span>
              {desc && (
                <span className={`block mt-1 text-xs leading-snug ${on ? "text-matcha-600" : "text-stone-500"}`}>
                  {t(desc)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
