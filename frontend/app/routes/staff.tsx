import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Pencil, Trash2, X, UserCircle, ChevronRight, Crown, CalendarOff, Clock, Camera, RefreshCw } from "lucide-react";
import { SALOON_ADMIN_API, COUNTRIES_API, apiFetch, resolveSaloonUUID } from "~/lib/api";
import {
  STAFF_ROLES, STAFF_ROLE_LABEL, STAFF_STATUSES, STAFF_STATUS_LABEL,
  CATEGORY_LABEL, SPECIALIZATION_OPTIONS,
} from "~/lib/constants";
import type { Country, LayoutContext, OperatingHours, StaffMember } from "~/lib/types";
import InfoBar from "~/components/InfoBar";
import TileGrid from "~/components/TileGrid";
import PhoneInput from "~/components/PhoneInput";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSaloonUUID(params.saloonId!);
  const [staff, countries] = await Promise.all([
    apiFetch<StaffMember[]>(`${SALOON_ADMIN_API}/${sid}/staff`),
    apiFetch<Country[]>(COUNTRIES_API).catch(() => [] as Country[]),
  ]);
  return { staff, countries };
}

// ── Shared styles ────────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900 font-sans";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

const STATUS_DOT: Record<string, string> = {
  ACTIVE:   "bg-green-500",
  INACTIVE: "bg-slate-300",
  ON_LEAVE: "bg-amber-500",
};

// ── Form field type ──────────────────────────────────────────────────────────

interface StaffFormFields {
  name: string;
  email: string;
  phone: string;
  role: string;
  specializations: string[];
  photo: string | null;
}

// ── Schedule editor ───────────────────────────────────────────────────────────

const ALL_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed",
  THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

