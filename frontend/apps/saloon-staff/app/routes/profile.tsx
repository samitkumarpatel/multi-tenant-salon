import { useRef, useState } from "react";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Pencil, X, Crown, CalendarOff, UserCircle, Camera } from "lucide-react";
import { STAFF_PORTAL_API, COUNTRIES_API, apiFetch } from "~/lib/api";
import { getStaffSession } from "~/routes/login";
import { InfoBar, PhoneInput, TileGrid, Toast, useToast } from "@saloon/ui-shared";
import type { Country, PresignedUpload, StaffMember } from "~/lib/types";

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const inputDisabledCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50 text-slate-500 cursor-not-allowed";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

const ROLE_OPTIONS = ["MANAGER", "STYLIST", "COLORIST", "MAKEUP_ARTIST", "NAIL_TECHNICIAN", "RECEPTIONIST", "ASSISTANT"] as const;
const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager", STYLIST: "Stylist", COLORIST: "Colorist",
  MAKEUP_ARTIST: "Makeup Artist", NAIL_TECHNICIAN: "Nail Technician",
  RECEPTIONIST: "Receptionist", ASSISTANT: "Assistant",
};
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "ON_LEAVE"] as const;
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On leave" };
const STATUS_DOT: Record<string, string> = { ACTIVE: "bg-green-500", INACTIVE: "bg-slate-300", ON_LEAVE: "bg-amber-500" };

const SPECIALIZATION_OPTIONS = ["HAIR", "MAKEUP", "NAILS", "SKIN_CARE", "BEARD", "MASSAGE", "WAXING", "OTHER"];
const SPECIALIZATION_LABEL: Record<string, string> = {
  HAIR: "Hair", MAKEUP: "Makeup", NAILS: "Nails", SKIN_CARE: "Skin Care",
  BEARD: "Beard", MASSAGE: "Massage", WAXING: "Waxing", OTHER: "Other",
};

export async function clientLoader(_: ClientLoaderFunctionArgs) {
  const session = getStaffSession()!;
  const [member, countries] = await Promise.all([
    apiFetch<StaffMember>(`${STAFF_PORTAL_API}/${session.staffId}`),
    apiFetch<Country[]>(COUNTRIES_API).catch(() => [] as Country[]),
  ]);
  return { member, countries };
}

// ── Photo picker ──────────────────────────────────────────────────────────────

