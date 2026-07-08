import { toggleList } from "~/lib/constants";

interface Props {
  options: readonly string[];
  labels: Record<string, string>;
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function TileGrid({ options, labels, selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-1.5">
      {options.map((f) => {
        const on = selected.includes(f);
        return (
          <div
            key={f}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-md border cursor-pointer transition-colors select-none ${on ? "border-matcha-400 bg-matcha-50" : "border-slate-200 bg-white hover:border-matcha-300 hover:bg-matcha-50/50"}`}
            onClick={() => onChange(toggleList(selected, f))}
          >
            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition-colors ${on ? "bg-matcha-600 border-matcha-600" : "border border-slate-300"}`}>
              {on && <span className="text-white text-[8px] font-bold">✓</span>}
            </div>
            <span className="text-xs font-medium text-slate-700">{labels[f] ?? f}</span>
          </div>
        );
      })}
    </div>
  );
}