interface ScheduleEntry {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

function defaultSchedule(operatingHours?: OperatingHours[]): ScheduleEntry[] {
  return ALL_DAYS.map((d) => {
    const oh = operatingHours?.find((h) => h.day === d);
    if (oh && !oh.closed) {
      return { dayOfWeek: d, startTime: oh.openTime, endTime: oh.closeTime, enabled: true };
    }
    if (operatingHours?.length) {
      // saloon has hours configured but this day is closed/absent — mark off
      return { dayOfWeek: d, startTime: "09:00", endTime: "18:00", enabled: false };
    }
    // no saloon hours at all — fall back to sensible default
    return { dayOfWeek: d, startTime: "09:00", endTime: "18:00", enabled: d !== "SUNDAY" };
  });
}

function ScheduleEditor({
  schedule,
  onChange,
  hint,
}: {
  schedule: ScheduleEntry[];
  onChange: (s: ScheduleEntry[]) => void;
  hint?: string;
}) {
  function update(idx: number, patch: Partial<ScheduleEntry>) {
    onChange(schedule.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  return (
    <div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 pb-2 border-b border-slate-100 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Calendar availability
      </div>
      {hint && (
        <p className="text-[11px] text-matcha-700 bg-matcha-50 border border-matcha-100 rounded-md px-2.5 py-1.5 mb-2.5">
          {hint}
        </p>
      )}
      <div className="space-y-1.5">
        {schedule.map((entry, idx) => (
          <div key={entry.dayOfWeek} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => update(idx, { enabled: !entry.enabled })}
              className={`w-9 h-5 rounded-full transition-colors shrink-0 relative cursor-pointer ${entry.enabled ? "bg-matcha-600" : "bg-slate-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${entry.enabled ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className={`w-8 text-xs font-semibold shrink-0 ${entry.enabled ? "text-slate-700" : "text-slate-300"}`}>
              {DAY_LABEL[entry.dayOfWeek]}
            </span>
            {entry.enabled ? (
              <>
                <input
                  type="time"
                  value={entry.startTime}
                  onChange={(e) => update(idx, { startTime: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md outline-none focus:border-matcha-500 focus:ring-1 focus:ring-matcha-500/10 bg-white text-slate-800"
                />
                <span className="text-xs text-slate-300">–</span>
                <input
                  type="time"
                  value={entry.endTime}
                  onChange={(e) => update(idx, { endTime: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md outline-none focus:border-matcha-500 focus:ring-1 focus:ring-matcha-500/10 bg-white text-slate-800"
                />
              </>
            ) : (
              <span className="text-xs text-slate-300 italic">Day off</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Camera capture modal ──────────────────────────────────────────────────────

function CameraCapture({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady]   = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  function startStream(facingMode: "user" | "environment") {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setReady(false);
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err: DOMException) => {
        const msg =
          err.name === "NotAllowedError"
            ? "Camera access denied — allow camera access in your browser settings and try again."
            : err.name === "NotFoundError"
            ? "No camera found on this device."
            : `Camera error: ${err.message}`;
        setError(msg);
      });
  }

  useEffect(() => {
    startStream(facing);
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function flipCamera() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    startStream(next);
  }

  function capture() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    // Square crop from center
    const side = Math.min(w, h);
    canvas.width  = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d")!;

    if (facing === "user") {
      // Mirror the captured frame so it matches the mirrored preview
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -(w + side) / 2, -(h - side) / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, -(w - side) / 2, -(h - side) / 2, w, h);
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(canvas.toDataURL("image/jpeg", 0.88));
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-xs flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Take a photo</span>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error ? (
          /* Error state */
          <div className="px-6 py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <Camera className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium text-slate-700 cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Live preview — square, mirrored for front camera */}
            <div className="relative bg-black aspect-square overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => setReady(true)}
                className="w-full h-full object-cover"
                style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }}
              />
              {/* Loading spinner until stream is ready */}
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
              {/* Flip camera button (top-right) */}
              <button
                type="button"
                onClick={flipCamera}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer backdrop-blur-sm"
                title="Flip camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {/* Guide circle overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 rounded-full border-2 border-white/30" />
              </div>
            </div>

            {/* Shutter + hint */}
            <div className="flex flex-col items-center gap-2 py-5 bg-slate-50">
              <button
                type="button"
                onClick={capture}
                disabled={!ready}
                title="Capture photo"
                className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 hover:border-matcha-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center"
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 hover:bg-matcha-700 transition-colors" />
              </button>
              <p className="text-[11px] text-slate-400">Click the button to capture</p>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>,
    document.body
  );
}

// ── Photo picker ──────────────────────────────────────────────────────────────

function PhotoPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const uploadRef      = useRef<HTMLInputElement>(null);
  const [showCam, setShowCam] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <>
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

          {/* Camera badge */}
          <button
            type="button"
            onClick={() => setShowCam(true)}
            title="Take photo"
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-matcha-600 text-white flex items-center justify-center hover:bg-matcha-700 transition-colors cursor-pointer shadow-sm"
          >
            <Camera className="w-3 h-3" />
          </button>

          {/* Remove badge */}
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
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
          <span className="text-slate-200">·</span>
          <button type="button" onClick={() => setShowCam(true)} className="hover:text-matcha-600 transition-colors cursor-pointer">
            Take photo
          </button>
        </div>

        <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {showCam && (
        <CameraCapture
          onCapture={(dataUrl) => { onChange(dataUrl); setShowCam(false); }}
          onClose={() => setShowCam(false)}
        />
      )}
    </>
  );
}

// ── Sub-component at module level so React never remounts it on re-render ────

function StaffForm({
  f, setF, countries, defaultCountry,
}: {
  f: StaffFormFields;
  setF: React.Dispatch<React.SetStateAction<StaffFormFields>>;
  countries: Country[];
  defaultCountry?: string;
}) {
  return (
    <>
      <PhotoPicker value={f.photo} onChange={(v) => setF((p) => ({ ...p, photo: v }))} />

      <div className="mb-4">
        <label className={fieldLabel}>Name <span className="text-red-500">*</span></label>
        <input
          className={inputCls}
          placeholder="Full name"
          value={f.name}
          onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
        />
      </div>

      <div className="mb-4">
        <label className={fieldLabel}>Email <span className="text-red-500">*</span></label>
        <input
          className={inputCls}
          type="email"
          placeholder="staff@saloon.com"
          value={f.email}
          onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className={fieldLabel}>Phone</label>
          <PhoneInput
            value={f.phone}
            onChange={(v) => setF((p) => ({ ...p, phone: v }))}
            countries={countries}
            defaultCountry={defaultCountry}
          />
        </div>
        <div>
          <label className={fieldLabel}>Role</label>
          <select
            className={inputCls}
            value={f.role}
            onChange={(e) => setF((p) => ({ ...p, role: e.target.value }))}
          >
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}
          </select>
        </div>
      </div>

      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-100">
        Specializations
      </div>
      <TileGrid
        options={SPECIALIZATION_OPTIONS}
        labels={CATEGORY_LABEL}
        selected={f.specializations}
        onChange={(specs) => setF((p) => ({ ...p, specializations: specs }))}
      />
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Staff() {
  const { saloon } = useOutletContext<LayoutContext>();
  const { staff: init, countries } = useLoaderData<typeof clientLoader>();
  const [staff,  setStaff]  = useState<StaffMember[]>(init);
  const [busy,   setBusy]   = useState(false);
  const [toast,  setToast]  = useState<{ msg: string; type: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [target, setTarget] = useState<StaffMember | null>(null);
  const [modal,  setModal]  = useState({ add: false, edit: false, del: false });

  const sid = saloon.id;

  const blank = (): StaffFormFields => ({ name: "", email: "", phone: "", role: "STYLIST", specializations: [], photo: null });
  const [af, setAf] = useState<StaffFormFields>(blank);
  const [addSchedule, setAddSchedule] = useState<ScheduleEntry[]>(defaultSchedule);
  const [ef, setEf] = useState<StaffFormFields & { status: string; availableForBooking: boolean }>({ ...blank(), status: "ACTIVE", availableForBooking: true });

  function notify(msg: string, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function closeModal(k: keyof typeof modal) { setModal((m) => ({ ...m, [k]: false })); }
  function openAdd() {
    setAf(blank());
    setAddSchedule(defaultSchedule(saloon.operatingHours));
    setModal((m) => ({ ...m, add: true }));
  }

  function openEdit(m: StaffMember) {
    setTarget(m);
    setEf({
      name: m.name, email: m.email, phone: m.phone ?? "",
      role: m.role, status: m.status,
      availableForBooking: m.availableForBooking ?? true,
      specializations: [...(m.specializations ?? [])],
      photo: null,
    });
    setModal((p) => ({ ...p, edit: true }));
  }

  function openDel(m: StaffMember) { setTarget(m); setModal((p) => ({ ...p, del: true })); }

  async function submitAdd() {
    if (!af.name || !af.email) return;
    setBusy(true);
    try {
      const schedule = addSchedule
        .filter((e) => e.enabled)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
      const member = await apiFetch<StaffMember>(`${SALOON_ADMIN_API}/${sid}/staff`, {
        method: "POST",
        body: JSON.stringify({ name: af.name, email: af.email, phone: af.phone, role: af.role, specializations: af.specializations, schedule }),
      });
      setStaff((p) => [member, ...p]);
      closeModal("add");
      notify(`${member.name} onboarded!`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  async function submitEdit() {
    if (!target) return;
    setBusy(true);
    try {
      const updated = await apiFetch<StaffMember>(`${SALOON_ADMIN_API}/${sid}/staff/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: ef.name, email: ef.email, phone: ef.phone, role: ef.role, status: ef.status, availableForBooking: ef.availableForBooking, specializations: ef.specializations }),
      });
      setStaff((p) => p.map((m) => m.id === updated.id ? updated : m));
      closeModal("edit");
      notify(`${updated.name} updated!`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  async function submitDel() {
    if (!target) return;
    setBusy(true);
    try {
      await apiFetch(`${SALOON_ADMIN_API}/${sid}/staff/${target.id}`, { method: "DELETE" });
      const name = target.name;
      setStaff((p) => p.filter((m) => m.id !== target.id));
      closeModal("del");
      notify(`${name} removed.`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Staff</h1>
        <InfoBar>
          Add and manage the people working at your saloon — their roles, contact details, and service specializations.
          Staff members can be assigned to specific services.
        </InfoBar>
      </div>

      {staff.length > 0 && (
        <p className="text-sm text-slate-500 font-medium mb-4">
          {staff.length} staff member{staff.length !== 1 ? "s" : ""}
        </p>
      )}

      {!staff.length ? (
        <div className="text-center py-20 px-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-500 mb-1">No staff yet</h3>
          <p className="text-xs text-slate-400 mb-6">Onboard the first staff member to get started.</p>
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer"
            onClick={openAdd}
          >
            Onboard Staff
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
          {staff.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group">

              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[m.status] ?? "bg-slate-300"}`} />

              {/* Name + role + contact + specializations */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 truncate">{m.name}</span>
                  {m.isOwner && (
                    <span className="inline-flex items-center gap-0.5 text-[0.62rem] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide shrink-0">
                      <Crown className="w-2.5 h-2.5" /> Owner
                    </span>
                  )}
                  <span className="text-[0.62rem] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wide shrink-0">
                    {STAFF_ROLE_LABEL[m.role] ?? m.role}
                  </span>
                  <span className="text-[0.62rem] text-slate-400 shrink-0">
                    {STAFF_STATUS_LABEL[m.status] ?? m.status}
                  </span>
                  {m.availableForBooking === false && (
                    <span className="inline-flex items-center gap-0.5 text-[0.62rem] text-slate-400 shrink-0">
                      <CalendarOff className="w-2.5 h-2.5" /> Not bookable
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  {m.email}{m.phone ? ` · ${m.phone}` : ""}
                </div>
                {m.specializations?.length ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.specializations.map((s) => (
                      <span key={s} className="text-[0.6rem] font-semibold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">
                        {CATEGORY_LABEL[s] ?? s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => openEdit(m)}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                {!m.isOwner && (
                  <button
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 transition-colors cursor-pointer"
                    onClick={() => openDel(m)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Mobile chevron hint */}
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 sm:hidden" />
            </div>
          ))}
          <div className="flex justify-end px-4 py-3 bg-slate-50/60 border-t border-slate-100">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer"
              onClick={openAdd}
            >
              Onboard Staff
            </button>
          </div>
        </div>
      )}

      {/* Add / Onboard modal */}
      {modal.add && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("add")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Onboard Staff</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("add")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <StaffForm f={af} setF={setAf} countries={countries} defaultCountry={saloon.location?.country} />
            <div className="mt-5">
              <ScheduleEditor
                schedule={addSchedule}
                onChange={setAddSchedule}
                hint={
                  saloon.operatingHours?.some((h) => !h.closed)
                    ? "Pre-filled from your saloon's opening hours — adjust per staff member as needed."
                    : undefined
                }
              />
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => closeModal("add")}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                disabled={busy || !af.name || !af.email}
                onClick={submitAdd}
              >
                {busy ? "Saving…" : "Onboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal.edit && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("edit")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Edit Staff</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("edit")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <StaffForm f={ef} setF={setEf as React.Dispatch<React.SetStateAction<StaffFormFields>>} countries={countries} defaultCountry={saloon.location?.country} />
            <div className="mt-4 mb-2">
              <label className={fieldLabel}>Status</label>
              <select
                className={inputCls}
                value={ef.status}
                onChange={(e) => setEf((p) => ({ ...p, status: e.target.value }))}
              >
                {STAFF_STATUSES.map((s) => <option key={s} value={s}>{STAFF_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
              <div
                className={`relative w-9 h-5 rounded-full transition-colors ${ef.availableForBooking ? "bg-matcha-600" : "bg-slate-300"}`}
                onClick={() => setEf((p) => ({ ...p, availableForBooking: !p.availableForBooking }))}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${ef.availableForBooking ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Available for booking</p>
                <p className="text-xs text-slate-400">
                  {ef.availableForBooking
                    ? "Customers can book appointments with this staff member."
                    : "This staff member will not appear in the booking calendar."}
                </p>
              </div>
            </label>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => closeModal("edit")}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                disabled={busy}
                onClick={submitEdit}
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {modal.del && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("del")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Remove Staff</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("del")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Remove <strong className="text-slate-800">{target?.name}</strong> from this saloon?
            </p>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => closeModal("del")}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-red-500 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                disabled={busy}
                onClick={submitDel}
              >
                <Trash2 className="w-3.5 h-3.5" /> {busy ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-sm font-medium text-white shadow-lg z-[1000] animate-[slide-up_0.16s_ease] ${toast.type === "error" ? "bg-red-600" : "bg-matcha-600"}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
