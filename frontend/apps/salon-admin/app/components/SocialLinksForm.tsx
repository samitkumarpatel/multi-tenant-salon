import { useState } from "react";
import { SOCIAL_PLATFORMS } from "@salon/ui-website";
import type { ContactInfo, Salon } from "~/lib/types";
import { ADMIN_API, apiFetch } from "~/lib/api";

// Compact, chrome-less editor for the salon's public social profiles. Rendered inline inside the
// Overview → Social Media card (which supplies its own heading). Saves via the focused
// `PATCH .../contact` endpoint so it can't clobber name/location/hours — phone/email/website are
// carried through untouched.

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900 transition-all placeholder:text-slate-300";

export function SocialLinksForm({ salon, onSaved, onCancel }: {
  salon: Salon;
  onSaved: (s: Salon) => void;
  /** Called after a successful save and when the user cancels — use it to leave edit mode. */
  onCancel: () => void;
}) {
  const [contact, setContact] = useState<ContactInfo>({ ...(salon.contact ?? {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(contact) !== JSON.stringify({ ...(salon.contact ?? {}) });

  function patch(p: Partial<ContactInfo>) {
    setContact((c) => ({ ...c, ...p }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Salon>(`${ADMIN_API}/${salon.id}/contact`, {
        method: "PATCH",
        body: JSON.stringify(contact),
      });
      onSaved(updated);
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save social links");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="space-y-2.5">
        {SOCIAL_PLATFORMS.map((p) => {
          const on = contact[p.visibleKey] === true;
          return (
            <div key={p.key} className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 w-[104px] shrink-0 text-xs font-medium text-slate-600">
                <p.Icon className={`w-4 h-4 shrink-0 ${on ? "text-slate-500" : "text-slate-300"}`} />
                <span className="truncate">{p.label}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Show ${p.label} icon`}
                onClick={() => patch({ [p.visibleKey]: !on } as Partial<ContactInfo>)}
                className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer shrink-0 ${on ? "bg-matcha-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              <input
                className={`${inputCls} min-w-0 ${on ? "" : "opacity-50"}`}
                value={contact[p.urlKey] ?? ""}
                onChange={(e) => patch({ [p.urlKey]: e.target.value } as Partial<ContactInfo>)}
                placeholder={p.placeholder}
                aria-label={`${p.label} URL`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded-xl bg-matcha-600 text-sm font-medium text-white hover:bg-matcha-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
