import { toggleList } from "~/lib/constants";

interface Props {
  options: string[];
  labels: Record<string, string>;
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function TileGrid({ options, labels, selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {options.map((f) => {
        const on = selected.includes(f);
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(toggleList(selected, f))}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all cursor-pointer select-none active:scale-[0.97] ${
              on
                ? "border-matcha-400 bg-matcha-50 shadow-sm shadow-matcha-100"
                : "border-slate-200 bg-white hover:border-matcha-300 hover:bg-matcha-50/40"
            }`}
          >
            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
              on ? "bg-matcha-600" : "border-2 border-slate-300"
            }`}>
              {on && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className={`text-sm font-semibold leading-tight ${on ? "text-matcha-700" : "text-slate-700"}`}>
              {labels[f] ?? f}
            </span>
          </button>
        );
      })}
    </div>
  );
}
