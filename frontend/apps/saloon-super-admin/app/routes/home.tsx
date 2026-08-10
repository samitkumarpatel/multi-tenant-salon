import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Shield, LogOut, Search, Building2, MapPin, User, Mail, Zap,
  Trash2, Power, ChevronRight, X, Check, AlertTriangle, RefreshCw,
  LayoutGrid, List, Filter,
} from "lucide-react";
import { AppLogo } from "@saloon/ui-shared";
import { apiFetch, SUPER_ADMIN_API } from "~/lib/api";
import {
  getSession, clearSession,
  ALL_FEATURES, FEATURE_LABEL,
  type Saloon, type SaloonFeature,
} from "~/lib/types";

// ── helpers ───────────────────────────────────────────────────────────────────

const FEATURE_COLOR: Record<SaloonFeature, string> = {
  STATIC_WEBSITE:  "bg-sky-900/40 text-sky-300 border-sky-800/60",
  BOOKING:         "bg-violet-900/40 text-violet-300 border-violet-800/60",
  MEMBERSHIP:      "bg-amber-900/40 text-amber-300 border-amber-800/60",
  WEBSHOP:         "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
  ANALYTICS:       "bg-rose-900/40 text-rose-300 border-rose-800/60",
  LOYALTY_PROGRAM: "bg-purple-900/40 text-purple-300 border-purple-800/60",
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
  saloon: Saloon;
  onClose: () => void;
  onUpdated: (s: Saloon) => void;
}

