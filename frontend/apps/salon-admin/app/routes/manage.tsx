import { useOutletContext, Link } from "react-router";
import { User, MapPin, Phone, Mail, Globe, Clock, CalendarDays, Zap, Lock, ArrowRight, Pencil, Hash, Copy, Check, LayoutDashboard, Users, CalendarCheck, ExternalLink, Share2 } from "lucide-react";
import React, { useState } from "react";
import { SOCIAL_PLATFORMS } from "@salon/ui-website";
import { SocialLinksForm } from "~/components/SocialLinksForm";
import type { LayoutContext } from "~/lib/types";
import { FEATURES, FEATURE_LABEL, DAY_SHORT, formatDate } from "~/lib/constants";
import { InfoBar } from "@salon/ui-shared";
import { ADMIN_APP_URL, STAFF_APP_URL, bookingUrl, websiteUrl } from "~/lib/config";

const FEATURE_HINTS: Record<string, string> = {
  BOOKING:         "Let customers book appointments online, anytime.",
  WEBSHOP:         "Sell products, gift cards, and top-ups from your website.",
  MEMBERSHIP:      "Offer subscription plans and recurring revenue from loyal customers.",
  ANALYTICS:       "See visit trends, revenue reports, and busiest time slots.",
  LOYALTY_PROGRAM: "Reward repeat customers with points, perks, and exclusive offers.",
  STATIC_WEBSITE:  "Get a public website your customers can browse and share.",
};

type LinkKey = "admin" | "staff" | "booking" | "website";

