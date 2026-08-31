import { useRef, useState } from "react";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { ImagePlus, X, Film, Loader2 } from "lucide-react";
import { InfoBar, Toast, useToast } from "@salon/ui-shared";
import { STAFF_PORTAL_API, apiFetch } from "~/lib/api";
import { getStaffSession } from "~/lib/auth";
import { WorkMedia, isVideoUrl, uploadWorkFile } from "~/lib/media";
import type { StaffMember } from "~/lib/types";

const MAX_ITEMS = 12;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // client-side guard; the local-dev media endpoint caps at 5 MB

export async function clientLoader(_: ClientLoaderFunctionArgs) {
  const session = getStaffSession()!;
  const member = await apiFetch<StaffMember>(`${STAFF_PORTAL_API}/${session.staffId}`);
  return { member };
}

export default function Media() {
  const { member: init } = useLoaderData<typeof clientLoader>();
  const [member, setMember] = useState<StaffMember>(init);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast, notify } = useToast();

  const media = member.workMedia ?? [];
  const slotsLeft = MAX_ITEMS - media.length;

  /** Persists a new workMedia list and syncs local state. */
  async function persist(nextUrls: string[]) {
    const updated = await apiFetch<StaffMember>(`${STAFF_PORTAL_API}/${member.id}/profile`, {
      method: "PATCH",
      body: JSON.stringify({ workMedia: nextUrls }),
    });
    setMember(updated);
    return updated;
  }

  async function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;

    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      notify(`"${tooBig.name}" is over 25 MB.`, "error");
      return;
    }
    if (picked.length > slotsLeft) {
      notify(`You can add ${slotsLeft} more item${slotsLeft === 1 ? "" : "s"} (max ${MAX_ITEMS}).`, "error");
      return;
    }

    setBusy(true);
    setPending(picked.length);
    try {
      const uploaded: string[] = [];
      for (const file of picked) {
        uploaded.push(await uploadWorkFile(member.id, file));
        setPending((n) => n - 1);
      }
      await persist([...media, ...uploaded]);
      notify(`${uploaded.length} item${uploaded.length === 1 ? "" : "s"} added.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setBusy(false);
      setPending(0);
    }
  }

  async function remove(url: string) {
    setBusy(true);
    try {
      await persist(media.filter((u) => u !== url));
      notify("Item removed.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not remove item", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">My Work Media (photo or video)</h1>
        <InfoBar>
          Photos and short videos of your work. These appear on your salon&rsquo;s public website and
          booking page. Changes are saved automatically.
        </InfoBar>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Work gallery</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {media.length} of {MAX_ITEMS} · images or short videos
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy || slotsLeft <= 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              Add media
            </button>
          </div>

          {media.length === 0 && pending === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 flex flex-col items-center gap-2 text-slate-400 hover:border-matcha-400 hover:bg-matcha-50 hover:text-matcha-500 transition-colors cursor-pointer disabled:opacity-45"
            >
              <Film className="w-8 h-8" />
              <span className="text-sm font-medium">Add your first photo or video</span>
              <span className="text-xs">JPG, PNG, WebP, MP4, WebM · up to 25 MB each</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {media.map((url) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                  <WorkMedia url={url} className="w-full h-full object-cover" />
                  {isVideoUrl(url) && (
                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/55 text-white text-[10px] font-medium">
                      <Film className="w-2.5 h-2.5" /> Video
                    </span>
                  )}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => remove(url)}
                    disabled={busy}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer shadow-sm disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {Array.from({ length: pending }).map((_, i) => (
                <div
                  key={`pending-${i}`}
                  className="aspect-square rounded-lg border-2 border-dashed border-matcha-300 bg-matcha-50 flex items-center justify-center"
                >
                  <Loader2 className="w-6 h-6 text-matcha-500 animate-spin" />
                </div>
              ))}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={addFiles}
          />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
          Your avatar is set on the <strong className="text-slate-600">My Profile</strong> page. This
          page is only for your work gallery.
        </div>
      </div>

      <Toast toast={toast} />
    </>
  );
}