function SaloonDrawer({ saloon, onClose, onUpdated }: DrawerProps) {
  const [features, setFeatures] = useState<SaloonFeature[]>(saloon.features ?? []);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isDisabled = saloon.status === "DISABLED";

  function toggleFeature(f: SaloonFeature) {
    setFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
    setSaveErr(null);
  }

  async function handleSaveFeatures() {
    setSaving(true);
    setSaveErr(null);
    try {
      const updated = await apiFetch<Saloon>(
        `${SUPER_ADMIN_API}/saloons/${saloon.id}/features`,
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
      const updated = await apiFetch<Saloon>(
        `${SUPER_ADMIN_API}/saloons/${saloon.id}/enable`,
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
      const updated = await apiFetch<Saloon>(
        `${SUPER_ADMIN_API}/saloons/${saloon.id}`,
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
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl overflow-y-auto">

        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-indigo-900/40 border border-indigo-800/40 flex items-center justify-center shrink-0 text-sm font-bold text-indigo-300">
            {initials(saloon.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{saloon.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">{saloon.handler}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Status banner */}
          {isDisabled && (
            <div className="flex items-center gap-3 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-300">Saloon is disabled</p>
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

          {/* Saloon info */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Details</h3>
            <dl className="space-y-2">
              {saloon.owner?.name && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-1.5 text-xs text-slate-500 min-w-[80px]">
                    <User className="w-3 h-3" /> Owner
                  </dt>
                  <dd className="text-xs text-slate-300">{saloon.owner.name}</dd>
                </div>
              )}
              {saloon.owner?.email && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-1.5 text-xs text-slate-500 min-w-[80px]">
                    <Mail className="w-3 h-3" /> Email
                  </dt>
                  <dd className="text-xs text-slate-300 font-mono">{saloon.owner.email}</dd>
                </div>
              )}
              {(saloon.location?.city || saloon.location?.country) && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-1.5 text-xs text-slate-500 min-w-[80px]">
                    <MapPin className="w-3 h-3" /> Location
                  </dt>
                  <dd className="text-xs text-slate-300">
                    {[saloon.location?.city, saloon.location?.country].filter(Boolean).join(", ")}
                  </dd>
                </div>
              )}
              <div className="flex items-center gap-3">
                <dt className="text-xs text-slate-500 min-w-[80px]">Saloon ID</dt>
                <dd className="text-xs text-slate-500 font-mono truncate">{saloon.id}</dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="text-xs text-slate-500 min-w-[80px]">Created</dt>
                <dd className="text-xs text-slate-400">{formatDate(saloon.createdAt)}</dd>
              </div>
            </dl>
          </section>

          {/* Feature toggles */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Features
              </h3>
              {statusMsg && (
                <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {statusMsg}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {ALL_FEATURES.map((f: SaloonFeature) => {
                const enabled = features.includes(f);
                return (
                  <button
                    key={f}
                    onClick={() => toggleFeature(f)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      enabled
                        ? "bg-indigo-900/30 border-indigo-700/60 text-indigo-200"
                        : "bg-slate-800/50 border-slate-700/60 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      enabled ? "bg-indigo-600 border-indigo-500" : "border-slate-600"
                    }`}>
                      {enabled && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-sm font-medium">{FEATURE_LABEL[f]}</span>
                  </button>
                );
              })}
            </div>
            {saveErr && (
              <p className="text-red-400 text-xs mt-2">{saveErr}</p>
            )}
            <button
              onClick={handleSaveFeatures}
              disabled={saving}
              className="mt-3 w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
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
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-800/40 bg-red-900/10 text-red-400 text-sm font-medium hover:bg-red-900/20 hover:border-red-700/60 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  Disable saloon
                </button>
              ) : (
                <div className="border border-red-800/50 rounded-xl bg-red-900/10 p-4 space-y-3">
                  <p className="text-xs text-red-300 leading-relaxed">
                    This will disable <strong className="text-red-200">{saloon.name}</strong>. It will stop accepting bookings and be hidden publicly. All data is preserved and can be re-enabled.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="flex-1 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors cursor-pointer disabled:opacity-40"
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
  const [saloons, setSaloons]   = useState<Saloon[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Saloon | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { navigate("/login", { replace: true }); return; }
    loadSaloons();
  }, []);

  async function loadSaloons() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Saloon[]>(`${SUPER_ADMIN_API}/saloons`);
      setSaloons(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load saloons");
    } finally {
      setLoading(false);
    }
  }

  function handleSaloonUpdated(updated: Saloon) {
    setSaloons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelected(updated);
  }

  function handleSignOut() {
    clearSession();
    navigate("/login", { replace: true });
  }

  const filtered = saloons.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.owner?.email ?? "").toLowerCase().includes(q) ||
      (s.owner?.name ?? "").toLowerCase().includes(q) ||
      (s.location?.city ?? "").toLowerCase().includes(q) ||
      (s.location?.country ?? "").toLowerCase().includes(q) ||
      s.handler.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount   = saloons.filter((s) => s.status === "ACTIVE").length;
  const disabledCount = saloons.filter((s) => s.status === "DISABLED").length;

  return (
    <div className="min-h-[100dvh] bg-slate-950 flex flex-col">

      {/* Top bar */}
      <header className="h-12 border-b border-slate-800 bg-slate-900/80 flex items-center px-4 sm:px-6 gap-3 shrink-0 sticky top-0 z-30">
        <AppLogo size={24} textColor="#e2e8f0" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-900/40 border border-indigo-800/60 px-2 py-0.5 rounded hidden sm:inline">
          Super Admin
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={loadSaloons}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors cursor-pointer"
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
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              All Saloons
            </h1>
            {!loading && !error && (
              <p className="text-xs text-slate-500 mt-1">
                {saloons.length} total · {activeCount} active · {disabledCount} disabled
              </p>
            )}
          </div>
        </div>

        {/* Stat tiles */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Total saloons", value: saloons.length, color: "text-slate-200" },
              { label: "Active",        value: activeCount,   color: "text-emerald-400" },
              { label: "Disabled",      value: disabledCount, color: "text-red-400" },
            ].map((tile) => (
              <div key={tile.label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <p className={`text-2xl font-bold ${tile.color}`}>{tile.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{tile.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search & filter toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, owner, location…"
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-1 py-1">
              <Filter className="w-3 h-3 text-slate-500 ml-1.5 mr-0.5" />
              {(["ALL", "ACTIVE", "DISABLED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === s
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s === "ALL" ? "All" : s === "ACTIVE" ? "Active" : "Disabled"}
                </button>
              ))}
            </div>
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-1 gap-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "grid" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "list" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-6 h-6 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading saloons…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-900/20 border border-red-800/40 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Failed to load</p>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
            </div>
            <button
              onClick={loadSaloons}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <Building2 className="w-10 h-10 text-slate-700" />
            <p className="text-sm text-slate-400">
              {search || statusFilter !== "ALL" ? "No saloons match your filters." : "No saloons registered yet."}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <SaloonCard key={s.id} saloon={s} onClick={() => setSelected(s)} />
            ))}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Saloon</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 hidden sm:table-cell">Owner</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 hidden md:table-cell">Location</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 hidden lg:table-cell">Features</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-900/40 border border-indigo-800/40 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                          {initials(s.name)}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${s.status === "DISABLED" ? "text-slate-500 line-through" : "text-slate-200"}`}>
                            {s.name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono truncate">{s.handler}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-xs text-slate-300 truncate">{s.owner?.name ?? "—"}</p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{s.owner?.email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-slate-400 truncate">
                        {[s.location?.city, s.location?.country].filter(Boolean).join(", ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(s.features ?? []).slice(0, 3).map((f: SaloonFeature) => (
                          <span key={f} className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${FEATURE_COLOR[f]}`}>
                            {FEATURE_LABEL[f]}
                          </span>
                        ))}
                        {(s.features?.length ?? 0) > 3 && (
                          <span className="text-[9px] text-slate-500">+{(s.features?.length ?? 0) - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-600" />
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
        <SaloonDrawer
          saloon={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleSaloonUpdated}
        />
      )}
    </div>
  );
}

// ── Saloon card (grid view) ───────────────────────────────────────────────────

function SaloonCard({ saloon, onClick }: { saloon: Saloon; onClick: () => void }) {
  const isDisabled = saloon.status === "DISABLED";

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left bg-slate-900 border rounded-xl p-5 transition-all cursor-pointer hover:border-indigo-700/60 hover:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] ${
        isDisabled ? "border-slate-800 opacity-60" : "border-slate-800"
      }`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-900/40 border border-indigo-800/40 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
          {initials(saloon.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold leading-tight truncate ${isDisabled ? "text-slate-500 line-through" : "text-slate-100"}`}>
              {saloon.name}
            </p>
            <StatusBadge status={saloon.status} />
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{saloon.handler}</p>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        {saloon.owner?.name && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <User className="w-3 h-3 text-slate-600 shrink-0" />
            <span className="truncate">{saloon.owner.name}</span>
          </div>
        )}
        {saloon.owner?.email && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Mail className="w-3 h-3 text-slate-600 shrink-0" />
            <span className="font-mono truncate">{saloon.owner.email}</span>
          </div>
        )}
        {(saloon.location?.city || saloon.location?.country) && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
            <span className="truncate">
              {[saloon.location?.city, saloon.location?.country].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>

      {saloon.features && saloon.features.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {saloon.features.map((f: SaloonFeature) => (
            <span
              key={f}
              className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${FEATURE_COLOR[f]}`}
            >
              {FEATURE_LABEL[f]}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-600 italic">No features enabled</p>
      )}

      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-600">{formatDate(saloon.createdAt)}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
        status === "ACTIVE"
          ? "bg-emerald-900/40 text-emerald-400 border-emerald-800/60"
          : "bg-red-900/30 text-red-400 border-red-800/50"
      }`}
    >
      {status === "ACTIVE" ? "Active" : "Disabled"}
    </span>
  );
}