export default function Manage() {
  const { salon, setSalon } = useOutletContext<LayoutContext>();
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab]       = useState<"details" | "links">("details");
  const [editSocial, setEditSocial] = useState(false);

  const openHours      = salon.operatingHours?.filter((h) => !h.closed) ?? [];
  const enabledKeys    = new Set(salon.features ?? []);
  const lockedFeatures = FEATURES.filter((f) => !enabledKeys.has(f));

  const handler    = salon.handler ?? String(salon.id);
  const hasBooking = enabledKeys.has("BOOKING");
  const hasWebsite = enabledKeys.has("STATIC_WEBSITE");

  const salonLinks: { key: LinkKey; label: string; desc: string; hint: string; url: string; icon: React.ElementType }[] = [
    {
      key: "admin", label: "Admin Panel", icon: LayoutDashboard, url: ADMIN_APP_URL,
      desc: "Your salon management portal",
      hint: "Log in to manage staff, services, bookings, and settings.",
    },
    {
      key: "staff", label: "Staff Portal", icon: Users, url: STAFF_APP_URL,
      desc: "Team member access",
      hint: "Share with your stylists and staff so they can view their schedule.",
    },
    ...(hasBooking ? [{
      key: "booking" as LinkKey, label: "Booking Link", icon: CalendarCheck, url: bookingUrl(handler),
      desc: "Customer-facing appointment page",
      hint: "Share this link with customers so they can book appointments online.",
    }] : []),
    ...(hasWebsite ? [{
      key: "website" as LinkKey, label: "Public Website", icon: Globe, url: websiteUrl(handler),
      desc: "Your public salon page",
      hint: "Share this with customers — it shows your services, hours, and contact info.",
    }] : []),
  ];

  function copyLink(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  // The links salon owners most need at hand: their customer-facing pages if those
  // features are on, otherwise the Staff Portal to hand to their team. Surfaced as a
  // hero card on the Details tab so the full Links tab isn't the only way to find them.
  const shareLinks = salonLinks.filter((l) =>
    hasBooking || hasWebsite ? l.key === "booking" || l.key === "website" : l.key === "staff",
  );

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${active ? "bg-matcha-600 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`;

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">Overview</h1>
          <Link
            to="edit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:border-matcha-400 hover:text-matcha-700 no-underline transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit salon
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          <button className={tabCls(tab === "details")} onClick={() => setTab("details")}>
            Details
          </button>
          <button className={tabCls(tab === "links")} onClick={() => setTab("links")}>
            <span className="flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Links
            </span>
          </button>
        </div>

        {tab === "details" && (
          <InfoBar id="manage-details">A read-only snapshot of your salon's current setup. Use <span className="font-medium">Edit salon</span> (or the Edit link on any card) to change it; use the sidebar to manage staff and services.</InfoBar>
        )}
        {tab === "links" && (
          <InfoBar id="manage-links">All the URLs associated with your salon. Copy and share them with your team and customers.</InfoBar>
        )}
      </div>

      {/* ── Share card — pulls the key Links-tab URLs into view on Details ─ */}
      {tab === "details" && (
        <div className="rounded-xl border border-matcha-200 bg-matcha-50/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Share2 className="w-4 h-4 text-matcha-600 shrink-0" />
            <p className="text-sm font-semibold text-slate-800">
              {hasBooking || hasWebsite ? "Share your salon" : "Share with your team"}
            </p>
            <button
              type="button"
              onClick={() => setTab("links")}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-matcha-700 hover:text-matcha-800 cursor-pointer"
            >
              All links <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {shareLinks.map(({ key, label, url, icon: Icon }) => (
              <div key={key} className="flex items-center gap-2.5 bg-white border border-matcha-200 rounded-lg px-3 py-2">
                <Icon className="w-4 h-4 text-matcha-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700">{label}</p>
                  <p className="text-[11px] font-mono text-slate-400 truncate">{url}</p>
                </div>
                <button
                  onClick={() => copyLink(url, key)}
                  className="shrink-0 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
                  title={`Copy ${label} URL`}
                >
                  {copied === key ? <Check className="w-3.5 h-3.5 text-matcha-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                  title={`Open ${label}`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Details tab ─────────────────────────────────────────────────── */}
      {tab === "details" && (
        <>
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
                  onClick={() => { navigator.clipboard.writeText(String(salon.id)).then(() => { setCopied("id"); setTimeout(() => setCopied(null), 1500); }); }}
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
                    onClick={() => { navigator.clipboard.writeText(salon.handler!).then(() => { setCopied("handler"); setTimeout(() => setCopied(null), 1500); }); }}
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
                    <a href={salon.contact.website} target="_blank" rel="noopener noreferrer" className="text-matcha-600 hover:underline truncate">
                      {salon.contact.website}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Social Media */}
            <div
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm"
              style={editSocial ? { gridColumn: "1 / -1" } : undefined}
            >
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                <Share2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Social Media</span>
                {!editSocial && (
                  <button
                    type="button"
                    onClick={() => setEditSocial(true)}
                    className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>

              {editSocial ? (
                <>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    Turn a platform on to show its icon in your website footer; add the link to make it
                    clickable. A visible platform with no link shows as a disabled icon.
                  </p>
                  <SocialLinksForm salon={salon} onSaved={setSalon} onCancel={() => setEditSocial(false)} />
                </>
              ) : (() => {
                const shown = SOCIAL_PLATFORMS.filter((p) => salon.contact?.[p.visibleKey] === true);
                if (shown.length === 0) {
                  return <span className="text-xs text-slate-400 italic">None shown on your website</span>;
                }
                return shown.map((p) => {
                  const url = salon.contact?.[p.urlKey]?.trim();
                  return (
                    <div key={p.key} className="flex gap-3 py-0.5 text-sm items-center">
                      <span className="text-xs text-slate-400 min-w-[80px] shrink-0 flex items-center gap-1.5">
                        <p.Icon className="w-3 h-3" /> {p.label}
                      </span>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-matcha-600 hover:underline truncate">
                          {url}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">shown, no link yet</span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

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
                    <span key={f} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wide">
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
        </>
      )}

      {/* ── Links tab ───────────────────────────────────────────────────── */}
      {tab === "links" && (
        <div className="max-w-lg space-y-3">
          {salonLinks.map(({ key, label, desc, hint, url, icon: Icon }) => (
            <div key={key} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-xs font-mono text-slate-600 flex-1 truncate">{url}</span>
                <button
                  onClick={() => copyLink(url, key)}
                  className="shrink-0 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
                  title={`Copy ${label} URL`}
                >
                  {copied === key ? <Check className="w-3.5 h-3.5 text-matcha-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600"
                  title={`Open ${label}`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{hint}</p>
            </div>
          ))}
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
