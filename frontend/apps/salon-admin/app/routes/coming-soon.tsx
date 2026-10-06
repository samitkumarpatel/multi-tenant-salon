import { useI18n } from "@salon/i18n";
import { Clock } from "lucide-react";

export default function ComingSoon() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <Clock className="w-6 h-6 text-slate-400" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-800">{translateUi("Coming Soon")}</h1>
        <p className="text-sm text-slate-500 mt-1">{translateUi("This feature is under development. Stay tuned.")}</p>
      </div>
    </div>
  );
}
