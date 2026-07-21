import { useOutletContext, useLoaderData, Link } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { User, MapPin, Phone, Mail, Globe, Clock, CalendarDays, Zap, Lock, ArrowRight, Pencil, Hash, Copy, Check, X, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import type { LayoutContext } from "~/lib/types";
import { FEATURES, FEATURE_LABEL, DAY_SHORT, formatDate } from "~/lib/constants";
import { InfoBar } from "@saloon/ui-shared";
import { ADMIN_API, apiFetch, resolveSaloonUUID } from "~/lib/api";

const FEATURE_HINTS: Record<string, string> = {
  BOOKING:         "Let customers book appointments online, anytime.",
  WEBSHOP:         "Sell products, gift cards, and top-ups from your website.",
  MEMBERSHIP:      "Offer subscription plans and recurring revenue from loyal customers.",
  ANALYTICS:       "See visit trends, revenue reports, and busiest time slots.",
  LOYALTY_PROGRAM: "Reward repeat customers with points, perks, and exclusive offers.",
  STATIC_WEBSITE:  "Get a public website your customers can browse and share.",
};

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const saloonId = params.saloonId!;
  const authed = Boolean(sessionStorage.getItem(`saloon-auth:${saloonId}`));
  if (!authed) return { staffCount: 0, serviceCount: 0 };
  try {
    const uuid = await resolveSaloonUUID(saloonId);
    const [staff, services] = await Promise.all([
      apiFetch<{ id: number }[]>(`${ADMIN_API}/${uuid}/staff`).catch(() => [] as { id: number }[]),
      apiFetch<{ id: number }[]>(`${ADMIN_API}/${uuid}/services`).catch(() => [] as { id: number }[]),
    ]);
    return { staffCount: staff.length, serviceCount: services.length };
  } catch {
    return { staffCount: 0, serviceCount: 0 };
  }
}

