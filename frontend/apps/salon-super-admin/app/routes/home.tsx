import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import {
  Shield, LogOut, Search, Building2, MapPin, User, Mail, Zap,
  Trash2, Power, ChevronRight, X, Check, AlertTriangle, RefreshCw,
  LayoutGrid, List, Filter, ExternalLink,
} from "lucide-react";
import { AppLogo, SessionBadge } from "@salon/ui-shared";
import { apiFetch, SUPER_ADMIN_API } from "~/lib/api";
import {
  ALL_FEATURES, FEATURE_LABEL,
  type Salon, type SalonFeature,
} from "~/lib/types";
import { getSession, getAccessTokenExpiry, logout as authLogout } from "~/lib/auth";

// ── helpers ───────────────────────────────────────────────────────────────────

const FEATURE_COLOR: Record<SalonFeature, string> = {
  STATIC_WEBSITE:  "bg-sky-50 text-sky-700 border-sky-200",
  BOOKING:         "bg-violet-50 text-violet-700 border-violet-200",
  MEMBERSHIP:      "bg-amber-50 text-amber-700 border-amber-200",
  WEBSHOP:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  ANALYTICS:       "bg-rose-50 text-rose-700 border-rose-200",
  LOYALTY_PROGRAM: "bg-purple-50 text-purple-700 border-purple-200",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Feature editor drawer ─────────────────────────────────────────────────────

interface DrawerProps {
  salon: Salon;
  onClose: () => void;
  onUpdated: (s: Salon) => void;
}

function SalonDrawer({ salon, onClose, onUpdated }: DrawerProps) {
  const [features, setFeatures] = useState<SalonFeature[]>(salon.features ?? []);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isDisabled = salon.status === "DISABLED";

  function toggleFeature(f: SalonFeature) {
    setFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
    setSaveErr(null);
  }

  async function handleSaveFeatures() {
    setSaving(true);
    setSaveErr(null);
    try {
      const updated = await apiFetch<Salon>(
        `${SUPER_ADMIN_API}/salons/${salon.id}/features`,
        { method: "PUT", body: JSON.stringify(features) }
      );
      onUpdated(updated);
      setStatusMsg("Features saved.");
      setTimeout(() => setStatusMsg(null), 2000);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnable() {
    setEnabling(true);
    try {
      const updated = await apiFetch<Salon>(
        `${SUPER_ADMIN_API}/salons/${salon.id}/enable`,
        { method: "PUT" }
      );
      onUpdated(updated);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Enable failed");
    } finally {
      setEnabling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setSaveErr(null);
    try {
      const updated = await apiFetch<Salon>(
        `${SUPER_ADMIN_API}/salons/${salon.id}`,
        { method: "DELETE" }
      );
      onUpdated(updated);
      setConfirmDelete(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-stone-200 z-50 flex flex-col shadow-2xl overflow-y-auto">

        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-5 border-b border-stone-200">
          <div className="w-10 h-10 rounded-lg bg-matcha-50 border border-matcha-200 flex items-center justify-center shrink-0 text-sm font-bold text-matcha-600">
            {initials(salon.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-900 truncate">{salon.name}</p>
            <p className="text-[11px] text-stone-400 mt-0.5 font-mono truncate">{salon.handler}</p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to={`/${salon.id}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-matcha-600 hover:bg-matcha-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              Manage
            </Link>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-800 transition-colors cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Status banner */}
          {isDisabled && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-500">Salon is disabled</p>
                <p className="text-[11px] text-red-500 mt-0.5">Not accepting bookings or visible publicly.</p>
              </div>
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Power className="w-3 h-3" />
                {enabling ? "Enabling…" : "Enable"}
              </button>
            </div>
          )}

          {/* Salon info */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">Details</h3>
            <dl className="space-y-2">
              {salon.owner?.name && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-1.5 text-xs text-stone-400 min-w-[80px]">
                    <User className="w-3 h-3" /> Owner
                  </dt>
                  <dd className="text-xs text-stone-600">{salon.owner.name}</dd>
                </div>
              )}
              {salon.owner?.email && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-1.5 text-xs text-stone-400 min-w-[80px]">
                    <Mail className="w-3 h-3" /> Email
                  </dt>
                  <dd className="text-xs text-stone-600 font-mono">{salon.owner.email}</dd>
                </div>
              )}
              {(salon.location?.city || salon.location?.country) && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-1.5 text-xs text-stone-400 min-w-[80px]">
                    <MapPin className="w-3 h-3" /> Location
                  </dt>
                  <dd className="text-xs text-stone-600">
                    {[salon.location?.city, salon.location?.country].filter(Boolean).join(", ")}
                  </dd>
                </div>
              )}
              <div className="flex items-center gap-3">
                <dt className="text-xs text-stone-400 min-w-[80px]">Salon ID</dt>
                <dd className="text-xs text-stone-400 font-mono truncate">{salon.id}</dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="text-xs text-stone-400 min-w-[80px]">Created</dt>
                <dd className="text-xs text-stone-500">{formatDate(salon.createdAt)}</dd>
              </div>
            </dl>
          </section>

          {/* Feature toggles */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Features
              </h3>
              {statusMsg && (
                <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {statusMsg}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {ALL_FEATURES.map((f: SalonFeature) => {
                const enabled = features.includes(f);
                return (
                  <button
                    key={f}
                    onClick={() => toggleFeature(f)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      enabled
                        ? "bg-matcha-50 border-matcha-300 text-matcha-700"
                        : "bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      enabled ? "bg-matcha-600 border-indigo-500" : "border-stone-300"
                    }`}>
                      {enabled && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-sm font-medium">{FEATURE_LABEL[f]}</span>
                  </button>
                );
              })}
            </div>
            {saveErr && (
              <p className="text-red-600 text-xs mt-2">{saveErr}</p>
            )}
            <button
              onClick={handleSaveFeatures}
              disabled={saving}
              className="mt-3 w-full py-2.5 rounded-lg bg-matcha-600 hover:bg-matcha-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save features"}
            </button>
          </section>

          {/* Danger zone */}
          {!isDisabled && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-red-600/70 mb-3">Danger zone</h3>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-800/40 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  Disable salon
                </button>
              ) : (
                <div className="border border-red-200 rounded-xl bg-red-50 p-4 space-y-3">
                  <p className="text-xs text-red-500 leading-relaxed">
                    This will disable <strong className="text-red-700">{salon.name}</strong>. It will stop accepting bookings and be hidden publicly. All data is preserved and can be re-enabled.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="flex-1 py-2 rounded-lg border border-stone-200 text-xs font-medium text-stone-500 hover:text-stone-800 hover:border-stone-300 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      {deleting ? "Disabling…" : "Disable"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function SuperAdminHome() {
  const navigate = useNavigate();
  const session = getSession();
  const [salons, setSalons]   = useState<Salon[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selected, setSelected] = useState<Salon | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { navigate("/login", { replace: true }); return; }
    loadSalons("", "ALL");
  }, []);

  async function loadSalons(q: string, status: "ALL" | "ACTIVE" | "DISABLED") {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "ALL") params.set("status", status);
      const qs = params.toString();
      const data = await apiFetch<Salon[]>(`${SUPER_ADMIN_API}/salons${qs ? `?${qs}` : ""}`);
      setSalons(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load salons");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadSalons(value, statusFilter), 400);
  }

  function handleStatusChange(status: "ALL" | "ACTIVE" | "DISABLED") {
    setStatusFilter(status);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    loadSalons(search, status);
  }

  function handleSalonUpdated(updated: Salon) {
    setSalons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelected(updated);
  }

  function handleSignOut() {
    authLogout(navigate);
  }

  const activeCount   = salons.filter((s) => s.status === "ACTIVE").length;
  const disabledCount = salons.filter((s) => s.status === "DISABLED").length;

  return (
    <div className="min-h-[100dvh] bg-stone-50 flex flex-col">

      {/* Top bar */}
      <header className="h-12 border-b border-stone-200 bg-white/80 flex items-center px-3 sm:px-6 gap-2 sm:gap-3 shrink-0 sticky top-0 z-30">
        <span className="hidden sm:inline-flex">
          <AppLogo size={24} textColor="#e2e8f0" />
        </span>
        <span className="sm:hidden">
          <AppLogo size={24} showText={false} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-matcha-500 bg-matcha-50 border border-matcha-200 px-2 py-0.5 rounded hidden sm:inline">
          Super Admin
        </span>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {session && (
            <div className="hidden md:flex">
              <SessionBadge email={session.email} expiresAt={getAccessTokenExpiry()} tone="stone" />
            </div>
          )}
          <button
            onClick={() => loadSalons(search, statusFilter)}
            className="shrink-0 p-1.5 rounded-md text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSignOut}
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-stone-200 text-xs font-medium text-stone-500 hover:text-stone-800 hover:border-stone-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">

        {/* Page heading */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-matcha-500" />
              All Salons
            </h1>
            {!loading && !error && (
              <p className="text-xs text-stone-400 mt-1">
                {salons.length} total · {activeCount} active · {disabledCount} disabled
              </p>
            )}
          </div>
        </div>

        {/* Stat tiles */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Total salons", value: salons.length, color: "text-stone-800" },
              { label: "Active",        value: activeCount,   color: "text-emerald-700" },
              { label: "Disabled",      value: disabledCount, color: "text-red-600" },
            ].map((tile) => (
              <div key={tile.label} className="bg-white border border-stone-200 rounded-xl px-4 py-3">
                <p className={`text-2xl font-bold ${tile.color}`}>{tile.value}</p>
                <p className="text-[11px] text-stone-400 mt-0.5">{tile.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search & filter toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name, owner, email, phone, location…"
              className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-600/20 transition"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg px-1 py-1">
              <Filter className="w-3 h-3 text-stone-400 ml-1.5 mr-0.5" />
              {(["ALL", "ACTIVE", "DISABLED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === s
                      ? "bg-matcha-600 text-white"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {s === "ALL" ? "All" : s === "ACTIVE" ? "Active" : "Disabled"}
                </button>
              ))}
            </div>
            <div className="flex items-center bg-white border border-stone-200 rounded-lg p-1 gap-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "list" ? "bg-stone-200 text-stone-900" : "text-stone-400 hover:text-stone-600"}`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "grid" ? "bg-stone-200 text-stone-900" : "text-stone-400 hover:text-stone-600"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-6 h-6 border-2 border-stone-200 border-t-matcha-500 rounded-full animate-spin" />
            <p className="text-sm text-stone-400">Loading salons…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">Failed to load</p>
              <p className="text-xs text-stone-400 mt-1">{error}</p>
            </div>
            <button
              onClick={() => loadSalons(search, statusFilter)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-sm text-stone-800 font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : salons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <Building2 className="w-10 h-10 text-stone-300" />
            <p className="text-sm text-stone-500">
              {search || statusFilter !== "ALL" ? "No salons match your filters." : "No salons registered yet."}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {salons.map((s) => (
              <SalonCard key={s.id} salon={s} onClick={() => setSelected(s)} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Salon</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hidden sm:table-cell">Owner</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hidden md:table-cell">Location</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hidden lg:table-cell">Features</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Status</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {salons.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="border-b border-stone-200 last:border-0 hover:bg-stone-100/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-matcha-50 border border-matcha-200 flex items-center justify-center text-xs font-bold text-matcha-600 shrink-0">
                          {initials(s.name)}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${s.status === "DISABLED" ? "text-stone-400 line-through" : "text-stone-800"}`}>
                            {s.name}
                          </p>
                          <p className="text-[11px] text-stone-400 font-mono truncate">{s.handler}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-xs text-stone-600 truncate">{s.owner?.name ?? "—"}</p>
                      <p className="text-[11px] text-stone-400 font-mono truncate">{s.owner?.email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-stone-500 truncate">
                        {[s.location?.city, s.location?.country].filter(Boolean).join(", ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(s.features ?? []).slice(0, 3).map((f: SalonFeature) => (
                          <span key={f} className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${FEATURE_COLOR[f]}`}>
                            {FEATURE_LABEL[f]}
                          </span>
                        ))}
                        {(s.features?.length ?? 0) > 3 && (
                          <span className="text-[9px] text-stone-400">+{(s.features?.length ?? 0) - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <SalonDrawer
          salon={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleSalonUpdated}
        />
      )}
    </div>
  );
}

// ── Salon card (grid view) ───────────────────────────────────────────────────

function SalonCard({ salon, onClick }: { salon: Salon; onClick: () => void }) {
  const isDisabled = salon.status === "DISABLED";

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left bg-white border rounded-xl p-5 transition-all cursor-pointer hover:border-matcha-300 hover:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] ${
        isDisabled ? "border-stone-200 opacity-60" : "border-stone-200"
      }`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-matcha-50 border border-matcha-200 flex items-center justify-center text-sm font-bold text-matcha-600 shrink-0">
          {initials(salon.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold leading-tight truncate ${isDisabled ? "text-stone-400 line-through" : "text-stone-900"}`}>
              {salon.name}
            </p>
            <StatusBadge status={salon.status} />
          </div>
          <p className="text-[11px] text-stone-400 font-mono mt-0.5 truncate">{salon.handler}</p>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        {salon.owner?.name && (
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <User className="w-3 h-3 text-stone-400 shrink-0" />
            <span className="truncate">{salon.owner.name}</span>
          </div>
        )}
        {salon.owner?.email && (
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <Mail className="w-3 h-3 text-stone-400 shrink-0" />
            <span className="font-mono truncate">{salon.owner.email}</span>
          </div>
        )}
        {(salon.location?.city || salon.location?.country) && (
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
            <span className="truncate">
              {[salon.location?.city, salon.location?.country].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>

      {salon.features && salon.features.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {salon.features.map((f: SalonFeature) => (
            <span
              key={f}
              className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${FEATURE_COLOR[f]}`}
            >
              {FEATURE_LABEL[f]}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-stone-400 italic">No features enabled</p>
      )}

      <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between">
        <span className="text-[11px] text-stone-400">{formatDate(salon.createdAt)}</span>
        <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-matcha-500 transition-colors" />
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
        status === "ACTIVE"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-600 border-red-200"
      }`}
    >
      {status === "ACTIVE" ? "Active" : "Disabled"}
    </span>
  );
}
