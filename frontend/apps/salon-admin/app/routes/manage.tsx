import { useOutletContext, Link } from "react-router";
import { User, MapPin, Phone, Mail, Globe, Clock, CalendarDays, Zap, Lock, ArrowRight, Pencil, Hash, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { LayoutContext } from "~/lib/types";
import { FEATURES, FEATURE_LABEL, DAY_SHORT, formatDate } from "~/lib/constants";
import { InfoBar } from "@salon/ui-shared";

const FEATURE_HINTS: Record<string, string> = {
  BOOKING:         "Let customers book appointments online, anytime.",
  WEBSHOP:         "Sell products, gift cards, and top-ups from your website.",
  MEMBERSHIP:      "Offer subscription plans and recurring revenue from loyal customers.",
  ANALYTICS:       "See visit trends, revenue reports, and busiest time slots.",
  LOYALTY_PROGRAM: "Reward repeat customers with points, perks, and exclusive offers.",
  STATIC_WEBSITE:  "Get a public website your customers can browse and share.",
};

export default function Manage() {
  const { salon } = useOutletContext<LayoutContext>();
  const [copied, setCopied] = useState<string | null>(null);

  const openHours      = salon.operatingHours?.filter((h) => !h.closed) ?? [];
  const enabledKeys    = new Set(salon.features ?? []);
  const lockedFeatures = FEATURES.filter((f) => !enabledKeys.has(f));

  return (
    <div className="space-y-6">

    {/* Page header */}
    <div className="space-y-2">
      <h1 className="text-xl font-bold text-slate-900">Overview</h1>
      <InfoBar>A read-only snapshot of your salon's current setup. Use the sidebar to edit details or manage staff and services.</InfoBar>
    </div>

    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">

      {/* Salon Identity */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <Hash className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Salon Identity</span>
        </div>
        <div className="flex gap-3 py-1 text-sm items-center">
          <span className="text-xs text-slate-400 min-w-[64px] shrink-0">ID</span>
          <span className="font-mono text-xs text-slate-600 truncate flex-1">{String(salon.id)}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(String(salon.id)).then(() => {
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
        {salon.handler && (
          <div className="flex gap-3 py-1 text-sm items-center">
            <span className="text-xs text-slate-400 min-w-[64px] shrink-0">Handler</span>
            <span className="font-mono text-xs text-slate-600 truncate flex-1">{salon.handler}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(salon.handler!).then(() => {
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
          Use the ID or handler to access your salon's public page:{" "}
          <code className="bg-slate-50 px-1 py-0.5 rounded text-slate-500">/{salon.handler ?? salon.id}/website-preview</code>
        </p>
      </div>

      {/* Owner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Owner</span>
        </div>
        <InfoRow label="Name">{salon.owner?.name}</InfoRow>
        <InfoRow label="Email">{salon.owner?.email}</InfoRow>
        {salon.owner?.phone && <InfoRow label="Phone">{salon.owner.phone}</InfoRow>}
      </div>

      {/* Location */}
      {salon.location && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Location</span>
            <Link to="edit?step=1" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
              <Pencil className="w-3 h-3" /> Edit
            </Link>
          </div>
          {salon.location.address && <InfoRow label="Address">{salon.location.address}</InfoRow>}
          {salon.location.city    && <InfoRow label="City">{salon.location.city}</InfoRow>}
          {salon.location.state   && <InfoRow label="State">{salon.location.state}</InfoRow>}
          {salon.location.country && <InfoRow label="Country">{salon.location.country}</InfoRow>}
          {salon.location.zipCode && <InfoRow label="ZIP">{salon.location.zipCode}</InfoRow>}
          {salon.businessRegistrationId && (
            <InfoRow label={salon.businessIdLabel ?? "Reg. ID"}>
              {salon.businessRegistrationId}
              {salon.showBusinessId && (
                <span className="ml-2 text-[10px] font-medium text-matcha-600">· shown publicly</span>
              )}
            </InfoRow>
          )}
        </div>
      )}

      {/* Contact */}
      {salon.contact && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Contact</span>
            <Link to="edit?step=2" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
              <Pencil className="w-3 h-3" /> Edit
            </Link>
          </div>
          {salon.contact.phone && (
            <div className="flex gap-3 py-0.5 text-sm items-center">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Phone
              </span>
              <span className="text-slate-700">{salon.contact.phone}</span>
            </div>
          )}
          {salon.contact.email && (
            <div className="flex gap-3 py-0.5 text-sm items-center">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Email
              </span>
              <span className="text-slate-700">{salon.contact.email}</span>
            </div>
          )}
          {salon.contact.website && (
            <div className="flex gap-3 py-0.5 text-sm items-center">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Website
              </span>
              <a
                href={salon.contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-matcha-600 hover:underline truncate"
              >
                {salon.contact.website}
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
        {salon.features?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {salon.features.map((f) => (
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
      {salon.createdAt && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Created</span>
          </div>
          <span className="text-sm text-slate-700">{formatDate(salon.createdAt)}</span>
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
                Edit Salon → Features
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
          Go to Edit Salon <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    )}

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
