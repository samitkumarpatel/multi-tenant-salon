import { Info } from "lucide-react";

export function InfoBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800 leading-relaxed">
      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
