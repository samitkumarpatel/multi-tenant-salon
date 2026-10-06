import { useI18n } from "@salon/i18n";
import { useOutletContext, useLoaderData, Link, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs, ShouldRevalidateFunctionArgs } from "react-router";
import { User, MapPin, Phone, Mail, Globe, Clock, CalendarDays, Zap, Lock, ArrowRight, Pencil, Hash, Copy, Check, LayoutDashboard, Users, CalendarCheck, ExternalLink, Share2, Gauge } from "lucide-react";
import React, { useEffect, useState } from "react";
import { SOCIAL_PLATFORMS } from "@salon/ui-website";
import { SocialLinksForm } from "~/components/SocialLinksForm";
import { OwnerHome } from "~/components/OwnerHome";
import type { LayoutContext } from "~/lib/types";
import { FEATURES, FEATURE_LABEL, DAY_SHORT, formatDate } from "~/lib/constants";
import { ADMIN_APP_URL, STAFF_APP_URL, bookingUrl, dashboardUrl, websiteUrl } from "~/lib/config";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { connectedHostname } from "~/components/WebsiteDomains";
import type { DomainSettings } from "~/components/WebsiteDomains";

interface DashboardSettings {
  bookingManagementEnabled: boolean;
  cashierEnabled: boolean;
}

// The sidebar's sub-links only change `?tab=…`; the page already holds its data,
// so don't refetch it (and block the UI on the API) for a tab switch.
export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search) return false;
  return defaultShouldRevalidate;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const salonId = await resolveSalonUUID(params.salonId!);
  const [dashboard, domains] = await Promise.all([
    apiFetch<DashboardSettings>(`${ADMIN_API}/${salonId}/dashboard/settings`)
      .catch((): DashboardSettings => ({ bookingManagementEnabled: false, cashierEnabled: false })),
    apiFetch<DomainSettings>(`${ADMIN_API}/${salonId}/website/domains`).catch(() => null),
  ]);
  return { ...dashboard, customHostname: connectedHostname(domains) };
}

const FEATURE_HINTS: Record<string, string> = {
  BOOKING:         "Let customers book appointments online, anytime.",
  DASHBOARD:       "Run daily appointments, checkout, and customer communication from one workspace.",
  WEBSHOP:         "Sell products, gift cards, and top-ups from your website.",
  MEMBERSHIP:      "Offer subscription plans and recurring revenue from loyal customers.",
  ANALYTICS:       "See visit trends, revenue reports, and busiest time slots.",
  LOYALTY_PROGRAM: "Reward repeat customers with points, perks, and exclusive offers.",
  STATIC_WEBSITE:  "Get a public website your customers can browse and share.",
};

type LinkKey = "admin" | "staff" | "booking" | "dashboard" | "website";
type SalonLink = {
  key: LinkKey;
  label: string;
  desc: string;
  url: string;
  /** Another address for the same page, shown under `url` after an "or". */
  altUrl?: string;
  icon: React.ElementType;
};