export default function Manage() {
  const { saloon } = useOutletContext<LayoutContext>();
  const { staffCount, serviceCount } = useLoaderData<typeof clientLoader>();
  const [copied, setCopied] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(
    () => Boolean(localStorage.getItem(`hint-checklist-dismissed:${saloon.id}`))
  );

  const hasBooking = Boolean(saloon.features?.includes("BOOKING"));
  const hasWebsite = Boolean(saloon.features?.includes("STATIC_WEBSITE"));

  const needsService = hasBooking && serviceCount === 0;
  const needsStaff   = hasBooking && staffCount <= 1;
  const needsWebsite = !hasWebsite;

  const pendingCount = [needsService, needsStaff, needsWebsite].filter(Boolean).length;
  const showChecklist = pendingCount > 0 && !hintDismissed;

  function dismissHint() {
    localStorage.setItem(`hint-checklist-dismissed:${saloon.id}`, "1");
    setHintDismissed(true);
  }

  const openHours      = saloon.operatingHours?.filter((h) => !h.closed) ?? [];
  const enabledKeys    = new Set(saloon.features ?? []);
  const lockedFeatures = FEATURES.filter((f) => !enabledKeys.has(f));

  return (
    <div className="space-y-6">

    {/* Page header */}
    <div className="space-y-2">
      <h1 className="text-xl font-bold text-slate-900">Overview</h1>
      <InfoBar>A read-only snapshot of your saloon's current setup. Use the sidebar to edit details or manage staff and services.</InfoBar>
    </div>

    {/* ── Getting Started checklist ─────────────────────────────────────── */}
    {showChecklist && (
      <div className="relative border border-matcha-200 bg-gradient-to-br from-matcha-50/70 to-white rounded-xl p-5">
        <button
          onClick={dismissHint}
          className="absolute top-3 right-3 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-800">Get started with {saloon.name}</span>
          <span className="text-[10px] font-bold bg-matcha-100 text-matcha-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
            {pendingCount} to do
          </span>
        </div>

        <div className="space-y-2">
          {hasBooking && (
            <ChecklistRow
              done={serviceCount > 0}
              label="Add your first service"
              description="Create the menu of services customers can book — haircut, colour, treatment, etc."
              href="services"
            />
          )}

          {hasBooking && (
            <ChecklistRow
              done={staffCount > 1}
              label="Add a team member"
              description="Set up barbers or stylists so bookings can be assigned to the right person."
              href="staff"
            />
          )}

          {/* Website coach mark item */}
          <div className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border transition-colors ${
            needsWebsite
              ? "bg-amber-50 border-amber-200"
              : "bg-white border-slate-200"
          }`}>
            <span className="shrink-0 mt-0.5">
              {!needsWebsite
                ? <CheckCircle2 className="w-4 h-4 text-matcha-500" />
                : (
                  <span className="relative flex h-3 w-3 mt-px">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                  </span>
                )
              }
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${needsWebsite ? "text-amber-800" : "text-slate-500 line-through"}`}>
                {hasWebsite ? "Public website enabled" : "Enable and design your website"}
              </p>
              {needsWebsite && (
                <p className="text-[11px] text-amber-700 leading-snug mt-0.5">
                  Let customers find and book you online — enable the website feature and choose your style.
                </p>
              )}
            </div>
            {needsWebsite && (
              <Link
                to="edit?step=3"
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900 no-underline"
              >
                Enable <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {/* Website style coach mark — shown once the feature is on */}
          {hasWebsite && (
            <WebsiteStyleCoachMark saloonId={String(saloon.id)} />
          )}
        </div>
      </div>
    )}

    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">

      {/* Saloon Identity */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <Hash className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Saloon Identity</span>
        </div>
        <div className="flex gap-3 py-1 text-sm items-center">
          <span className="text-xs text-slate-400 min-w-[64px] shrink-0">ID</span>
          <span className="font-mono text-xs text-slate-600 truncate flex-1">{String(saloon.id)}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(String(saloon.id)).then(() => {
                setCopied("id");
                setTimeout(() => setCopied(null), 1500);
              });
            }}
            className="shrink-0 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
            title="Copy ID"
          >
            {copied === "id" ? <Check className="w-3.5 h-3.5 text-matcha-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        {saloon.handler && (
          <div className="flex gap-3 py-1 text-sm items-center">
            <span className="text-xs text-slate-400 min-w-[64px] shrink-0">Handler</span>
            <span className="font-mono text-xs text-slate-600 truncate flex-1">{saloon.handler}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(saloon.handler!).then(() => {
                  setCopied("handler");
                  setTimeout(() => setCopied(null), 1500);
                });
              }}
              className="shrink-0 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
              title="Copy handler"
            >
              {copied === "handler" ? <Check className="w-3.5 h-3.5 text-matcha-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
          Use the ID or handler to access your saloon's public page:{" "}
          <code className="bg-slate-50 px-1 py-0.5 rounded text-slate-500">/{saloon.handler ?? saloon.id}/c</code>
        </p>
      </div>

      {/* Owner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Owner</span>
        </div>
        <InfoRow label="Name">{saloon.owner?.name}</InfoRow>
        <InfoRow label="Email">{saloon.owner?.email}</InfoRow>
        {saloon.owner?.phone && <InfoRow label="Phone">{saloon.owner.phone}</InfoRow>}
      </div>

      {/* Location */}
      {saloon.location && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Location</span>
            <Link to="edit?step=1" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
              <Pencil className="w-3 h-3" /> Edit
            </Link>
          </div>
          {saloon.location.address && <InfoRow label="Address">{saloon.location.address}</InfoRow>}
          {saloon.location.city    && <InfoRow label="City">{saloon.location.city}</InfoRow>}
          {saloon.location.state   && <InfoRow label="State">{saloon.location.state}</InfoRow>}
          {saloon.location.country && <InfoRow label="Country">{saloon.location.country}</InfoRow>}
          {saloon.location.zipCode && <InfoRow label="ZIP">{saloon.location.zipCode}</InfoRow>}
        </div>
      )}

      {/* Contact */}
      {saloon.contact && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Contact</span>
            <Link to="edit?step=2" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
              <Pencil className="w-3 h-3" /> Edit
            </Link>
          </div>
          {saloon.contact.phone && (
            <div className="flex gap-3 py-0.5 text-sm items-center">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Phone
              </span>
              <span className="text-slate-700">{saloon.contact.phone}</span>
            </div>
          )}
          {saloon.contact.email && (
            <div className="flex gap-3 py-0.5 text-sm items-center">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Email
              </span>
              <span className="text-slate-700">{saloon.contact.email}</span>
            </div>
          )}
          {saloon.contact.website && (
            <div className="flex gap-3 py-0.5 text-sm items-center">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Website
              </span>
              <a
                href={saloon.contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-matcha-600 hover:underline truncate"
              >
                {saloon.contact.website}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Features */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <Zap className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Features</span>
          <Link to="edit?step=3" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
            <Pencil className="w-3 h-3" /> Edit
          </Link>
        </div>
        {saloon.features?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {saloon.features.map((f) => (
              <span
                key={f}
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wide"
              >
                {FEATURE_LABEL[f] ?? f}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">No features enabled</span>
        )}
      </div>

      {/* Operating Hours */}
      {openHours.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Operating Hours</span>
            <Link to="edit?step=4" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
              <Pencil className="w-3 h-3" /> Edit
            </Link>
          </div>
          {openHours.map((h) => (
            <div key={h.day} className="flex gap-3 py-0.5 text-sm">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0">{DAY_SHORT[h.day] ?? h.day}</span>
              <span className="text-slate-700 font-medium">{h.openTime} – {h.closeTime}</span>
            </div>
          ))}
        </div>
      )}

      {/* Meta */}
      {saloon.createdAt && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Created</span>
          </div>
          <span className="text-sm text-slate-700">{formatDate(saloon.createdAt)}</span>
        </div>
      )}
    </div>

    {/* Unlock more features callout */}
    {lockedFeatures.length > 0 && (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-700">More features available</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              These capabilities aren't active yet. Enable them via{" "}
              <Link to="edit" className="text-matcha-600 hover:underline font-medium">
                Edit Saloon → Features
              </Link>{" "}
              to unlock the corresponding admin sections.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {lockedFeatures.map((key) => (
            <div key={key} className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-lg px-3 py-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mt-1.5" />
              <div>
                <p className="text-xs font-semibold text-slate-600">{FEATURE_LABEL[key] ?? key}</p>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{FEATURE_HINTS[key]}</p>
              </div>
            </div>
          ))}
        </div>
        <Link
          to="edit"
          className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-matcha-600 hover:text-matcha-700 no-underline hover:underline"
        >
          Go to Edit Saloon <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChecklistRow({
  done, label, description, href,
}: {
  done: boolean; label: string; description: string; href: string;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
      done ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200"
    }`}>
      {done
        ? <CheckCircle2 className="w-4 h-4 text-matcha-500 shrink-0 mt-0.5" />
        : <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
      }
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${done ? "text-slate-400 line-through" : "text-slate-700"}`}>
          {label}
        </p>
        {!done && (
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{description}</p>
        )}
      </div>
      {!done && (
        <Link
          to={href}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-matcha-600 hover:text-matcha-700 no-underline"
        >
          Go <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function WebsiteStyleCoachMark({ saloonId }: { saloonId: string }) {
  const [seen, setSeen] = useState(
    () => Boolean(localStorage.getItem(`website-style-hint-seen:${saloonId}`))
  );

  if (seen) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 border bg-violet-50 border-violet-200">
      <span className="relative flex h-3 w-3 mt-px shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-violet-900">Choose your website style</p>
        <p className="text-[11px] text-violet-700 leading-snug mt-0.5">
          Pick how your public page looks — a classic layout, AI-generated design, or a contact form. Head to <strong>Website</strong> in the sidebar.
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <Link
          to="website"
          onClick={() => {
            localStorage.setItem(`website-style-hint-seen:${saloonId}`, "1");
            setSeen(true);
          }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900 no-underline"
        >
          Design <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          onClick={() => {
            localStorage.setItem(`website-style-hint-seen:${saloonId}`, "1");
            setSeen(true);
          }}
          className="text-violet-400 hover:text-violet-700 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-0.5 text-sm">
      <span className="text-xs text-slate-400 min-w-[64px] shrink-0 pt-px">{label}</span>
      <span className="text-slate-700">{children}</span>
    </div>
  );
}
