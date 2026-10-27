import { useEffect } from "react";
import { Outlet, redirect, useNavigate } from "react-router";
import { AdminHeader } from "~/components/AdminHeader";
import { getSession, logout, startOAuth2Login, startSilentRenewLoop } from "~/lib/auth";

export function clientLoader() {
  if (!getSession()) throw redirect("/login");
  return null;
}
export default function PeopleLayout() {
  const navigate = useNavigate();
  useEffect(() => startSilentRenewLoop(() => {}, () => startOAuth2Login()), []);
  return <div className="min-h-dvh bg-stone-50"><AdminHeader onSignOut={() => logout(navigate)} />
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><Outlet /></main></div>;
}
