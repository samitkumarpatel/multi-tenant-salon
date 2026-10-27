import { useI18n } from "@salon/i18n";
import { Link, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Crown } from "lucide-react";
import { apiFetch, ADMIN_API } from "~/lib/api";
import type { StaffMember } from "~/lib/types";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const staff = await apiFetch<StaffMember[]>(`${ADMIN_API}/${params.salonId!}/staff`);
  return { staff };
}

const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager", STYLIST: "Stylist", COLORIST: "Colorist", MAKEUP_ARTIST: "Makeup Artist",
  NAIL_TECHNICIAN: "Nail Tech", RECEPTIONIST: "Receptionist", ASSISTANT: "Assistant",
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave" };
const STATUS_DOT: Record<string, string> = { ACTIVE: "bg-emerald-500", INACTIVE: "bg-stone-400", ON_LEAVE: "bg-amber-500" };

export default function SalonStaff() {
  const { t } = useI18n();
  const { staff } = useLoaderData<typeof clientLoader>();

  return <section className="space-y-5">
    <div>
      <h1 className="text-xl font-bold text-stone-900">{t("Staff")}</h1>
      <p className="mt-1 text-sm text-stone-500">{t("Read-only staff details. The salon owner manages team changes in Salon Admin.")}</p>
      <p className="mt-2 text-xs text-stone-400">{t("Team members")}: {staff.length}</p>
    </div>
    {staff.length === 0 ? <p className="py-12 text-center text-sm text-stone-500">{t("No staff members yet.")}</p> :
      <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
        {staff.map((member) => <li key={member.id} className="flex items-start gap-4 p-4">
          {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" /> :
            <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-matcha-50 text-sm font-bold text-matcha-600">
              {member.name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase()}
            </div>}
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-stone-800">{member.name}</h2>{member.isOwner && <Crown aria-label={t("Owner")} className="size-4 text-amber-500" />}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span>{t(ROLE_LABEL[member.role] ?? member.role)}</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`size-1.5 rounded-full ${STATUS_DOT[member.status] ?? "bg-stone-400"}`} />{t(STATUS_LABEL[member.status] ?? member.status)}</span>
              <span>{t(member.availableForBooking !== false ? "Available for booking" : "Not available for booking")}</span>
            </div>
            <dl className="space-y-1 text-stone-600">
              <div><dt className="inline font-medium">{t("Email")}: </dt><dd className="inline break-all">{member.email || "—"}</dd></div>
              <div><dt className="inline font-medium">{t("Phone")}: </dt><dd className="inline">{member.phone || "—"}</dd></div>
              <div><dt className="inline font-medium">{t("Source record")}: </dt><dd className="inline">{member.id}</dd></div>
            </dl>
            {!!member.specializations?.length && <p className="text-xs text-stone-500">{member.specializations.map((value) => t(value.replaceAll("_", " "))).join(" · ")}</p>}
            {member.bio && <p className="whitespace-pre-wrap text-stone-600">{member.bio}</p>}
            {member.createdAt && <p className="text-xs text-stone-400">{t("Created")}: {member.createdAt}</p>}
            {member.email && <Link to={`/users/detail?${new URLSearchParams({ email: member.email })}`} className="inline-block py-1 text-xs font-medium text-matcha-700 underline">{t("View user details")}</Link>}
          </div>
        </li>)}
      </ul>}
  </section>;
}
