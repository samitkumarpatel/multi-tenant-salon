import { redirect } from "react-router";
import { getDashboardSession, pickDashboardSalon } from "~/lib/auth";

export async function clientLoader() {
  const session = getDashboardSession();
  const first = session ? pickDashboardSalon(session.salons) : undefined;
  throw redirect(first ? `/${first.id}` : "/login");
}

export default function Home() { return null; }
