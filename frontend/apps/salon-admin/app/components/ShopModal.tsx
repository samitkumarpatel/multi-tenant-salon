import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  narrow,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white rounded-2xl p-6 w-full ${narrow ? "max-w-sm" : "max-w-lg"} shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
          <span className="text-base font-bold text-slate-900">{title}</span>
          <button className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalActions({
  busy,
  onCancel,
  onSave,
  saveLabel,
  danger,
  disabled,
  validationHint,
}: {
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  danger?: boolean;
  disabled?: boolean;
  /** Shown below the save button when disabled, so the user knows what's missing. */
  validationHint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 mt-5 pt-4 border-t border-slate-100">
      <div className="flex justify-end gap-2">
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
            danger ? "bg-red-600 hover:bg-red-700 border border-red-500" : "bg-matcha-600 hover:bg-matcha-700"
          }`}
          disabled={busy || disabled}
          onClick={onSave}
        >
          {busy ? "Saving…" : saveLabel}
        </button>
      </div>
      {disabled && !busy && validationHint && (
        <p className="text-[11px] text-right text-red-500">{validationHint}</p>
      )}
    </div>
  );
}
