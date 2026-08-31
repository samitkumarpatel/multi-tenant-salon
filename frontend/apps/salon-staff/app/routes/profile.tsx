import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { Pencil, X, Crown, CalendarOff, UserCircle, Camera, RefreshCw, Images } from "lucide-react";
import { STAFF_PORTAL_API, COUNTRIES_API, apiFetch, uploadToPresignedUrl } from "~/lib/api";
import { getStaffSession } from "~/lib/auth";
import { WorkMedia } from "~/lib/media";
import { InfoBar, PhoneInput, TileGrid, Toast, useToast } from "@salon/ui-shared";
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

// ── Camera helpers ────────────────────────────────────────────────────────────

function dataUrlToFile(dataUrl: string, filename: string, type: string): File {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type });
}

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
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium text-slate-700 cursor-pointer transition-colors">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="relative bg-black aspect-square overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted onCanPlay={() => setReady(true)}
                className="w-full h-full object-cover"
                style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }}
              />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <button type="button" onClick={flipCamera}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer backdrop-blur-sm"
                title="Flip camera">
                <RefreshCw className="w-4 h-4" />
              </button>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 rounded-full border-2 border-white/30" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 py-5 bg-slate-50">
              <button type="button" onClick={capture} disabled={!ready} title="Capture photo"
                className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 hover:border-matcha-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center">
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
  const [showCamera, setShowCamera] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
    onFileSelect?.(file);
    e.target.value = "";
  }

  function handleCapture(dataUrl: string, file: File) {
    onChange(dataUrl);
    onFileSelect?.(file);
    setShowCamera(false);
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
          onClick={() => setShowCamera(true)}
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

      {showCamera && (
        <CameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} />
      )}
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
    bio: "",
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
      bio: member.bio ?? "",
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
        await uploadToPresignedUrl(upload.presignedUrl, form.photoFile);
        photoUrl = upload.publicUrl;
      }

      // Work-gallery media is managed on its own page (/portal/media) — leaving
      // photoUrls out of this PATCH keeps it untouched server-side.
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        specializations: form.specializations,
        availableForBooking: form.availableForBooking,
        bio: form.bio.trim() || null,
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
          View and update your staff profile. Contact your salon manager to change your email, role, or status.
        </InfoBar>
      </div>

      <div className="max-w-lg space-y-4">

        {/* ── Staff card ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-100">
            {member.photoUrl ? (
              <img src={member.photoUrl} alt={member.name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200" />
            ) : (
              <UserCircle className="w-10 h-10 text-slate-300 shrink-0" />
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

          {(member.bio || (member.photoUrls?.length ?? 0) > 0) && (
            <div className="px-5 pb-4 pt-1 border-t border-slate-100 space-y-3">
              {member.bio && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">About me</p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{member.bio}</p>
                </div>
              )}
              {(member.photoUrls?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">My work</p>
                    <Link
                      to="/portal/media"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-matcha-600 hover:underline"
                    >
                      <Images className="w-3 h-3" /> Manage
                    </Link>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {member.photoUrls!.map((url) => (
                      <WorkMedia key={url} url={url} className="h-24 w-32 shrink-0 object-cover rounded-lg border border-slate-200" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
          <strong className="text-slate-600">Want to change your role or email?</strong> These fields are managed by your salon administrator. Please reach out to them directly.
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

            {/* About me */}
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-100">
              About me
            </div>
            <div className="mb-4">
              <label className={fieldLabel}>About me</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={form.bio}
                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                placeholder="A short introduction shown on the salon website…"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Manage your work photos &amp; videos on the{" "}
                <Link to="/portal/media" className="text-matcha-600 font-medium hover:underline">
                  My Media
                </Link>{" "}
                page.
              </p>
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
