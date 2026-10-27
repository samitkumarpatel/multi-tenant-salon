import { LanguageSelector, useI18n } from "@salon/i18n";
import { AppLogo } from "@salon/ui-shared";
import { LogOut, Menu, X } from "lucide-react";
import { NavLink, useNavigate } from "react-router";

export function AdminHeader({ onSignOut, onToggleMenu, menuOpen = false }: {
  onSignOut?: () => void;
  onToggleMenu?: () => void;
  menuOpen?: boolean;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <>
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-3 sm:px-6">
      {onToggleMenu && (
        <button type="button" onClick={onToggleMenu} aria-label={t("Menu")} aria-expanded={menuOpen}
          aria-controls="salon-navigation"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-matcha-600 md:hidden">
          {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      )}
      <AppLogo size={24} showText={false} onClick={() => navigate("/")} />
      <span className={`min-w-0 truncate text-sm font-semibold text-stone-700 ${onToggleMenu ? "hidden sm:block" : ""}`}>
        {t("Super Admin")}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <LanguageSelector compact />
        {onSignOut && (
          <button type="button" onClick={onSignOut}
            className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-stone-200 px-3 text-xs font-medium text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-matcha-600">
            <LogOut className="size-4" aria-hidden="true" />
            {t("Sign out")}
          </button>
        )}
      </div>
    </header>
    {onSignOut && <nav aria-label={t("Platform navigation")} className="sticky top-12 z-30 flex h-10 items-center gap-1 border-b border-stone-200 bg-white px-3 sm:px-6">
      {[["/", "Salons"], ["/users", "People"]].map(([to, label]) => <NavLink key={to} to={to} end={to === "/"}
        className={({ isActive }) => `rounded-md px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-matcha-600 ${isActive ? "bg-matcha-50 text-matcha-700" : "text-stone-500 hover:bg-stone-100"}`}>{t(label)}</NavLink>)}
    </nav>}
    </>
  );
}
