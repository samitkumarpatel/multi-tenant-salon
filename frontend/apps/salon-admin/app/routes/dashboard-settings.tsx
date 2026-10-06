import { useI18n } from "@salon/i18n";
import { useState } from "react";
import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { CalendarCheck, Check, ExternalLink, ShoppingCart } from "lucide-react";
import { Toast, useToast } from "@salon/ui-shared";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { dashboardUrl } from "~/lib/config";
import type { LayoutContext } from "~/lib/types";

interface DashboardSettings {
  salonId: string;
  bookingManagementEnabled: boolean;
  cashierEnabled: boolean;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const salonId = await resolveSalonUUID(params.salonId!);
  return apiFetch<DashboardSettings>(`${ADMIN_API}/${salonId}/dashboard/settings`);
}

export default function DashboardSettingsPage() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const initial = useLoaderData<typeof clientLoader>();
  const { salon } = useOutletContext<LayoutContext>();
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();
  const bookingAvailable = salon.features?.includes("BOOKING") ?? false;

  const options = [
    { key: "bookingManagementEnabled" as const, title: "Appointment management", description: "Create, edit, confirm, cancel, and complete bookings.", icon: CalendarCheck, disabled: !bookingAvailable },
    { key: "cashierEnabled" as const, title: "Cashier", description: "Take in-salon payments for services and Shop products.", icon: ShoppingCart, disabled: false },
  ];

  async function save() {
    setSaving(true);
    try {
      const saved = await apiFetch<DashboardSettings>(`${ADMIN_API}/${initial.salonId}/dashboard/settings`, {
        method: "PUT", body: JSON.stringify({ bookingManagementEnabled: settings.bookingManagementEnabled, cashierEnabled: settings.cashierEnabled }),
      });
      setSettings(saved);
      notify("Dashboard settings saved.");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not save Dashboard settings.", "error"); }
    finally { setSaving(false); }
  }

  return <div className="max-w-3xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-xl font-bold text-slate-900">{translateUi("Dashboard")}</h1><p className="mt-1 text-sm text-slate-500">{translateUi("Choose which operational tools your salon can use.")}</p></div>
      <div className="flex flex-wrap gap-2"><Link to={`/${salon.id}/payments`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-50">{translateUi("Payment setup")}</Link><a href={dashboardUrl(String(salon.id))} className="inline-flex items-center gap-2 rounded-lg bg-matcha-600 px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-matcha-700">{translateUi("Open Dashboard ")}<ExternalLink className="h-4 w-4" /></a></div>
    </div>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-800">{translateUi("Available tools")}</h2><p className="mt-1 text-xs text-slate-400">{translateUi("Changes affect the separate Dashboard app immediately.")}</p></div>
      <div className="divide-y divide-slate-100">
        {options.map(({ key, title, description, icon: Icon, disabled }) => {
          const enabled = settings[key];
          return <button key={key} type="button" disabled={disabled} onClick={() => setSettings((current) => ({ ...current, [key]: !enabled }))} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100"><Icon className="h-4 w-4 text-slate-500" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-700">{title}</span><span className="mt-0.5 block text-xs text-slate-400">{disabled ? translateUi("Enable Bookings before using appointment management.") : description}</span></span>
            <span className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${enabled ? "bg-matcha-600" : "bg-slate-200"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} /></span>
          </button>;
        })}
      </div>
    </div>


    <div className="flex justify-end"><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-matcha-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-50"><Check className="h-4 w-4" />{saving ? translateUi("Saving…") : translateUi("Save settings")}</button></div>
    <Toast toast={toast} />
  </div>;
}
