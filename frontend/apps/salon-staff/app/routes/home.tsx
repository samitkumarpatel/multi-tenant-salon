import { redirect } from "react-router";
import { getStaffSession } from "~/lib/auth";

export function clientLoader() {
  const session = getStaffSession();
  if (session) throw redirect("/portal");
  throw redirect("/login");
}

export default function Home() {
  return null;
}
