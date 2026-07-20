interface Props {
  options: readonly string[];
  labels: Record<string, string>;
  selected: string[];
  onChange: (selected: string[]) => void;
}

function toggle(list: string[], val: string): string[] {
  return list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
}

export function TileGrid({ options, labels, selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {options.map((f) => {
        const on = selected.includes(f);
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(toggle(selected, f))}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer select-none ${
              on
                ? "border-matcha-500 bg-matcha-50 text-matcha-700"
                : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
            }`}
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
              on ? "bg-matcha-600 border-matcha-600" : "border-stone-300"
            }`}>
              {on && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm font-medium leading-tight">{labels[f] ?? f}</span>
          </button>
        );
      })}
    </div>
  );
}
