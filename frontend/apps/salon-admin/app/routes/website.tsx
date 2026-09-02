import React, { useState } from "react";
import { useOutletContext, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Monitor, BotMessageSquare, ExternalLink, Eye, Handshake, Mail } from "lucide-react";
import type { LayoutContext, WebsiteMode } from "~/lib/types";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { CONTACT_EMAIL, websiteUrl } from "~/lib/config";

type Mode = WebsiteMode;

// ── Selectable card shell ─────────────────────────────────────────────────────

type Accent = "amber" | "violet" | "matcha";

const ACCENT: Record<Accent, {
  border: string; bg: string; iconBg: string; iconBgSelected: string;
  iconBorder: string; badge: string; divider: string; check: string;
}> = {
  amber: {
    border: "border-amber-400", bg: "bg-amber-50/50",
    iconBg: "bg-amber-50", iconBgSelected: "bg-amber-100", iconBorder: "border-amber-100",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    divider: "border-amber-100", check: "text-amber-500",
  },
  violet: {
    border: "border-violet-400", bg: "bg-violet-50/50",
    iconBg: "bg-violet-50", iconBgSelected: "bg-violet-100", iconBorder: "border-violet-100",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    divider: "border-violet-100", check: "text-violet-400",
  },
  matcha: {
    border: "border-matcha-400", bg: "bg-matcha-50/50",
    iconBg: "bg-matcha-50", iconBgSelected: "bg-matcha-100", iconBorder: "border-matcha-100",
    badge: "bg-matcha-100 text-matcha-700 border-matcha-200",
    divider: "border-matcha-100", check: "text-matcha-600",
  },
};

interface ModeCardProps {
  id: Mode;
  active: Mode | null;
  onSelect: (m: Mode) => void;
  accent: Accent;
  icon: React.ReactNode;
  title: string;
  badge: string;
  betaTag?: boolean;
  isLive?: boolean;
  description: string;
  features: string[];
  disabled?: boolean;
  children: React.ReactNode;
}

