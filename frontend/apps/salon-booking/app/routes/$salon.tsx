import React, { useEffect, useState } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { DEFAULT_THEME, BookingWizard, GenerativeUIBooking, SalonErrorPage, apiFetch, API_BASE, contrastText } from "@salon/ui-website";
import type { Salon, ServiceItem, StaffMember, WebsiteTheme, Country } from "@salon/ui-website";
import { CalendarCheck, Sparkles } from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

type LoaderOk = {
  status: "ok";
  salon: Salon;
  services: ServiceItem[];
  staff: StaffMember[];
  theme: WebsiteTheme;
  countries: Country[];
};

type LoaderData =
  | LoaderOk
  | { status: "booking_disabled"; salonName?: string }
  | { status: "not_found" }
  | { status: "error" };

// ── loader ────────────────────────────────────────────────────────────────────

export async function clientLoader({ params }: ClientLoaderFunctionArgs): Promise<LoaderData> {
  const handle = params.salon!;
  try {
    const salon = await apiFetch<Salon>(`${API_BASE}/api/salon/${handle}`);

    if (salon.status === "DISABLED" || !salon.features?.includes("BOOKING")) {
      return { status: "booking_disabled", salonName: salon.name };
    }

    const [services, staff, theme, countries] = await Promise.all([
      apiFetch<ServiceItem[]>(`${API_BASE}/api/salon/${salon.id}/services`).catch((): ServiceItem[] => []),
      apiFetch<StaffMember[]>(`${API_BASE}/api/salon/${salon.id}/staff`).catch((): StaffMember[] => []),
      apiFetch<WebsiteTheme>(`${API_BASE}/api/salon/${salon.id}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
      apiFetch<Country[]>(`${API_BASE}/api/salon-utility/countries`).catch((): Country[] => []),
    ]);

    return {
      status: "ok",
      salon,
      services: services.filter((s) => s.active),
      staff: staff.filter((s) => s.status === "ACTIVE"),
      theme: { ...DEFAULT_THEME, ...theme },
      countries,
    };
  } catch (err) {
    const is404 = err instanceof Error && /HTTP 404|not found/i.test(err.message);
    return { status: is404 ? "not_found" : "error" };
  }
}

// ── favicon helpers ───────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function isLight(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.45;
}

function buildFaviconHref(name: string, bgColor: string): string {
  const fg = isLight(bgColor) ? "#0F172A" : "#FFFFFF";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${bgColor}'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='13' font-weight='700' fill='${fg}' text-anchor='middle'>${initials(name)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ── mode toggle ───────────────────────────────────────────────────────────────

type BookingMode = "wizard" | "ai";

function ModeToggle({
  active, onSwitch, theme,
}: {
  active: BookingMode;
  onSwitch: (m: BookingMode) => void;
  theme: WebsiteTheme;
}) {
  const accent = theme.accentColor;
  const at = contrastText(accent);
  return (
    <div
      className="inline-flex items-center rounded-xl p-1 gap-0.5"
      style={{ backgroundColor: `${accent}12`, border: `1.5px solid ${accent}30` }}
    >
      <button
        onClick={() => onSwitch("ai")}
        disabled={active === "ai"}
        title="Explore with AI"
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer disabled:cursor-default"
        style={
          active === "ai"
            ? { backgroundColor: accent, color: at, boxShadow: `0 2px 10px ${accent}55` }
            : { color: accent }
        }
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        Book with GenAI
      </button>
      <button
        onClick={() => onSwitch("wizard")}
        disabled={active === "wizard"}
        title="Step-by-step booking"
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer disabled:cursor-default"
        style={
          active === "wizard"
            ? { backgroundColor: accent, color: at, boxShadow: `0 2px 10px ${accent}55` }
            : { color: accent }
        }
      >
        <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
        Book Now
      </button>
    </div>
  );
}

// ── booking-disabled page ─────────────────────────────────────────────────────

function BookingUnavailablePage({ salonName }: { salonName?: string }) {
  return (
    <div
      className="min-h-[100dvh] relative flex flex-col items-center justify-center px-6 text-center overflow-hidden select-none"
      style={{ backgroundColor: "#0F172A", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes scissors-sway { 0%,100% { transform: rotate(-12deg) scale(1); } 50% { transform: rotate(12deg) scale(1.1); } }
        @keyframes scissors-float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .sc-sway { animation: scissors-sway 2.6s ease-in-out infinite; }
        .sc-float { animation: scissors-float 4s ease-in-out infinite; }
      `}</style>
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.035, backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "28px 28px" }} />
      <div className="sc-float mb-8">
        <div className="sc-sway text-6xl leading-none">📵</div>
      </div>
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-3 leading-snug">
        {salonName ? `${salonName} isn't taking online bookings` : "Online booking unavailable"}
      </h1>
      <p className="text-sm text-slate-400 leading-relaxed max-w-xs mb-10">
        This salon hasn't enabled online booking yet. Please contact them directly to make an appointment.
      </p>
      <p className="absolute bottom-7 text-[11px] font-medium tracking-widest uppercase text-slate-700">my-salon.online</p>
    </div>
  );
}

// ── route ─────────────────────────────────────────────────────────────────────

export default function SalonBookingRoute() {
  const data = useLoaderData<typeof clientLoader>();
  const [searchParams] = useSearchParams();
  const [wizardKey, setWizardKey] = useState(0);
  const [mode, setMode] = useState<BookingMode>("wizard");

  useEffect(() => {
    if (data.status !== "ok") return;
    document.title = `Book at ${data.salon.name}`;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = buildFaviconHref(data.salon.name, data.theme.logoBgColor);
  }, [data]);

  if (data.status === "not_found") return <SalonErrorPage is404 />;
  if (data.status === "error") return <SalonErrorPage is404={false} />;
  if (data.status === "booking_disabled") return <BookingUnavailablePage salonName={data.salonName} />;

  const { salon, services, staff, theme, countries } = data;
  const serviceId = Number(searchParams.get("serviceId"));
  const staffId   = Number(searchParams.get("staffId"));

  if (mode === "ai") {
    return (
      <GenerativeUIBooking
        salon={salon}
        services={services}
        staff={staff}
        theme={theme}
        onSwitchToWizard={() => setMode("wizard")}
      />
    );
  }

  return (
    <BookingWizard
      key={wizardKey}
      salon={salon}
      services={services}
      staff={staff}
      theme={theme}
      countries={countries}
      initialServiceId={Number.isFinite(serviceId) && serviceId > 0 ? serviceId : null}
      initialStaffId={Number.isFinite(staffId) && staffId > 0 ? staffId : null}
      standalone
      headerExtra={<ModeToggle active="wizard" onSwitch={setMode} theme={theme} />}
      onExit={() => setWizardKey((k) => k + 1)}
    />
  );
}
