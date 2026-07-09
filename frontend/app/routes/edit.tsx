import { useState } from "react";
import { useOutletContext } from "react-router";
import { Save } from "lucide-react";
import { API, apiFetch } from "~/lib/api";
import { FEATURES, FEATURE_LABEL, cloneHours } from "~/lib/constants";
import type { LayoutContext, Saloon, Location, ContactInfo } from "~/lib/types";
import HoursTable from "~/components/HoursTable";
import TileGrid from "~/components/TileGrid";

const blankLocation = (): Location => ({ address: "", city: "", state: "", country: "", zipCode: "" });
const blankContact  = (): ContactInfo => ({ phone: "", email: "", website: "" });

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900 font-sans";
const sectionCard = "bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-4";
const sectionTitle = "text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-4 pb-2.5 border-b border-slate-100";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

export default function Edit() {
  const { saloon, setSaloon } = useOutletContext<LayoutContext>();

  const [name,     setName]     = useState(saloon.name);
  const [location, setLocation] = useState<Location>(saloon.location ? { ...saloon.location } : blankLocation());
  const [contact,  setContact]  = useState<ContactInfo>(saloon.contact ? { ...saloon.contact } : blankContact());
  const [hours,    setHours]    = useState(cloneHours(saloon.operatingHours));
  const [features, setFeatures] = useState<string[]>([...(saloon.features ?? [])]);

  const [busy,  setBusy]  = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  function notify(msg: string, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setBusy(true);
    try {
      const updated = await apiFetch<Saloon>(`${API}/${saloon.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, location, contact, operatingHours: hours }),
      });
      const withFeatures = await apiFetch<Saloon>(`${API}/${saloon.id}/features`, {
        method: "PUT",
        body: JSON.stringify(features),
      });
      setSaloon({ ...updated, features: withFeatures.features ?? features });
      notify("Saloon updated!");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSave}>
        {/* Basic */}
        <div className={sectionCard}>
          <div className={sectionTitle}>Basic Info</div>
          <div className="mb-4">
            <label className={fieldLabel}>Saloon Name <span className="text-red-500">*</span></label>
            <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        {/* Location */}
        <div className={sectionCard}>
          <div className={sectionTitle}>Location</div>
          <div className="mb-4">
            <label className={fieldLabel}>Address</label>
            <input className={inputCls} value={location.address ?? ""} onChange={(e) => setLocation((l) => ({ ...l, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="mb-4">
              <label className={fieldLabel}>City</label>
              <input className={inputCls} value={location.city ?? ""} onChange={(e) => setLocation((l) => ({ ...l, city: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className={fieldLabel}>State</label>
              <input className={inputCls} value={location.state ?? ""} onChange={(e) => setLocation((l) => ({ ...l, state: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className={fieldLabel}>ZIP</label>
              <input className={inputCls} value={location.zipCode ?? ""} onChange={(e) => setLocation((l) => ({ ...l, zipCode: e.target.value }))} />
            </div>
          </div>
          <div className="mb-4">
            <label className={fieldLabel}>Country</label>
            <input className={inputCls} value={location.country ?? ""} onChange={(e) => setLocation((l) => ({ ...l, country: e.target.value }))} />
          </div>
        </div>

        {/* Contact */}
        <div className={sectionCard}>
          <div className={sectionTitle}>Contact</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="mb-4">
              <label className={fieldLabel}>Phone</label>
              <input className={inputCls} value={contact.phone ?? ""} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className={fieldLabel}>Email</label>
              <input className={inputCls} type="email" value={contact.email ?? ""} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className={fieldLabel}>Website</label>
              <input className={inputCls} value={contact.website ?? ""} onChange={(e) => setContact((c) => ({ ...c, website: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className={sectionCard}>
          <div className={sectionTitle}>Features</div>
          <TileGrid options={FEATURES} labels={FEATURE_LABEL} selected={features} onChange={setFeatures} />
        </div>

        {/* Hours */}
        <div className={sectionCard}>
          <div className={sectionTitle}>Operating Hours</div>
          <HoursTable hours={hours} onChange={setHours} />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !name}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white shadow-lg z-[1000] animate-[slide-up_0.16s_ease] ${toast.type === "error" ? "bg-red-600" : "bg-matcha-600"}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
