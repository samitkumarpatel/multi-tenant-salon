import { useState } from "react";
import { Link, useOutletContext } from "react-router";
import { useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  User, Mail, Phone, MapPin, Globe, Clock, Zap, Pencil,
  Scissors, Users, CalendarDays, CalendarCheck, Check, X,
} from "lucide-react";
import { apiFetch, ADMIN_API, SUPER_ADMIN_API, COUNTRIES_API } from "~/lib/api";
import type {
  Saloon, Owner, Location, ContactInfo, OperatingHours, SaloonFeature,
  Country, SaloonManageContext,
} from "~/lib/types";
import { ALL_FEATURES, FEATURE_LABEL } from "~/lib/types";

export async function clientLoader(_: ClientLoaderFunctionArgs) {
  const countries = await apiFetch<Country[]>(COUNTRIES_API).catch((): Country[] => []);
  return { countries };
}

const FEATURE_COLOR: Record<string, string> = {
  STATIC_WEBSITE:  "bg-sky-50 text-sky-700 border-sky-200",
  BOOKING:         "bg-violet-50 text-violet-700 border-violet-200",
  MEMBERSHIP:      "bg-amber-50 text-amber-700 border-amber-200",
  WEBSHOP:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  ANALYTICS:       "bg-rose-50 text-rose-700 border-rose-200",
  LOYALTY_PROGRAM: "bg-purple-50 text-purple-700 border-purple-200",
};

const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const DAY_SHORT: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

function cloneHours(src?: OperatingHours[]): OperatingHours[] {
  if (!src?.length) return DAYS.map((day) => ({ day, openTime: "09:00", closeTime: "18:00", closed: day === "SUNDAY" }));
  return DAYS.map((day) => {
    const h = src.find((x) => x.day === day);
    return h ? { ...h } : { day, openTime: "09:00", closeTime: "18:00", closed: true };
  });
}

const inp = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50 text-stone-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-stone-400";
const lbl = "block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide";

const QUICK_LINKS = [
  { label: "Edit Details", to: "edit",     icon: Pencil },
  { label: "Services",     to: "services", icon: Scissors },
  { label: "Staff",        to: "staff",    icon: Users },
  { label: "Holidays",     to: "holidays", icon: CalendarDays },
  { label: "Bookings",     to: "bookings", icon: CalendarCheck },
];

