import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Pencil, Trash2, X, UserCircle, Crown, CalendarOff, Clock, Camera, RefreshCw, AlertTriangle, Plus, ChevronDown } from "lucide-react";
import { ADMIN_API, COUNTRIES_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import {
  STAFF_ROLES, STAFF_ROLE_LABEL, STAFF_STATUSES, STAFF_STATUS_LABEL,
  CATEGORY_LABEL, SPECIALIZATION_OPTIONS,
} from "~/lib/constants";
import type { Country, LayoutContext, OperatingHours, StaffMember } from "~/lib/types";
import { InfoBar, TileGrid, PhoneInput, Toast, useToast } from "@salon/ui-shared";

const toHHMM = (t: string) => t.slice(0, 5);

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const [staff, countries] = await Promise.all([
    apiFetch<StaffMember[]>(`${ADMIN_API}/${sid}/staff`),
    apiFetch<Country[]>(COUNTRIES_API).catch(() => [] as Country[]),
  ]);
  return { staff, countries };
}

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900 font-sans";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

const STATUS_DOT: Record<string, string> = {
  ACTIVE:   "bg-green-500",
  INACTIVE: "bg-slate-300",
  ON_LEAVE: "bg-amber-500",
};

// ── Onboarding constants ──────────────────────────────────────────────────────

const ROLE_EMOJI: Record<string, string> = {
  MANAGER: "👔", STYLIST: "✂️", COLORIST: "🎨",
  MAKEUP_ARTIST: "💄", NAIL_TECHNICIAN: "💅",
  RECEPTIONIST: "📋", ASSISTANT: "🤝",
};

// ── Form field type ───────────────────────────────────────────────────────────

interface PresignedUpload {
  presignedUrl: string;
  publicUrl: string;
}

interface StaffFormFields {
  name: string;
  email: string;
  phone: string;
  role: string;
  specializations: string[];
  photo: string | null;
  photoFile: File | null;
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
      return { dayOfWeek: d, startTime: "09:00", endTime: "18:00", enabled: false };
    }
    return { dayOfWeek: d, startTime: "09:00", endTime: "18:00", enabled: d !== "SUNDAY" };
  });
}

