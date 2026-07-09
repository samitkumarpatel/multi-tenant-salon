import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Scissors, ArrowLeft, Trash2, LayoutDashboard, Pencil, Briefcase, Users } from "lucide-react";
import { API, apiFetch } from "~/lib/api";
import type { Saloon, LayoutContext } from "~/lib/types";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return apiFetch<Saloon>(`${API}/${params.saloonId}`);
}

export default function Layout() {
  const initial = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [saloon, setSaloon] = useState<Saloon>(initial);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const ctx: LayoutContext = { saloon, setSaloon };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 mb-[-1px] transition-colors ${
      isActive
        ? "text-matcha-600 border-matcha-600"
        : "text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300"
    }`;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`${API}/${saloon.id}`, { method: "DELETE" });
      navigate("/customer");
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-matcha-600 shrink-0" />
              <h1 className="text-base font-bold text-slate-900 leading-tight">{saloon.name}</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 pl-6">
              {saloon.owner?.name}
              {saloon.location?.city ? ` · ${saloon.location.city}` : ""}
            </p>
          </div>
          <nav className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-45"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="w-3 h-3" />
              Delete Saloon
            </button>
            <Link
              to="/customer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors no-underline"
            >
              <ArrowLeft className="w-3 h-3" />
              All Saloons
            </Link>
          </nav>
        </div>
        <div className="flex border-b border-slate-200 px-6 gap-1 bg-white">
          <NavLink to="" end className={navLinkClass}>
            <LayoutDashboard className="w-3.5 h-3.5" /> Overview
          </NavLink>
          <NavLink to="edit" className={navLinkClass}>
            <Pencil className="w-3.5 h-3.5" /> Edit
          </NavLink>
          <NavLink to="services" className={navLinkClass}>
            <Briefcase className="w-3.5 h-3.5" /> Services
          </NavLink>
          <NavLink to="staff" className={navLinkClass}>
            <Users className="w-3.5 h-3.5" /> Staff
          </NavLink>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet context={ctx} />
      </main>

      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-[pop_0.14s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Delete Saloon</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-700">{saloon.name}</strong>? This will permanently remove the saloon and all its data.
                </p>
              </div>
            </div>
            {deleteError && (
              <p className="text-sm font-semibold text-red-600 mb-3">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-45"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-red-500 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-45"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
