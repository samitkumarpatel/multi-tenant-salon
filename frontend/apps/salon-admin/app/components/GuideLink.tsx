import { useI18n } from "@salon/i18n";
import { BookOpen } from "lucide-react";
import { helpUrl } from "~/lib/config";

/** Opens the Help Center guide for the page it sits on, e.g. `<GuideLink path="payments/refunds" />`. */
export function GuideLink({ path }: { path: string }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <a
      href={helpUrl(path, uiLocale)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-matcha-700 hover:underline"
    >
      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> {translateUi("Read the guide")}
    </a>
  );
}