export default function Manage() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const { salon, setSalon } = useOutletContext<LayoutContext>();
  const dashboardSettings = useLoaderData<typeof clientLoader>();
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editSocial, setEditSocial] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const tabParam = searchParams.get("tab");
  const tab = tabParam === "links" || tabParam === "details" ? tabParam : "home";

  function setTab(nextTab: "home" | "details" | "links") {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    setSearchParams(nextParams);
  }

  const openHours      = salon.operatingHours?.filter((h) => !h.closed) ?? [];
  const enabledKeys    = new Set(salon.features ?? []);
  const lockedFeatures = FEATURES.filter((f) => !enabledKeys.has(f));

  const handler    = salon.handler ?? String(salon.id);
  const hasBooking = enabledKeys.has("BOOKING");
  const hasDashboard = enabledKeys.has("DASHBOARD");
  const dashboardAvailable = dashboardSettings.bookingManagementEnabled || dashboardSettings.cashierEnabled;
  const hasWebsite = enabledKeys.has("STATIC_WEBSITE");

  const salonLinks: SalonLink[] = [
    {
      key: "admin", label: "Admin Panel", icon: LayoutDashboard, url: ADMIN_APP_URL,
      desc: "Your salon management portal",
    },
    {
      key: "staff", label: "Staff Portal", icon: Users, url: STAFF_APP_URL,
      desc: "Team member access",
    },
    ...(hasBooking ? [{
      // With a connected custom domain the website's own /book page is the branded booking link;
      // the book.salonsaas.org link keeps working, so both are shown.
      key: "booking" as LinkKey, label: "Booking Link", icon: CalendarCheck,
      ...(dashboardSettings.customHostname
        ? { url: `https://${dashboardSettings.customHostname}/book`, altUrl: bookingUrl(handler) }
        : { url: bookingUrl(handler) }),
      desc: "Customer-facing appointment page",
    }] : []),
    ...(hasDashboard && dashboardAvailable ? [{
      key: "dashboard" as LinkKey, label: "Salon Dashboard", icon: Gauge, url: dashboardUrl(String(salon.id)),
      desc: dashboardSettings.bookingManagementEnabled && dashboardSettings.cashierEnabled
        ? "Appointments and in-salon checkout"
        : dashboardSettings.bookingManagementEnabled ? "Appointment management" : "In-salon checkout",
    }] : []),
    ...(hasWebsite ? [{
      key: "website" as LinkKey, label: "Public Website", icon: Globe, url: websiteUrl(handler, dashboardSettings.customHostname),
      desc: "Your public salon page",
    }] : []),
  ];

  async function copyLink(text: string, key: string) {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied(null);
      setCopyError("Couldn’t copy automatically. Select the link text to copy it manually.");
    }
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold text-slate-900">{tab === "home" ? salon.name : tab === "details" ? translateUi("Salon details") : translateUi("Share links")}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {tab === "home" ? translateUi("Your everyday salon tasks, all in one place.") : tab === "details" ? translateUi("Review and update your salon information.") : translateUi("Share booking and website links with customers, or portal links with your team.")}
            </p>
          </div>
          <Link
            to="edit"
            className="inline-flex h-11 items-center gap-1.5 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:border-matcha-400 hover:text-matcha-700 no-underline transition-colors"
          >
            <Pencil className="w-4 h-4" /> {translateUi("Edit salon ")}</Link>
        </div>

        <nav aria-label={translateUi("Salon overview")} className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
          {([['home', 'Home'], ['details', 'Salon details'], ['links', 'Share links']] as const).map(([key, label]) => (
            <Link key={key} to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), tab: key })}`} aria-current={tab === key ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium transition-colors ${tab === key ? "bg-matcha-100 text-matcha-800" : "text-slate-600 hover:bg-slate-100"}`}>
              {translateUi(label)}
            </Link>
          ))}
        </nav>
      </div>

      {tab === "home" && <OwnerHome dashboardAvailable={dashboardAvailable} />}
      <p role="status" className={copyError ? "text-sm text-red-700" : "sr-only"}>{copyError ?? (copied ? "Copied to clipboard." : "")}</p>

      {/* ── Details tab ─────────────────────────────────────────────────── */}
      {tab === "details" && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>div]:min-w-0">

            {/* Salon Identity */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Salon Identity")}</span>
              </div>
              <div className="flex gap-3 py-1 text-sm items-center">
                <span className="text-xs text-slate-400 min-w-[64px] shrink-0">{translateUi("ID")}</span>
                <span className="font-mono text-xs text-slate-600 truncate flex-1">{String(salon.id)}</span>
                <button
                  onClick={() => copyLink(String(salon.id), "id")}
                  className="shrink-0 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
                  title={translateUi("Copy ID")}
                >
                  {copied === "id" ? <Check className="w-3.5 h-3.5 text-matcha-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              {salon.handler && (
                <div className="flex gap-3 py-1 text-sm items-center">
                  <span className="text-xs text-slate-400 min-w-[64px] shrink-0">{translateUi("Web name")}</span>
                  <span className="font-mono text-xs text-slate-600 truncate flex-1">{salon.handler}</span>
                  <button
                    onClick={() => copyLink(salon.handler!, "handler")}
                    className="shrink-0 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
                    title={translateUi("Copy web name")}
                  >
                    {copied === "handler" ? <Check className="w-3.5 h-3.5 text-matcha-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                {translateUi("Your salon reference for support. Customer links are available under Share links. ")}</p>
            </div>

            {/* Owner */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Owner")}</span>
              </div>
              <InfoRow label={translateUi("Name")}>{salon.owner?.name}</InfoRow>
              <InfoRow label={translateUi("Email")}>{salon.owner?.email}</InfoRow>
              {salon.owner?.phone && <InfoRow label={translateUi("Phone")}>{salon.owner.phone}</InfoRow>}
            </div>

            {/* Location */}
            {salon.location && (
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Location")}</span>
                  <Link to="edit?step=1" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
                    <Pencil className="w-3 h-3" /> {translateUi("Edit ")}</Link>
                </div>
                {salon.location.address && <InfoRow label={translateUi("Address")}>{salon.location.address}</InfoRow>}
                {salon.location.city    && <InfoRow label={translateUi("City")}>{salon.location.city}</InfoRow>}
                {salon.location.state   && <InfoRow label={translateUi("State")}>{salon.location.state}</InfoRow>}
                {salon.location.country && <InfoRow label={translateUi("Country")}>{salon.location.country}</InfoRow>}
                {salon.location.zipCode && <InfoRow label={translateUi("ZIP")}>{salon.location.zipCode}</InfoRow>}
                {salon.businessRegistrationId && (
                  <InfoRow label={salon.businessIdLabel ?? "Reg. ID"}>
                    {salon.businessRegistrationId}
                    {salon.showBusinessId && (
                      <span className="ml-2 text-[10px] font-medium text-matcha-600">{translateUi("· shown publicly")}</span>
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
                  <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Contact")}</span>
                  <Link to="edit?step=2" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
                    <Pencil className="w-3 h-3" /> {translateUi("Edit ")}</Link>
                </div>
                {salon.contact.phone && (
                  <div className="flex gap-3 py-0.5 text-sm items-center">
                    <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                      <Phone className="w-3 h-3" /> {translateUi("Phone ")}</span>
                    <span className="text-slate-700">{salon.contact.phone}</span>
                  </div>
                )}
                {salon.contact.email && (
                  <div className="flex gap-3 py-0.5 text-sm items-center">
                    <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> {translateUi("Email ")}</span>
                    <span className="min-w-0 break-words text-slate-700">{salon.contact.email}</span>
                  </div>
                )}
                {salon.contact.website && (
                  <div className="flex gap-3 py-0.5 text-sm items-center">
                    <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                      <Globe className="w-3 h-3" /> {translateUi("Website ")}</span>
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
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Social Media")}</span>
                {!editSocial && (
                  <button
                    type="button"
                    onClick={() => setEditSocial(true)}
                    className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" /> {translateUi("Edit ")}</button>
                )}
              </div>

              {editSocial ? (
                <>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {translateUi("Turn a platform on to show its icon in your website footer; add the link to make it clickable. A visible platform with no link shows as a disabled icon. ")}</p>
                  <SocialLinksForm salon={salon} onSaved={setSalon} onCancel={() => setEditSocial(false)} />
                </>
              ) : (() => {
                const shown = SOCIAL_PLATFORMS.filter((p) => salon.contact?.[p.visibleKey] === true);
                if (shown.length === 0) {
                  return <span className="text-xs text-slate-400 italic">{translateUi("None shown on your website")}</span>;
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
                        <span className="text-slate-400 italic">{translateUi("shown, no link yet")}</span>
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
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Features")}</span>
                <Link to="edit?step=3" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
                  <Pencil className="w-3 h-3" /> {translateUi("Edit ")}</Link>
              </div>
              {salon.features?.length ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {salon.features.map((f) => (
                    <span key={f} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wide">
                      {translateUi(FEATURE_LABEL[f] ?? f)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">{translateUi("No features enabled")}</span>
              )}
            </div>

            {/* Operating Hours */}
            {openHours.length > 0 && (
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Operating Hours")}</span>
                  <Link to="edit?step=4" className="ml-auto flex items-center gap-1 text-[0.65rem] font-semibold text-matcha-600 hover:text-matcha-700 no-underline">
                    <Pencil className="w-3 h-3" /> {translateUi("Edit ")}</Link>
                </div>
                {openHours.map((h) => (
                  <div key={h.day} className="flex gap-3 py-0.5 text-sm">
                    <span className="text-xs text-slate-400 min-w-[64px] shrink-0">{translateUi(DAY_SHORT[h.day] ?? h.day)}</span>
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
                  <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Created")}</span>
                </div>
                <span className="text-sm text-slate-700">{formatDate(salon.createdAt)}</span>
              </div>
            )}
          </div>

          {/* Keep sharing discoverable without duplicating the links list. */}
          <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-matcha-50">
                <Share2 className="h-4 w-4 text-matcha-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {hasBooking || hasWebsite ? translateUi("Share your salon") : translateUi("Share with your team")}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {hasBooking || hasWebsite
                    ? translateUi("Access your booking, website, and other salon links in one place.")
                    : translateUi("Access the portal links your team needs in one place.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab("links")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-matcha-300 hover:bg-matcha-50 hover:text-matcha-700 cursor-pointer"
              >
                {translateUi("View share links ")}<ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Unlock more features callout */}
          {lockedFeatures.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{translateUi("More features available")}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {translateUi("These capabilities aren't active yet. Enable them via")}{" "}
                    <Link to="edit?step=3" className="text-matcha-600 hover:underline font-medium">
                      {translateUi("Edit Salon → Features ")}</Link>{" "}
                    {translateUi("to unlock the corresponding admin sections. ")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {lockedFeatures.map((key) => (
                  <div key={key} className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mt-1.5" />
                    <div>
                      <p className="text-xs font-semibold text-slate-600">{translateUi(FEATURE_LABEL[key] ?? key)}</p>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{FEATURE_HINTS[key]}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="edit?step=3"
                className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-matcha-600 hover:text-matcha-700 no-underline hover:underline"
              >
                {translateUi("Go to Edit Salon ")}<ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}

        </>
      )}

      {/* ── Links tab ───────────────────────────────────────────────────── */}
      {tab === "links" && (
        <div className="max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white">
          <CompactLinkList links={salonLinks} copied={copied} onCopy={copyLink} />
        </div>
      )}

    </div>
  );
}

function CompactLinkList({
  links,
  copied,
  onCopy,
}: {
  links: SalonLink[];
  copied: string | null;
  onCopy: (url: string, key: string) => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <ul className="divide-y divide-slate-100">
      {links.map(({ key, label, desc, url, altUrl, icon: Icon }) => (
        <li key={key} className="flex items-start gap-3 px-3 py-3 sm:px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <Icon className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="shrink-0 text-sm font-semibold text-slate-800">{translateUi(label)}</p>
              <p className="hidden truncate text-[11px] text-slate-400 sm:block">{desc}</p>
            </div>
            <LinkUrl url={url} label={translateUi(label)} copyKey={key} copied={copied} onCopy={onCopy} />
            {altUrl && <>
              <p className="text-[11px] text-slate-400">{translateUi("or")}</p>
              <LinkUrl url={altUrl} label={translateUi(label)} copyKey={`${key}-alt`} copied={copied} onCopy={onCopy} />
            </>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function LinkUrl({ url, label, copyKey, copied, onCopy }: {
  url: string; label: string; copyKey: string; copied: string | null; onCopy: (url: string, key: string) => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-1">
      <p className="w-full break-all py-1 text-sm text-slate-600">{url}</p>
      <button
        type="button"
        onClick={() => onCopy(url, copyKey)}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-matcha-700 transition-colors hover:bg-matcha-50 cursor-pointer"
        title={`Copy ${url}`}
        aria-label={`Copy ${label} URL ${url}`}
      >
        {copied === copyKey ? <Check className="h-4 w-4 text-matcha-600" /> : <Copy className="h-4 w-4" />}
        {copied === copyKey ? translateUi("Copied") : translateUi("Copy link")}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        title={`Open ${url}`}
        aria-label={`Open ${label} ${url} in a new tab`}
      >
        <ExternalLink className="h-4 w-4" />
        {translateUi("Open ")}</a>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <div className="flex gap-3 py-0.5 text-sm">
      <span className="text-xs text-slate-400 min-w-[64px] shrink-0 pt-px">{translateUi(label)}</span>
      <span className="min-w-0 break-words text-slate-700">{children}</span>
    </div>
  );
}
