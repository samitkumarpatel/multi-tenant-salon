import { redirect } from "react-router";
import { getDashboardSession } from "~/lib/auth";

export async function clientLoader() {
  const session = getDashboardSession();
  const first = session?.salons.find((salon) => salon.features?.includes("DASHBOARD"));
  throw redirect(first ? `/${first.id}` : "/login");
}

export default function Home() { return null; }
