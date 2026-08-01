import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  Briefcase, Users, Palette, ArrowRight, PartyPopper, ChevronRight, CheckCircle2,
} from "lucide-react";
import type { LayoutContext } from "~/lib/types";
import { ADMIN_API, apiFetch, resolveSaloonUUID } from "~/lib/api";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const uuid = await resolveSaloonUUID(params.saloonId!);
  const [staff, services, websiteData] = await Promise.all([
    apiFetch<{ id: number }[]>(`${ADMIN_API}/${uuid}/staff`).catch(() => [] as { id: number }[]),
    apiFetch<{ id: number }[]>(`${ADMIN_API}/${uuid}/services`).catch(() => [] as { id: number }[]),
    apiFetch<{ websiteType: string | null }>(`${ADMIN_API}/${uuid}/website`).catch(() => null),
  ]);
  return {
    staffCount: staff.length,
    serviceCount: services.length,
    websiteType: websiteData?.websiteType ?? null,
  };
}

type Step = {
  key: string;
  icon: React.ElementType;
  title: string;
  description: string;
  doneDescription?: string;
  done: boolean;
  href: string;
  cta: string;
};

export default function Setup() {
  const { saloon } = useOutletContext<LayoutContext>();
  const { staffCount, serviceCount, websiteType } = useLoaderData<typeof clientLoader>();

  const hasBooking = saloon.features?.includes("BOOKING") ?? false;
  const hasWebsite = saloon.features?.includes("STATIC_WEBSITE") ?? false;

  const steps: Step[] = [
    hasBooking && {
      key: "services",
      icon: Briefcase,
      title: "Add your first service",
      description: "Create the menu of services customers can book — haircut, colour, treatment, etc.",
      done: serviceCount > 1,
      href: "services",
      cta: "Go to Saloon Services",
    },
    hasBooking && {
      key: "staff",
      icon: Users,
      title: "Add a team member",
      description: "Set up barbers or stylists so bookings can be assigned to the right person.",
      done: staffCount > 1,
      href: "staff",
      cta: "Go to Staff",
    },
    hasWebsite && {
      key: "website",
      icon: Palette,
      title: "Design your website",
      description: "Choose how your public page looks — classic layout, AI-generated, or contact form.",
      doneDescription: "We've automatically set up your website design. You can still customise it anytime from the Website tab.",
      done: websiteType !== null,
      href: "website",
      cta: "Go to Website",
    },
  ].filter(Boolean) as Step[];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone   = steps.length > 0 && doneCount === steps.length;

  if (allDone) {
    return (
      <div className="max-w-md mx-auto py-14 text-center">
        <div className="w-16 h-16 rounded-full bg-matcha-100 flex items-center justify-center mx-auto mb-5">
          <PartyPopper className="w-7 h-7 text-matcha-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">You're all set!</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-7">
          <span className="font-medium text-slate-700">{saloon.name}</span> is fully configured and ready for customers.
        </p>
        <Link
          to=".."
          relative="path"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-matcha-600 hover:bg-matcha-700 text-white text-sm font-semibold transition-colors no-underline"
        >
          Go to Overview <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="max-w-md mx-auto py-14 text-center">
        <p className="text-sm text-slate-400">No setup steps required for your current feature set.</p>
        <Link to=".." relative="path" className="mt-4 inline-flex items-center gap-1 text-sm text-matcha-600 hover:underline no-underline">
          <ArrowRight className="w-4 h-4" /> Go to Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-slate-900">Get started</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete these steps to set up{" "}
          <span className="font-medium text-slate-700">{saloon.name}</span>.
        </p>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-slate-500 shrink-0 tabular-nums">
            {doneCount} / {steps.length} done
          </span>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex flex-col">
        {steps.map((step, i) => {
          const Icon  = step.icon;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} className="flex gap-4">
              {/* Left rail: circle + connector line */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                    step.done
                      ? "bg-matcha-500 border-matcha-500 text-white"
                      : "bg-white border-slate-300 text-slate-500"
                  }`}
                >
                  {step.done
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <span className="text-xs font-bold">{i + 1}</span>
                  }
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1 ${step.done ? "bg-matcha-200" : "bg-slate-200"}`} />
                )}
              </div>

              {/* Right: step card */}
              <div className={`flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
                <div
                  className={`rounded-xl border px-4 py-3.5 transition-colors ${
                    step.done
                      ? "bg-slate-50 border-slate-200"
                      : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        step.done ? "bg-matcha-100" : "bg-slate-100"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${step.done ? "text-matcha-600" : "text-slate-500"}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          step.done ? "text-slate-400 line-through" : "text-slate-800"
                        }`}
                      >
                        {step.title}
                      </p>
                      {!step.done && (
                        <p className="text-xs text-slate-500 leading-snug mt-0.5">
                          {step.description}
                        </p>
                      )}
                      {step.done && step.doneDescription && (
                        <p className="text-xs text-slate-500 leading-snug mt-0.5">
                          {step.doneDescription}{" "}
                          <Link
                            to={`../${step.href}`}
                            relative="path"
                            className="text-matcha-600 hover:underline no-underline font-medium"
                          >
                            {step.cta} →
                          </Link>
                        </p>
                      )}
                    </div>

                    {step.done ? (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-matcha-600 bg-matcha-50 border border-matcha-200 px-2 py-0.5 rounded-full">
                        Done
                      </span>
                    ) : (
                      <Link
                        to={`../${step.href}`}
                        relative="path"
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-matcha-600 hover:text-matcha-700 no-underline whitespace-nowrap"
                      >
                        {step.cta} <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 mt-5">
        You can always update these later from the sidebar.{" "}
        <Link to=".." relative="path" className="text-matcha-600 hover:underline no-underline">
          Skip for now →
        </Link>
      </p>
    </div>
  );
}
