import { X } from "lucide-react";

export function LegalModal({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center animate-[fade-in_0.15s_ease]"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 shrink-0">
          <h2 className="text-sm font-bold text-stone-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-stone-400 hover:text-stone-700 cursor-pointer p-1 -m-1 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          <pre className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap font-sans">{text}</pre>
        </div>
      </div>
    </div>
  );
}
