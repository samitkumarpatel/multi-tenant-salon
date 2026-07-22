import { useState, useRef, useCallback } from "react";

export type ToastType = "success" | "error";

interface ToastState {
  msg: string;
  type: ToastType;
}

export interface ToastHandle {
  notify: (msg: string, type?: ToastType) => void;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string, type: ToastType = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, type });
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  return { toast, notify };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-sm font-medium text-white shadow-lg z-[1000] animate-[slide-up_0.16s_ease] ${
        toast.type === "error" ? "bg-red-600" : "bg-matcha-600"
      }`}
    >
      {toast.msg}
    </div>
  );
}
