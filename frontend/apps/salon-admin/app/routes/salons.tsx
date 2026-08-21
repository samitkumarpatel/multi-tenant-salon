import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Building2, MapPin, ArrowRight, LogOut, Power } from "lucide-react";
import { AppLogo } from "@salon/ui-shared";
import { getAdminSession, logout as authLogout } from "~/lib/auth";
import { ADMIN_API, apiFetch } from "~/lib/api";
import type { Salon } from "~/lib/types";

export default function SalonPicker() {
  const navigate = useNavigate();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [email, setEmail]     = useState("");
  const [enablingId, setEnablingId] = useState<string | null>(null);

  useEffect(() => {
    const session = getAdminSession();
    if (!session || session.salons.length === 0) {
      navigate("/login", { replace: true });
      return;
    }
    setSalons(session.salons);
    setEmail(session.email);
  }, []);

  function handlePick(salon: Salon) {
    navigate(`/${salon.id}`);
  }

  async function handleEnable(salon: Salon) {
    setEnablingId(String(salon.id));
    try {
      await apiFetch<Salon>(`${ADMIN_API}/${salon.id}/enable`, { method: "PUT" });
      navigate(`/${salon.id}`);
    } finally {
      setEnablingId(null);
    }
  }

  function handleSignOut() {
    authLogout(navigate);
  }

  if (salons.length === 0) return null;

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-y-auto">

      <header className="h-12 border-b border-slate-200 bg-white flex items-center px-6 shrink-0">
        <AppLogo size={24} textColor="#374151" />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:block truncate max-w-[200px]">{email}</span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center px-4 pt-12 pb-10">
        <div className="w-full max-w-[480px]">

          <div className="mb-6 text-center">
            <div className="w-12 h-12 rounded-full bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-matcha-600" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Choose your salon</h1>
            <p className="text-xs text-slate-500 mt-1">
              Multiple salons are linked to <span className="font-medium text-slate-700">{email}</span>.
              Select one to continue.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {salons.map((salon) => {
              const isDisabled = salon.status === "DISABLED";
              const isEnabling = enablingId === String(salon.id);

              if (isDisabled) {
                return (
                  <div
                    key={String(salon.id)}
                    className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 opacity-70"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-slate-400">
                        {salon.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-400 truncate line-through">{salon.name}</p>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-red-500 border border-red-200 rounded px-1.5 py-0.5 bg-red-50">
                          Deleted
                        </span>
                      </div>
                      {salon.location?.city && (
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {salon.location.city}
                          {salon.location.country ? `, ${salon.location.country}` : ""}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleEnable(salon)}
                      disabled={isEnabling}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-matcha-700 border border-matcha-300 bg-white hover:bg-matcha-50 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <Power className="w-3 h-3" />
                      {isEnabling ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={String(salon.id)}
                  onClick={() => handlePick(salon)}
                  className="group flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-matcha-400 hover:shadow-[0_0_0_3px_rgba(86,115,48,0.08)] transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-matcha-50 border border-matcha-100 flex items-center justify-center shrink-0 group-hover:bg-matcha-100 transition-colors">
                    <span className="text-sm font-bold text-matcha-600">
                      {salon.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{salon.name}</p>
                    {salon.location?.city && (
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {salon.location.city}
                        {salon.location.country ? `, ${salon.location.country}` : ""}
                      </p>
                    )}
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-matcha-500 transition-colors shrink-0" />
                </button>
              );
            })}
          </div>

        </div>
      </div>

      <footer className="h-10 border-t border-slate-200 bg-white flex items-center px-6 gap-2 shrink-0">
        <AppLogo size={16} textColor="#94a3b8" />
        <p className="text-[10px] text-slate-400 ml-auto">
          © {new Date().getFullYear()} · All rights reserved.
        </p>
      </footer>

    </div>
  );
}