function ScheduleEditor({
  schedule,
  onChange,
  operatingHours,
  hint,
}: {
  schedule: ScheduleEntry[];
  onChange: (s: ScheduleEntry[]) => void;
  operatingHours?: OperatingHours[];
  hint?: string;
}) {
  const hasConfiguredHours = Boolean(operatingHours?.length);

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
        {schedule.map((entry, idx) => {
          const oh = operatingHours?.find((h) => h.day === entry.dayOfWeek);
          const salonClosed = hasConfiguredHours && (!oh || oh.closed);
          const startErr = entry.enabled && !salonClosed && !!oh && !oh.closed && toHHMM(entry.startTime) < toHHMM(oh.openTime);
          const endErr   = entry.enabled && !salonClosed && !!oh && !oh.closed && toHHMM(entry.endTime)   > toHHMM(oh.closeTime);
          const hasErr   = startErr || endErr;

          return (
            <div key={entry.dayOfWeek} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={salonClosed}
                  onClick={() => !salonClosed && update(idx, { enabled: !entry.enabled })}
                  className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${
                    salonClosed
                      ? "bg-slate-100 cursor-not-allowed"
                      : `cursor-pointer ${entry.enabled ? "bg-matcha-600" : "bg-slate-200"}`
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    entry.enabled && !salonClosed ? "translate-x-4" : "translate-x-0"
                  }`} />
                </button>

                <span className={`w-8 text-xs font-semibold shrink-0 ${
                  salonClosed || !entry.enabled ? "text-slate-300" : "text-slate-700"
                }`}>
                  {DAY_LABEL[entry.dayOfWeek]}
                </span>

                {salonClosed ? (
                  <span className="text-xs text-slate-300 italic">Salon closed</span>
                ) : entry.enabled ? (
                  <>
                    <input
                      type="time"
                      value={entry.startTime}
                      min={oh?.openTime}
                      max={entry.endTime}
                      onChange={(e) => update(idx, { startTime: e.target.value })}
                      className={`flex-1 px-2 py-1 text-xs border rounded-md outline-none focus:ring-1 ${
                        startErr
                          ? "border-amber-300 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-300/20"
                          : "border-slate-200 bg-white text-slate-800 focus:border-matcha-500 focus:ring-matcha-500/10"
                      }`}
                    />
                    <span className="text-xs text-slate-300">–</span>
                    <input
                      type="time"
                      value={entry.endTime}
                      min={entry.startTime}
                      max={oh?.closeTime}
                      onChange={(e) => update(idx, { endTime: e.target.value })}
                      className={`flex-1 px-2 py-1 text-xs border rounded-md outline-none focus:ring-1 ${
                        endErr
                          ? "border-amber-300 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-300/20"
                          : "border-slate-200 bg-white text-slate-800 focus:border-matcha-500 focus:ring-matcha-500/10"
                      }`}
                    />
                  </>
                ) : (
                  <span className="text-xs text-slate-300 italic">Day off</span>
                )}
              </div>

              {hasErr && (
                <p className="flex items-center gap-1 text-[10px] font-medium text-amber-600 pl-[84px]">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Outside salon hours ({oh!.openTime} – {oh!.closeTime})
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Camera capture modal ──────────────────────────────────────────────────────

function CameraCapture({ onCapture, onClose }: { onCapture: (dataUrl: string, file: File) => void; onClose: () => void }) {
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
    const side = Math.min(w, h);
    canvas.width  = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d")!;

    if (facing === "user") {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -(w + side) / 2, -(h - side) / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, -(w - side) / 2, -(h - side) / 2, w, h);
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    onCapture(dataUrl, dataUrlToFile(dataUrl, "photo.jpg", "image/jpeg"));
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-xs flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Take a photo</span>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error ? (
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
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <button
                type="button"
                onClick={flipCamera}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer backdrop-blur-sm"
                title="Flip camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 rounded-full border-2 border-white/30" />
              </div>
            </div>

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

function dataUrlToFile(dataUrl: string, filename: string, type: string): File {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type });
}

function PhotoPicker({
  value,
  onChange,
  onFileSelect,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  onFileSelect?: (file: File | null) => void;
}) {
  const uploadRef      = useRef<HTMLInputElement>(null);
  const [showCam, setShowCam] = useState(false);

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

          <button
            type="button"
            onClick={() => setShowCam(true)}
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
          <span className="text-slate-200">·</span>
          <button type="button" onClick={() => setShowCam(true)} className="hover:text-matcha-600 transition-colors cursor-pointer">
            Take photo
          </button>
        </div>

        <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {showCam && (
        <CameraCapture
          onCapture={(dataUrl, file) => { onChange(dataUrl); onFileSelect?.(file); setShowCam(false); }}
          onClose={() => setShowCam(false)}
        />
      )}
    </>
  );
}

// ── Add / onboarding flow ─────────────────────────────────────────────────────

function AddStaffFlow({
  countries,
  defaultCountry,
  operatingHours,
  onSubmit,
  busy,
}: {
  countries: Country[];
  defaultCountry?: string;
  operatingHours?: OperatingHours[];
  onSubmit: (fields: StaffFormFields, schedule: ScheduleEntry[]) => void;
  busy: boolean;
}) {
  const [f, setF] = useState<StaffFormFields>({
    name: "", email: "", phone: "", role: "STYLIST", specializations: [], photo: null, photoFile: null,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(() => defaultSchedule(operatingHours));

  useEffect(() => { setSchedule(defaultSchedule(operatingHours)); }, [operatingHours]);

  const scheduleHasErrors = schedule.some((entry) => {
    if (!entry.enabled) return false;
    const oh = operatingHours?.find((h) => h.day === entry.dayOfWeek);
    if (!oh || oh.closed) return false;
    return toHHMM(entry.startTime) < toHHMM(oh.openTime) || toHHMM(entry.endTime) > toHHMM(oh.closeTime);
  });

  const canSubmit = Boolean(f.name.trim() && f.email.trim()) && !scheduleHasErrors;

  return (
    <div>
      <div className="mb-5">
        <label className={fieldLabel}>Full name <span className="text-red-500">*</span></label>
        <input
          autoFocus
          className={inputCls}
          placeholder="e.g. Anna Nguyen"
          value={f.name}
          onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
        />
      </div>

      <div className="mb-5">
        <label className={fieldLabel}>Role</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAFF_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setF((p) => ({ ...p, role }))}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-left ${
                f.role === role
                  ? "border-matcha-400 bg-matcha-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-base shrink-0 leading-none">{ROLE_EMOJI[role]}</span>
              <span className={`text-xs font-semibold leading-tight ${f.role === role ? "text-matcha-700" : "text-slate-600"}`}>
                {STAFF_ROLE_LABEL[role]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className={fieldLabel}>Email <span className="text-red-500">*</span></label>
        <input
          className={inputCls}
          type="email"
          placeholder="staff@salon.com"
          value={f.email}
          onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-matcha-600 cursor-pointer transition-colors mb-3"
      >
        {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        {showAdvanced ? "Hide advanced options" : "Phone, specializations & availability"}
      </button>
      {showAdvanced && (
        <div className="mb-4 space-y-4">
          <PhotoPicker value={f.photo} onChange={(v) => setF((p) => ({ ...p, photo: v }))} onFileSelect={(file) => setF((p) => ({ ...p, photoFile: file }))} />
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
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-100">
              Specializations
            </div>
            <TileGrid
              options={SPECIALIZATION_OPTIONS}
              labels={CATEGORY_LABEL}
              selected={f.specializations}
              onChange={(specs) => setF((p) => ({ ...p, specializations: specs }))}
            />
          </div>
          <ScheduleEditor
            schedule={schedule}
            onChange={setSchedule}
            operatingHours={operatingHours}
            hint={
              operatingHours?.some((h) => !h.closed)
                ? "Pre-filled from your salon's opening hours. Times are capped to salon operating hours."
                : undefined
            }
          />
        </div>
      )}

      <button
        type="button"
        disabled={!canSubmit || busy}
        title={scheduleHasErrors ? "Fix schedule hours before saving" : undefined}
        onClick={() => onSubmit(f, schedule)}
        className="w-full py-2.5 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        {busy ? "Adding…" : "Add Team Member →"}
      </button>
    </div>
  );
}

// ── Edit form (full fields, photo, schedule not editable here) ────────────────

function StaffForm({ f, setF, countries, defaultCountry }: {
  f: StaffFormFields;
  setF: React.Dispatch<React.SetStateAction<StaffFormFields>>;
  countries: Country[];
  defaultCountry?: string;
}) {
  return (
    <>
      <PhotoPicker value={f.photo} onChange={(v) => setF((p) => ({ ...p, photo: v }))} onFileSelect={(file) => setF((p) => ({ ...p, photoFile: file }))} />

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
          placeholder="staff@salon.com"
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

// ── Main component ────────────────────────────────────────────────────────────

export default function Staff() {
  const { salon } = useOutletContext<LayoutContext>();
  const { staff: init, countries } = useLoaderData<typeof clientLoader>();
  const [staff,  setStaff]  = useState<StaffMember[]>(init);
  const [busy,   setBusy]   = useState(false);
  const { toast, notify } = useToast();
  const [target, setTarget] = useState<StaffMember | null>(null);
  const [modal,  setModal]  = useState({ add: false, edit: false, del: false });

  const sid = salon.id;
  const hasBooking = salon.features?.includes("BOOKING") ?? false;
  const [alertDismissed, setAlertDismissed] = useState(
    () => Boolean(localStorage.getItem(`setup-alert-dismissed:staff:${salon.id}`))
  );

  const blank = (): StaffFormFields => ({ name: "", email: "", phone: "", role: "STYLIST", specializations: [], photo: null, photoFile: null });
  const [ef, setEf] = useState<StaffFormFields & { status: string; availableForBooking: boolean }>({ ...blank(), status: "ACTIVE", availableForBooking: true });

  function closeModal(k: keyof typeof modal) { setModal((m) => ({ ...m, [k]: false })); }
  function openAdd() { setModal((m) => ({ ...m, add: true })); }

  function openEdit(m: StaffMember) {
    setTarget(m);
    setEf({
      name: m.name, email: m.email, phone: m.phone ?? "",
      role: m.role, status: m.status,
      availableForBooking: m.availableForBooking ?? true,
      specializations: [...(m.specializations ?? [])],
      photo: m.photoUrl ?? null,
      photoFile: null,
    });
    setModal((p) => ({ ...p, edit: true }));
  }

  function openDel(m: StaffMember) { setTarget(m); setModal((p) => ({ ...p, del: true })); }

  async function submitAdd(fields: StaffFormFields, schedule: ScheduleEntry[]) {
    if (!fields.name || !fields.email) return;
    setBusy(true);
    try {
      const sched = schedule
        .filter((e) => e.enabled)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
      let member = await apiFetch<StaffMember>(`${ADMIN_API}/${sid}/staff`, {
        method: "POST",
        body: JSON.stringify({ name: fields.name, email: fields.email, phone: fields.phone, role: fields.role, specializations: fields.specializations, schedule: sched }),
      });
      if (fields.photoFile) {
        const upload = await apiFetch<PresignedUpload>(`${ADMIN_API}/${sid}/staff/${member.id}/photo-upload-url`, {
          method: "POST",
          body: JSON.stringify({ contentType: fields.photoFile.type }),
        });
        await fetch(upload.presignedUrl, {
          method: "PUT",
          body: fields.photoFile,
          headers: { "Content-Type": fields.photoFile.type },
        });
        member = await apiFetch<StaffMember>(`${ADMIN_API}/${sid}/staff/${member.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: member.name, email: member.email, phone: member.phone, role: member.role, status: member.status, availableForBooking: member.availableForBooking, specializations: member.specializations, photoUrl: upload.publicUrl }),
        });
      }
      setStaff((p) => [member, ...p]);
      closeModal("add");
      notify(`${member.name} added!`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  async function submitEdit() {
    if (!target) return;
    setBusy(true);
    try {
      let photoUrl: string | null = ef.photo?.startsWith("data:") ? null : (ef.photo ?? null);
      if (ef.photoFile) {
        const upload = await apiFetch<PresignedUpload>(`${ADMIN_API}/${sid}/staff/${target.id}/photo-upload-url`, {
          method: "POST",
          body: JSON.stringify({ contentType: ef.photoFile.type }),
        });
        await fetch(upload.presignedUrl, {
          method: "PUT",
          body: ef.photoFile,
          headers: { "Content-Type": ef.photoFile.type },
        });
        photoUrl = upload.publicUrl;
      }
      const updated = await apiFetch<StaffMember>(`${ADMIN_API}/${sid}/staff/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: ef.name, email: ef.email, phone: ef.phone, role: ef.role, status: ef.status, availableForBooking: ef.availableForBooking, specializations: ef.specializations, photoUrl }),
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
      await apiFetch(`${ADMIN_API}/${sid}/staff/${target.id}`, { method: "DELETE" });
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
          Add and manage the people working at your salon — their roles, contact details, and service specializations.
          Staff members can be assigned to specific services.
        </InfoBar>
      </div>

      {/* ── Setup alert (booking enabled, insufficient staff, not dismissed) */}
      {staff.length <= 1 && hasBooking && !alertDismissed && (
        <div className="mb-4 flex items-center gap-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className="flex-1 leading-snug">
            {staff.length === 0
              ? "Add a team member — booking needs someone to assign appointments to."
              : "Add at least one more team member so appointments can be assigned to your staff."}
          </span>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(`setup-alert-dismissed:staff:${salon.id}`, "1");
              setAlertDismissed(true);
            }}
            className="shrink-0 text-amber-400 hover:text-amber-700 transition-colors cursor-pointer"
            title="Ignore"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Empty state: inline onboarding ──────────────────────────────── */}
      {!staff.length ? (
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                <UserCircle className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Who's on your team?</h2>
                <p className="text-xs text-slate-500 mt-0.5">Add the first team member to get started.</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <AddStaffFlow
                countries={countries}
                defaultCountry={salon.location?.country}
                operatingHours={salon.operatingHours}
                onSubmit={submitAdd}
                busy={busy}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500 font-medium mb-4">
            {staff.length} staff member{staff.length !== 1 ? "s" : ""}
          </p>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
            {staff.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group">

                {m.photoUrl ? (
                  <img src={m.photoUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-slate-500">
                      {m.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  </div>
                )}

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

                <div className="shrink-0 flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(m)}
                  >
                    <Pencil className="w-3 h-3" /> <span className="hidden sm:inline">Edit</span>
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
              </div>
            ))}
            <div className="flex justify-end px-4 py-3 bg-slate-50/60 border-t border-slate-100">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer"
                onClick={openAdd}
              >
                Add Team Member
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Add modal (same flow) ────────────────────────────────────────── */}
      {modal.add && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("add")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Add Team Member</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("add")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <AddStaffFlow
              countries={countries}
              defaultCountry={salon.location?.country}
              operatingHours={salon.operatingHours}
              onSubmit={submitAdd}
              busy={busy}
            />
          </div>
        </div>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
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
            <StaffForm f={ef} setF={setEf as React.Dispatch<React.SetStateAction<StaffFormFields>>} countries={countries} defaultCountry={salon.location?.country} />
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

      {/* ── Delete modal ─────────────────────────────────────────────────── */}
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
              Remove <strong className="text-slate-800">{target?.name}</strong> from this salon?
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

      <Toast toast={toast} />
    </>
  );
}
