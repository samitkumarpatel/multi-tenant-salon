import { useOutletContext } from "react-router";
import { User, MapPin, Phone, Mail, Globe, Clock, CalendarDays, Zap } from "lucide-react";
import type { LayoutContext } from "~/lib/types";
import { FEATURE_LABEL, DAY_SHORT, formatDate } from "~/lib/constants";

export default function Manage() {
  const { saloon } = useOutletContext<LayoutContext>();

  const openHours = saloon.operatingHours?.filter((h) => !h.closed) ?? [];

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {/* Owner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Owner</span>
        </div>
        <InfoRow label="Name">{saloon.owner?.name}</InfoRow>
        <InfoRow label="Email">{saloon.owner?.email}</InfoRow>
        {saloon.owner?.phone && <InfoRow label="Phone">{saloon.owner.phone}</InfoRow>}
      </div>

      {/* Location */}
      {saloon.location && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Location</span>
          </div>
          {saloon.location.address && <InfoRow label="Address">{saloon.location.address}</InfoRow>}
          {saloon.location.city    && <InfoRow label="City">{saloon.location.city}</InfoRow>}
          {saloon.location.state   && <InfoRow label="State">{saloon.location.state}</InfoRow>}
          {saloon.location.country && <InfoRow label="Country">{saloon.location.country}</InfoRow>}
          {saloon.location.zipCode && <InfoRow label="ZIP">{saloon.location.zipCode}</InfoRow>}
        </div>
      )}

      {/* Contact */}
      {saloon.contact && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Contact</span>
          </div>
          {saloon.contact.phone && (
            <div className="flex gap-3 py-0.5 text-sm items-center">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Phone
              </span>
              <span className="text-slate-700">{saloon.contact.phone}</span>
            </div>
          )}
          {saloon.contact.email && (
            <div className="flex gap-3 py-0.5 text-sm items-center">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Email
              </span>
              <span className="text-slate-700">{saloon.contact.email}</span>
            </div>
          )}
          {saloon.contact.website && (
            <div className="flex gap-3 py-0.5 text-sm items-center">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0 flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Website
              </span>
              <a
                href={saloon.contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-matcha-600 hover:underline truncate"
              >
                {saloon.contact.website}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Features */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <Zap className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Features</span>
        </div>
        {saloon.features?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {saloon.features.map((f) => (
              <span
                key={f}
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wide"
              >
                {FEATURE_LABEL[f] ?? f}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">No features enabled</span>
        )}
      </div>

      {/* Operating Hours */}
      {openHours.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Operating Hours</span>
          </div>
          {openHours.map((h) => (
            <div key={h.day} className="flex gap-3 py-0.5 text-sm">
              <span className="text-xs text-slate-400 min-w-[64px] shrink-0">{DAY_SHORT[h.day] ?? h.day}</span>
              <span className="text-slate-700 font-medium">{h.openTime} – {h.closeTime}</span>
            </div>
          ))}
        </div>
      )}

      {/* Meta */}
      {saloon.createdAt && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Created</span>
          </div>
          <span className="text-sm text-slate-700">{formatDate(saloon.createdAt)}</span>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-0.5 text-sm">
      <span className="text-xs text-slate-400 min-w-[64px] shrink-0 pt-px">{label}</span>
      <span className="text-slate-700">{children}</span>
    </div>
  );
}