function HoursEditor({ hours, onChange }: { hours: OperatingHours[]; onChange: (h: OperatingHours[]) => void }) {
  const ensured = DAYS.map(
    (day) => hours.find((h) => h.day === day) ?? { day, openTime: "09:00", closeTime: "18:00", closed: false }
  );
  function update(idx: number, patch: Partial<OperatingHours>) {
    onChange(ensured.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  }
  return (
    <div className="space-y-2">
      {ensured.map((h, idx) => (
        <div key={h.day} className="flex items-center gap-3">
          <span className="w-8 text-xs font-medium text-stone-500 shrink-0">{DAY_SHORT[h.day]}</span>
          <button
            type="button"
            onClick={() => update(idx, { closed: !h.closed })}
            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${h.closed ? "bg-stone-200" : "bg-matcha-600"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${h.closed ? "translate-x-0" : "translate-x-4"}`} />
          </button>
          {!h.closed ? (
            <>
              <input type="time" value={h.openTime ?? "09:00"} onChange={(e) => update(idx, { openTime: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border border-stone-200 rounded-md bg-stone-50 text-stone-800 outline-none focus:border-matcha-500" />
              <span className="text-stone-400 text-xs">–</span>
              <input type="time" value={h.closeTime ?? "18:00"} onChange={(e) => update(idx, { closeTime: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border border-stone-200 rounded-md bg-stone-50 text-stone-800 outline-none focus:border-matcha-500" />
            </>
          ) : (
            <span className="text-xs text-stone-400 italic">Closed</span>
          )}
        </div>
      ))}
    </div>
  );
}

type Section = "name" | "owner" | "location" | "contact" | "features" | "hours";

interface EditableCardProps {
  title: string;
  isEditing: boolean;
  saving: boolean;
  error: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  display: React.ReactNode;
  form: React.ReactNode;
  className?: string;
}

function EditableCard({ title, isEditing, saving, error, onEdit, onCancel, onSave, display, form, className = "" }: EditableCardProps) {
  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-colors ${isEditing ? "border-matcha-300 shadow-sm" : "border-stone-200"} ${className}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{title}</h3>
        {isEditing ? (
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-matcha-600 transition-colors cursor-pointer"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>
      <div className="px-5 py-4">
        {isEditing ? form : display}
        {isEditing && error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </div>
      {isEditing && (
        <div className="px-5 py-3 border-t border-stone-100 flex justify-end">
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-matcha-600 hover:bg-matcha-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
          >
            {saving ? "Saving…" : <><Check className="w-3 h-3" /> Save</>}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SaloonOverview() {
  const { saloon, setSaloon } = useOutletContext<SaloonManageContext>();
  const { countries } = useLoaderData<typeof clientLoader>();

  const [editing, setEditing]   = useState<Section | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);

  const [nameDraft, setNameDraft]         = useState(saloon.name);
  const [ownerDraft, setOwnerDraft]       = useState<Owner>(saloon.owner ?? { name: "", email: "" });
  const [locDraft, setLocDraft]           = useState<Location>(saloon.location ?? {});
  const [contactDraft, setContactDraft]   = useState<ContactInfo>(saloon.contact ?? {});
  const [featuresDraft, setFeaturesDraft] = useState<SaloonFeature[]>(saloon.features ?? []);
  const [hoursDraft, setHoursDraft]       = useState<OperatingHours[]>(cloneHours(saloon.operatingHours));

  function startEdit(section: Section) {
    setNameDraft(saloon.name);
    setOwnerDraft(saloon.owner ?? { name: "", email: "" });
    setLocDraft(saloon.location ?? {});
    setContactDraft(saloon.contact ?? {});
    setFeaturesDraft(saloon.features ?? []);
    setHoursDraft(cloneHours(saloon.operatingHours));
    setSaveErr(null);
    setEditing(section);
  }

  function cancel() {
    setEditing(null);
    setSaveErr(null);
  }

  async function save(section: Section) {
    setSaving(true);
    setSaveErr(null);
    try {
      let updated: Saloon;
      if (section === "owner") {
        updated = await apiFetch<Saloon>(`${SUPER_ADMIN_API}/saloons/${saloon.id}/owner`, {
          method: "PUT",
          body: JSON.stringify({
            name:  ownerDraft.name,
            email: ownerDraft.email,
            phone: ownerDraft.phone?.trim() || null,
          }),
        });
      } else if (section === "features") {
        updated = await apiFetch<Saloon>(`${ADMIN_API}/${saloon.id}/features`, {
          method: "PUT",
          body: JSON.stringify(featuresDraft),
        });
      } else {
        updated = await apiFetch<Saloon>(`${ADMIN_API}/${saloon.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name:           section === "name"     ? nameDraft.trim() : saloon.name,
            location:       section === "location" ? locDraft         : saloon.location,
            contact:        section === "contact"  ? contactDraft     : saloon.contact,
            operatingHours: section === "hours"    ? hoursDraft       : saloon.operatingHours,
            bookingAdvanceDays:          saloon.bookingAdvanceDays,
            businessRegistrationId:      saloon.businessRegistrationId,
            showBusinessId:              saloon.showBusinessId,
            bookingRequiresConfirmation: saloon.bookingRequiresConfirmation,
          }),
        });
      }
      setSaloon(updated);
      setEditing(null);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedCountry = countries.find((c) => c.name === locDraft.country);
  const bizIdLabel      = selectedCountry?.businessIdLabel ?? null;

  function toggleFeature(f: SaloonFeature) {
    setFeaturesDraft((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }

  return (
    <div className="space-y-4">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{saloon.name}</h1>
          <p className="text-xs text-stone-400 font-mono mt-0.5">{saloon.handler}</p>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
          saloon.status === "ACTIVE"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-600 border-red-200"
        }`}>
          {saloon.status}
        </span>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {QUICK_LINKS.map(({ label, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1.5 px-3 py-3 bg-white border border-stone-200 rounded-xl hover:border-matcha-300 hover:bg-stone-50 transition-all text-center group"
          >
            <Icon className="w-4 h-4 text-stone-400 group-hover:text-matcha-500 transition-colors" />
            <span className="text-xs font-medium text-stone-500 group-hover:text-stone-800 transition-colors">{label}</span>
          </Link>
        ))}
      </div>

      {/* 2-column: Name + Owner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Saloon name */}
        <EditableCard
          title="Saloon name"
          isEditing={editing === "name"}
          saving={saving}
          error={editing === "name" ? saveErr : null}
          onEdit={() => startEdit("name")}
          onCancel={cancel}
          onSave={() => save("name")}
          display={
            <p className="text-sm font-semibold text-stone-800">{saloon.name}</p>
          }
          form={
            <div>
              <label className={lbl}>Name <span className="text-red-500">*</span></label>
              <input
                autoFocus
                className={inp}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="e.g. The Modern Cut"
              />
            </div>
          }
        />

        {/* Owner */}
        <EditableCard
          title="Ownership"
          isEditing={editing === "owner"}
          saving={saving}
          error={editing === "owner" ? saveErr : null}
          onEdit={() => startEdit("owner")}
          onCancel={cancel}
          onSave={() => save("owner")}
          display={
            <div className="space-y-2.5">
              {saloon.owner?.name && (
                <div className="flex items-start gap-3">
                  <User className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-wide">Name</p><p className="text-sm text-stone-800">{saloon.owner.name}</p></div>
                </div>
              )}
              {saloon.owner?.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-wide">Email</p><p className="text-sm text-stone-800">{saloon.owner.email}</p></div>
                </div>
              )}
              {saloon.owner?.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-wide">Phone</p><p className="text-sm text-stone-800">{saloon.owner.phone}</p></div>
                </div>
              )}
              {!saloon.owner?.name && !saloon.owner?.email && (
                <p className="text-sm text-stone-400 italic">No owner info</p>
              )}
            </div>
          }
          form={
            <div className="space-y-3">
              <div>
                <label className={lbl}>Full name <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  className={inp}
                  value={ownerDraft.name}
                  onChange={(e) => setOwnerDraft((o) => ({ ...o, name: e.target.value }))}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className={lbl}>Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  className={inp}
                  value={ownerDraft.email}
                  onChange={(e) => setOwnerDraft((o) => ({ ...o, email: e.target.value }))}
                  placeholder="owner@saloon.com"
                />
                <p className="text-xs text-stone-400 mt-1">Changing this affects owner login access.</p>
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input
                  type="tel"
                  className={inp}
                  value={ownerDraft.phone ?? ""}
                  onChange={(e) => setOwnerDraft((o) => ({ ...o, phone: e.target.value }))}
                  placeholder="+1 555 000 0000"
                />
              </div>
            </div>
          }
        />
      </div>

      {/* 2-column: Location + Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Location */}
        <EditableCard
          title="Location"
          isEditing={editing === "location"}
          saving={saving}
          error={editing === "location" ? saveErr : null}
          onEdit={() => startEdit("location")}
          onCancel={cancel}
          onSave={() => save("location")}
          display={
            <div className="space-y-2">
              {(saloon.location?.address || saloon.location?.city || saloon.location?.country) ? (
                <div className="flex items-start gap-3">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                  <div>
                    {saloon.location?.address && <p className="text-sm text-stone-800">{saloon.location.address}</p>}
                    <p className="text-sm text-stone-600">
                      {[saloon.location?.zipCode, saloon.location?.city, saloon.location?.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-400 italic">No location set</p>
              )}
            </div>
          }
          form={
            <div className="space-y-3">
              <div>
                <label className={lbl}>Country</label>
                <select
                  value={locDraft.country ?? ""}
                  onChange={(e) => setLocDraft((l) => ({ ...l, country: e.target.value }))}
                  className={`${inp} appearance-none`}
                >
                  <option value="">Select country…</option>
                  {countries.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Address</label>
                <input className={inp} value={locDraft.address ?? ""} onChange={(e) => setLocDraft((l) => ({ ...l, address: e.target.value }))} placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Postal code</label>
                  <input className={inp} value={locDraft.zipCode ?? ""} onChange={(e) => setLocDraft((l) => ({ ...l, zipCode: e.target.value }))} placeholder="94105" />
                </div>
                <div>
                  <label className={lbl}>City</label>
                  <input className={inp} value={locDraft.city ?? ""} onChange={(e) => setLocDraft((l) => ({ ...l, city: e.target.value }))} placeholder="San Francisco" />
                </div>
              </div>
              {bizIdLabel && (
                <div>
                  <label className={lbl}>{bizIdLabel}</label>
                  <input className={`${inp} opacity-60`} value={saloon.businessRegistrationId ?? ""} readOnly placeholder={selectedCountry?.businessIdPlaceholder ?? ""} />
                  <p className="text-xs text-stone-400 mt-1">Edit business registration ID via the full Edit Details form.</p>
                </div>
              )}
            </div>
          }
        />

        {/* Contact */}
        <EditableCard
          title="Contact info"
          isEditing={editing === "contact"}
          saving={saving}
          error={editing === "contact" ? saveErr : null}
          onEdit={() => startEdit("contact")}
          onCancel={cancel}
          onSave={() => save("contact")}
          display={
            <div className="space-y-2.5">
              {saloon.contact?.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-wide">Phone</p><p className="text-sm text-stone-800">{saloon.contact.phone}</p></div>
                </div>
              )}
              {saloon.contact?.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-wide">Email</p><p className="text-sm text-stone-800">{saloon.contact.email}</p></div>
                </div>
              )}
              {saloon.contact?.website && (
                <div className="flex items-start gap-3">
                  <Globe className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-wide">Website</p><p className="text-sm text-stone-800 break-all">{saloon.contact.website}</p></div>
                </div>
              )}
              {!saloon.contact?.phone && !saloon.contact?.email && !saloon.contact?.website && (
                <p className="text-sm text-stone-400 italic">No contact info</p>
              )}
            </div>
          }
          form={
            <div className="space-y-3">
              <div>
                <label className={lbl}>Phone</label>
                <input type="tel" className={inp} value={contactDraft.phone ?? ""} onChange={(e) => setContactDraft((c) => ({ ...c, phone: e.target.value }))} placeholder="+1 555 000 0000" />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input type="email" className={inp} value={contactDraft.email ?? ""} onChange={(e) => setContactDraft((c) => ({ ...c, email: e.target.value }))} placeholder="hello@saloon.com" />
              </div>
              <div>
                <label className={lbl}>Website</label>
                <input className={inp} value={contactDraft.website ?? ""} onChange={(e) => setContactDraft((c) => ({ ...c, website: e.target.value }))} placeholder="https://saloon.com" />
              </div>
            </div>
          }
        />
      </div>

      {/* Features (full width) */}
      <EditableCard
        title="Active Features"
        isEditing={editing === "features"}
        saving={saving}
        error={editing === "features" ? saveErr : null}
        onEdit={() => startEdit("features")}
        onCancel={cancel}
        onSave={() => save("features")}
        display={
          saloon.features && saloon.features.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {saloon.features.map((f) => (
                <span key={f} className={`text-xs font-semibold px-2.5 py-1 rounded border flex items-center gap-1.5 ${FEATURE_COLOR[f] ?? "bg-stone-100 text-stone-600 border-stone-200"}`}>
                  <Zap className="w-3 h-3" /> {FEATURE_LABEL[f] ?? f}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 italic">No features enabled</p>
          )
        }
        form={
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_FEATURES.map((f) => {
              const on = featuresDraft.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFeature(f)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    on ? "bg-matcha-50 border-matcha-300 text-matcha-700" : "bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-matcha-600 border-matcha-500" : "border-stone-300"}`}>
                    {on && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="text-sm font-medium">{FEATURE_LABEL[f]}</span>
                </button>
              );
            })}
          </div>
        }
      />

      {/* Operating Hours (full width) */}
      <EditableCard
        title="Opening hours"
        isEditing={editing === "hours"}
        saving={saving}
        error={editing === "hours" ? saveErr : null}
        onEdit={() => startEdit("hours")}
        onCancel={cancel}
        onSave={() => save("hours")}
        display={
          saloon.operatingHours && saloon.operatingHours.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {saloon.operatingHours.map((h) => (
                <div key={h.day} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-400 w-8">{DAY_SHORT[h.day] ?? h.day}</span>
                  {h.closed ? (
                    <span className="text-xs text-stone-300">Closed</span>
                  ) : (
                    <span className="text-xs text-stone-500">{h.openTime}–{h.closeTime}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 italic">No hours set</p>
          )
        }
        form={<HoursEditor hours={hoursDraft} onChange={setHoursDraft} />}
      />

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs text-stone-400">
        <Clock className="w-3 h-3" />
        Saloon ID: <span className="font-mono">{saloon.id}</span>
      </div>
    </div>
  );
}