function PhotoPicker({
  value,
  onChange,
  onFileSelect,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  onFileSelect?: (file: File | null) => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
    onFileSelect?.(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-2 mb-5 pb-5 border-b border-slate-100">
      <div className="relative">
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          className="w-20 h-20 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-matcha-400 hover:bg-matcha-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-matcha-500/20"
          title="Upload photo"
        >
          {value ? (
            <img src={value} alt="Staff photo preview" className="w-full h-full object-cover" />
          ) : (
            <UserCircle className="w-10 h-10 text-slate-300" />
          )}
        </button>

        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          title="Take photo"
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-matcha-600 text-white flex items-center justify-center hover:bg-matcha-700 transition-colors cursor-pointer shadow-sm"
        >
          <Camera className="w-3 h-3" />
        </button>

        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); onFileSelect?.(null); }}
            title="Remove photo"
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer text-xs leading-none shadow-sm"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <button type="button" onClick={() => uploadRef.current?.click()} className="hover:text-matcha-600 transition-colors cursor-pointer">
          Upload photo
        </button>
      </div>

      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Profile() {
  const { member: init, countries } = useLoaderData<typeof clientLoader>();
  const [member, setMember] = useState<StaffMember>(init);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", photo: null as string | null,
    photoFile: null as File | null,
    specializations: [] as string[], availableForBooking: true,
  });
  const { toast, notify } = useToast();

  function openEdit() {
    setForm({
      name: member.name,
      phone: member.phone ?? "",
      photo: member.photoUrl ?? null,
      photoFile: null,
      specializations: [...(member.specializations ?? [])],
      availableForBooking: member.availableForBooking ?? true,
    });
    setEditing(true);
  }

  async function saveProfile() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let photoUrl: string | undefined;

      if (form.photoFile) {
        const upload = await apiFetch<PresignedUpload>(`${STAFF_PORTAL_API}/${member.id}/photo-upload-url`, {
          method: "POST",
          body: JSON.stringify({ contentType: form.photoFile.type }),
        });
        await fetch(upload.presignedUrl, {
          method: "PUT",
          body: form.photoFile,
          headers: { "Content-Type": form.photoFile.type },
        });
        photoUrl = upload.publicUrl;
      }

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        specializations: form.specializations,
        availableForBooking: form.availableForBooking,
      };
      if (photoUrl !== undefined) body.photoUrl = photoUrl;

      const updated = await apiFetch<StaffMember>(`${STAFF_PORTAL_API}/${member.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMember(updated);
      setEditing(false);
      notify("Profile updated.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">My Profile</h1>
        <InfoBar>
          View and update your staff profile. Contact your saloon manager to change your email, role, or status.
        </InfoBar>
      </div>

      <div className="max-w-lg space-y-4">

        {/* ── Staff card ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-100">
            {member.photoUrl ? (
              <img src={member.photoUrl} alt={member.name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200" />
            ) : (
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[member.status] ?? "bg-slate-300"}`} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-900 truncate">{member.name}</span>
                {member.isOwner && (
                  <span className="inline-flex items-center gap-0.5 text-[0.62rem] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide shrink-0">
                    <Crown className="w-2.5 h-2.5" /> Owner
                  </span>
                )}
                <span className="text-[0.62rem] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wide shrink-0">
                  {ROLE_LABEL[member.role] ?? member.role}
                </span>
                <span className="text-[0.62rem] text-slate-400 shrink-0">
                  {STATUS_LABEL[member.status] ?? member.status}
                </span>
                {member.availableForBooking === false && (
                  <span className="inline-flex items-center gap-0.5 text-[0.62rem] text-slate-400 shrink-0">
                    <CalendarOff className="w-2.5 h-2.5" /> Not bookable
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 truncate">
                {member.email}{member.phone ? ` · ${member.phone}` : ""}
              </div>
              {member.specializations && member.specializations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {member.specializations.map((s) => (
                    <span key={s} className="text-[0.6rem] font-semibold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">
                      {SPECIALIZATION_LABEL[s] ?? s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={openEdit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          </div>

          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Email</p>
              <p className="text-sm text-slate-800 break-all">{member.email}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Phone</p>
              <p className="text-sm text-slate-800">{member.phone || <span className="text-slate-300 italic text-xs">Not set</span>}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Role</p>
              <p className="text-sm text-slate-800">{ROLE_LABEL[member.role] ?? member.role}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Status</p>
              <p className="text-sm text-slate-800">{STATUS_LABEL[member.status] ?? member.status}</p>
            </div>
            {member.createdAt && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Member since</p>
                <p className="text-sm text-slate-800">
                  {new Date(member.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
          <strong className="text-slate-600">Want to change your role or email?</strong> These fields are managed by your saloon administrator. Please reach out to them directly.
        </div>
      </div>

      {/* ── Edit modal ── */}
      {editing && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && !saving && setEditing(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">

            {/* Header */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Edit Staff</span>
              <button
                className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo */}
            <PhotoPicker
              value={form.photo}
              onChange={(v) => setForm((p) => ({ ...p, photo: v }))}
              onFileSelect={(f) => setForm((p) => ({ ...p, photoFile: f }))}
            />

            {/* Name */}
            <div className="mb-4">
              <label className={fieldLabel}>Name <span className="text-red-500">*</span></label>
              <input
                className={inputCls}
                autoFocus
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>

            {/* Email (read-only) */}
            <div className="mb-4">
              <label className={fieldLabel}>Email <span className="text-red-500">*</span></label>
              <input className={inputDisabledCls} value={member.email} disabled readOnly />
            </div>

            {/* Phone + Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className={fieldLabel}>Phone</label>
                <PhoneInput
                  value={form.phone}
                  onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                  countries={countries}
                />
              </div>
              <div>
                <label className={fieldLabel}>Role</label>
                <select className={inputDisabledCls} value={member.role} disabled>
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
            </div>

            {/* Specializations */}
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-100">
              Specializations
            </div>
            <div className="mb-4">
              <TileGrid
                options={SPECIALIZATION_OPTIONS}
                labels={SPECIALIZATION_LABEL}
                selected={form.specializations}
                onChange={(specs) => setForm((p) => ({ ...p, specializations: specs }))}
              />
            </div>

            {/* Status (read-only) */}
            <div className="mb-4">
              <label className={fieldLabel}>Status</label>
              <select className={inputDisabledCls} value={member.status} disabled>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            {/* Available for booking toggle */}
            <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
              <div
                className={`relative w-9 h-5 rounded-full transition-colors ${form.availableForBooking ? "bg-matcha-600" : "bg-slate-300"}`}
                onClick={() => setForm((p) => ({ ...p, availableForBooking: !p.availableForBooking }))}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${form.availableForBooking ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Available for booking</p>
                <p className="text-xs text-slate-400">
                  {form.availableForBooking
                    ? "Customers can book appointments with this staff member."
                    : "This staff member will not appear in the booking calendar."}
                </p>
              </div>
            </label>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button
                className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-45"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                disabled={saving || !form.name.trim()}
                onClick={saveProfile}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  );
}