function ModeCard({ id, active, onSelect, accent, icon, title, badge, betaTag, isLive, description, features, disabled, children }: ModeCardProps) {
  const selected = active === id;
  const a = ACCENT[accent];

  if (disabled) {
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-white opacity-50 cursor-not-allowed select-none">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${a.iconBg} ${a.iconBorder}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-base font-bold text-slate-900">{title}</h2>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-slate-100 text-slate-400 border-slate-200">
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
              <ul className="mt-3 space-y-1">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-3 h-3 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${selected ? a.border : "border-slate-200"} ${selected ? a.bg : "bg-white"}`}>
      <button onClick={() => onSelect(id)} className="w-full text-left p-5 sm:p-6 cursor-pointer">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${selected ? a.iconBgSelected : a.iconBg} ${a.iconBorder}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${a.badge}`}>
                {badge}
              </span>
              {isLive && (
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                  Live
                </span>
              )}
              {betaTag && (
                <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full text-white"
                  style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" }}>
                  Beta
                </span>
              )}
              {selected && <span className="ml-auto text-[10px] font-semibold text-slate-400">Selected ✓</span>}
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            {!selected && (
              <ul className="mt-3 space-y-1">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={`w-3 h-3 shrink-0 ${a.check}`}>✓</span> {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </button>

      {selected && (
        <div className={`border-t px-5 sm:px-6 py-5 space-y-4 ${a.divider}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const data = await apiFetch<{ websiteType: WebsiteMode }>(`${ADMIN_API}/${sid}/website`).catch(() => null);
  return { initialWebsiteMode: data?.websiteType ?? null };
}

export default function WebsiteManagement() {
  const { salon, setWebsiteMode: persistMode } = useOutletContext<LayoutContext>();
  const { initialWebsiteMode } = useLoaderData<typeof clientLoader>();
  const [mode, setModeState] = useState<WebsiteMode | null>(initialWebsiteMode);

  function setMode(m: WebsiteMode | null) {
    setModeState(m);
    persistMode(m);
  }

  const previewUrl = `/${salon.handler ?? salon.id}/website-preview`;
  const designUrl  = `${previewUrl}?design=1`;

  const liveUrl = websiteUrl(salon.handler ?? String(salon.id));

  return (
    <div className="max-w-2xl">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer Website</h1>
          <p className="text-sm text-slate-500 mt-1">
            Choose how to present <span className="font-medium text-slate-700">{salon.name}</span> to visitors online.
          </p>
        </div>
        {salon.handler && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors no-underline"
          >
            <Eye className="w-3 h-3" />
            Preview site
          </a>
        )}
      </div>

      <div className="flex flex-col gap-4">

        <ModeCard
          id="STATIC_WEBSITE"
          active={mode}
          onSelect={setMode}
          accent="amber"
          icon={<Monitor className="w-5 h-5 text-amber-600" />}
          title="Static Website"
          badge="Standard"
          isLive={mode === "STATIC_WEBSITE"}
          description="A clean, customisable page with your salon's services, team, hours, and contact details."
          features={[
            "Showcases your services, pricing & team",
            "Displays location, hours & contact details",
            "Fully customisable colours, fonts & branding",
          ]}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={designUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors no-underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open &amp; Customise
            </a>
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-slate-600 hover:underline no-underline"
            >
              View live page ↗
            </a>
          </div>
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
            Customise colours, fonts, and branding — the same design settings apply to your receptionist's chat window.
          </p>
          <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-slate-100 text-slate-400 border-slate-200">
              Coming Soon
            </span>
            <span>
              Choose from multiple page layouts — hero banners, grid galleries, minimal lists — so your website matches your salon's personality, not just a template.
            </span>
          </div>
        </ModeCard>

        <ModeCard
          id="GENERATIVE_UI"
          active={mode}
          onSelect={setMode}
          accent="violet"
          betaTag
          icon={<BotMessageSquare className="w-5 h-5 text-violet-600" />}
          title="AI Receptionist"
          badge="AI Chat Agent"
          isLive={mode === "GENERATIVE_UI"}
          description="A generative AI chat agent that greets every visitor like your front-desk receptionist — answering questions, recommending services, and guiding them toward a booking using your salon's live data."
          features={[
            "Chats with visitors like a live receptionist",
            "Answers questions on services, pricing & hours",
            "Guides visitors toward booking",
          ]}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={designUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors no-underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open &amp; Customise
            </a>
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-slate-600 hover:underline no-underline"
            >
              View live page ↗
            </a>
          </div>
          <p className="mt-3 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 leading-relaxed">
            Customise colours, fonts, and branding — the same design settings apply to your receptionist's chat window.
          </p>
          <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-slate-100 text-slate-400 border-slate-200">
              Coming Soon
            </span>
            <span>
              An MCP server with MCP tools, so your salon's services, hours &amp; booking data can be used by any other Generative Chat Agent — not just this one.
            </span>
          </div>
        </ModeCard>

        <ModeCard
          id="CUSTOMISE_WEBSITE_CONTACT_US"
          active={mode}
          onSelect={setMode}
          accent="matcha"
          disabled
          icon={<Handshake className="w-5 h-5 text-matcha-600" />}
          title="Contact Us"
          badge="Bespoke"
          description="Have a specific vision in mind? Tell us what you need and our team will design and build a website crafted exactly to your expectations — no templates, no compromises."
          features={[
            "Dedicated design consultation",
            "Custom layout & branding",
            "Built to your exact specification",
            "Ongoing support & updates",
          ]}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600 leading-relaxed">
              Share your ideas, inspirations, or requirements and we'll take it from there. One of our web specialists will reach out within one business day to get started.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Custom website enquiry`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-matcha-600 hover:bg-matcha-700 text-white text-sm font-semibold transition-colors no-underline"
              >
                <Mail className="w-3.5 h-3.5" /> Send us a message
              </a>
              <span className="text-xs text-slate-400">We typically respond within 24 hours.</span>
            </div>
          </div>
        </ModeCard>

      </div>
    </div>
  );
}
