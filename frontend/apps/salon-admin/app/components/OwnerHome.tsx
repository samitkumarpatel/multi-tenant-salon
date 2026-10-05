import { Link, useOutletContext } from "react-router";
import { ArrowRight, Briefcase, CalendarCheck, CalendarDays, Clock, ExternalLink, Gauge, Globe, HelpCircle, ListChecks, Users } from "lucide-react";
import type { LayoutContext } from "~/lib/types";
import { dashboardUrl } from "~/lib/config";

export function OwnerHome({ dashboardAvailable }: { dashboardAvailable: boolean }) {
  const { salon, pendingServices, pendingStaff, pendingWebsite } = useOutletContext<LayoutContext>();
  const hasBooking = salon.features?.includes("BOOKING");
  const hasWebsite = salon.features?.includes("STATIC_WEBSITE");
  const setupPending = pendingServices || pendingStaff || pendingWebsite;
  const actions = [
    ...(hasBooking ? [{ title: "View appointments", description: "See bookings and manage your calendar.", to: "booking?section=appointments", icon: CalendarCheck }] : []),
    { title: "Services & prices", description: "Update treatments, prices and durations.", to: "services", icon: Briefcase },
    { title: "Manage your team", description: "Add staff and update their details.", to: "staff", icon: Users },
    { title: "Opening hours", description: "Change your salon’s weekly opening times.", to: "edit?step=4", icon: Clock },
    ...(hasBooking ? [{ title: "Staff availability", description: "Set when each team member can take bookings.", to: "booking?section=availability", icon: CalendarDays }] : []),
    ...(hasWebsite ? [{ title: "Edit your website", description: "Update how your salon looks online.", to: "website", icon: Globe }] : []),
  ];

  return (
    <div className="space-y-6">
      {setupPending && (
        <div className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center">
          <ListChecks className="h-6 w-6 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Finish setting up your salon</h2>
            <p className="mt-1 text-sm text-slate-600">Review your setup checklist. You can keep managing your salon while you complete it.</p>
          </div>
          <Link to="setup" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 hover:bg-amber-100">
            Continue setup <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {salon.features?.includes("DASHBOARD") && dashboardAvailable && (
        <a href={dashboardUrl(String(salon.id))} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl bg-matcha-700 p-5 text-white transition-colors hover:bg-matcha-800">
          <Gauge className="h-7 w-7 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Open your daily workspace</h2>
            <p className="mt-1 text-sm text-matcha-100">Your enabled appointment and checkout tools. Opens in a new tab.</p>
          </div>
          <ExternalLink className="h-5 w-5 shrink-0" aria-hidden="true" />
        </a>
      )}

      <section aria-labelledby="everyday-tasks">
        <h2 id="everyday-tasks" className="mb-3 text-base font-semibold text-slate-900">What would you like to do?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map(({ title, description, to, icon: Icon }) => (
            <Link key={to} to={to} className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-matcha-400 hover:bg-matcha-50">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-matcha-50 text-matcha-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-matcha-700" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <Link to="help" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-matcha-700 hover:underline">
        <HelpCircle className="h-4 w-4" aria-hidden="true" /> Need a hand? Visit help & support
      </Link>
    </div>
  );
}
