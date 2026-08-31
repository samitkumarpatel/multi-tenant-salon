import { useEffect, useState, type ElementType } from "react";
import { useOutletContext } from "react-router";
import { BarChart2, Eye, MousePointerClick, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { InfoBar } from "@salon/ui-shared";
import type { LayoutContext } from "~/lib/types";
import { ADMIN_API, apiFetch } from "~/lib/api";

interface AnalyticsSummary {
  totalViews: number;
  totalClicks: number;
  viewsByDay: { day: string; count: number }[];
  topPages: { path: string; count: number }[];
  topClicks: { label: string; count: number }[];
}

const RANGE_OPTIONS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default function Analytics() {
  const { salon } = useOutletContext<LayoutContext>();
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<AnalyticsSummary>(`${ADMIN_API}/${salon.id}/analytics/summary?days=${days}`)
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analytics"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [salon.id, days]);

  const chartData = (summary?.viewsByDay ?? []).map((d) => ({
    day: formatShortDate(d.day),
    views: d.count,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                  days === opt.days ? "bg-matcha-600 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <InfoBar id="analytics-overview">
          Visits and clicks captured from your public website. Nothing is tracked unless Analytics is enabled for this salon.
        </InfoBar>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading analytics…</div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            <StatTile icon={Eye} label="Page views" value={summary.totalViews} />
            <StatTile icon={MousePointerClick} label="Clicks tracked" value={summary.totalClicks} />
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-100">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Visits over time</span>
            </div>
            {chartData.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-8 text-center">No visits recorded yet in this range.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                    <Area type="monotone" dataKey="views" stroke="#059669" strokeWidth={2} fill="url(#viewsFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            <TopList
              title="Top pages"
              emptyLabel="No page views yet"
              items={summary.topPages.map((p) => ({ key: p.path, label: p.path, count: p.count }))}
            />
            <TopList
              title="Top clicks"
              emptyLabel="No clicks tracked yet"
              items={summary.topClicks.map((c) => ({ key: c.label, label: c.label, count: c.count }))}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: ElementType; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-matcha-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-matcha-600" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function TopList({ title, emptyLabel, items }: { title: string; emptyLabel: string; items: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-4 text-center">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 truncate">{item.label}</span>
                <span className="text-slate-400 font-medium shrink-0">{item.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-matcha-500 rounded-full" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
