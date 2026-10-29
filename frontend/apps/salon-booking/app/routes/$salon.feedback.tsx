import { useLoaderData, useNavigate } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import type { SalonLanguages } from "@salon/i18n";
import { apiFetch, API_BASE, DEFAULT_THEME, FeedbackView, SalonErrorPage } from "@salon/ui-website";
import type { Salon, StaffMember, WebsiteTheme, FeedbackSettings } from "@salon/ui-website";

export function meta() { return [{ title: "Share your feedback" }, { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" }]; }

export async function clientLoader({ params, request }: ClientLoaderFunctionArgs) {
  const salon = await apiFetch<Salon>(`${API_BASE}/api/salon/${params.salon}`);
  if (salon.status === "DISABLED") return { disabled: true as const };
  const [staff, theme, settings, languages] = await Promise.all([
    apiFetch<StaffMember[]>(`${API_BASE}/api/salon/${salon.id}/staff`),
    apiFetch<WebsiteTheme>(`${API_BASE}/api/salon/${salon.id}/website`).catch(() => DEFAULT_THEME),
    apiFetch<FeedbackSettings>(`${API_BASE}/api/salon/${salon.id}/feedback-settings`),
    apiFetch<SalonLanguages>(`${API_BASE}/api/salon/${salon.id}/languages`),
  ]);
  const query = new URL(request.url).searchParams;
  return { disabled: false as const, salon, staff, theme: { ...DEFAULT_THEME, ...theme }, settings,
    source: query.get("source") === "NOTIFICATION" ? "NOTIFICATION" : "PUBLIC_WEBSITE",
    languagePolicy: languages.booking, languageScope: String(salon.id) };
}

export default function FeedbackPage() {
  const data = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  if (data.disabled) return <SalonErrorPage is404 />;
  return <FeedbackView key={data.salon.id} salon={data.salon} staff={data.staff} theme={data.theme}
    enabled={data.settings.publicWebsiteEnabled} source={data.source} onBack={() => navigate(`/${data.salon.handler}/account`)} />;
}
