import { useOutletContext, useLocation, useNavigate } from "react-router";
import { useI18n } from "@salon/i18n";
import { ArrowUp } from "lucide-react";
import {
  FeedbackLink, FeedbackView, RatingsLink, PublicRatingsView, SalonWebsite, GenerativeUIWebsite, BookingWizard, ShopView, MembershipView, LoyaltyView, SalonPolicyLinks, policiesForSurface,
  CustomerAccountView, hasCustomerAccount, siteAccountLinks,
} from "@salon/ui-website";
import type { TenantData } from "./website-shell";
import { navigationSearch } from "../lib/navigation-search";

export default function PublicWebsitePage() {
  const data = useOutletContext<TenantData | undefined>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t: translateUi } = useI18n();

  if (!data) return null;

  const activePage = location.pathname.slice(1) || undefined;
  const search = navigationSearch(location.search);

  if (activePage === "ratings") {
    return <PublicRatingsView salon={data.salon} staff={data.staff} theme={data.theme} policies={data.websitePolicies}
      initialStaffId={new URLSearchParams(location.search).get("staff")}
      getPagePath={(page) => `/${page}${search}`}
      onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)} />;
  }

  if (activePage === "feedback") {
    const query = new URLSearchParams(location.search);
    const source = ["WEBSITE_FOOTER", "WEBSITE_STYLIST"].includes(query.get("source") ?? "") ? query.get("source")! : "PUBLIC_WEBSITE";
    return <FeedbackView key={location.key} salon={data.salon} staff={data.staff} theme={data.theme} enabled={data.feedbackSettings.publicWebsiteEnabled}
      policies={data.websitePolicies} getPagePath={(page) => `/${page}${search}`}
      onNavigate={(page) => navigate(`/${page}${search}`)}
      source={source} initialStaffId={query.get("staff")} onBack={() => navigate(`/${search}`)} />;
  }

  if (data.theme.websiteType === "GENERATIVE_UI") {
    const { theme } = data;

    // When the visitor navigates to /book, show the wizard (same UX as a regular website)
    if (activePage === "book" && data.salon.features?.includes("BOOKING")) {
      return (
        <BookingWizard
          salon={data.salon}
          staff={data.staff}
          services={data.services}
          theme={theme}
          policies={data.bookingPolicies}
          onExit={() => navigate(`/${search}`)}
          getPagePath={(page) => `/${page}${search}`}
        />
      );
    }

    // Same for /shop — the full storefront, themed to match the site
    if (activePage === "shop" && data.salon.features?.includes("WEBSHOP")) {
      return (
        <ShopView
          salon={data.salon}
          theme={theme}
          policies={data.shopPolicies}
          getPagePath={(page) => `/${page}${search}`}
          onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
        />
      );
    }

    // And /membership — the plans, with online sign-up through Stripe
    if (activePage === "membership" && data.salon.features?.includes("MEMBERSHIP")) {
      return (
        <MembershipView
          salon={data.salon}
          theme={theme}
          policies={data.membershipPolicies}
          getPagePath={(page) => `/${page}${search}`}
          onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
        />
      );
    }

    // And /loyalty — how points are earned and what they buy
    if (activePage === "loyalty" && data.salon.features?.includes("LOYALTY_PROGRAM")) {
      return (
        <LoyaltyView
          salon={data.salon}
          theme={theme}
          policies={data.loyaltyPolicies}
          getPagePath={(page) => `/${page}${search}`}
          onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
        />
      );
    }

    // And /account — the customer's bookings, orders and membership
    if (activePage === "account" && hasCustomerAccount(data.salon)) {
      return (
        <CustomerAccountView
          salon={data.salon}
          theme={theme}
          policies={data.websitePolicies}
          getPagePath={(page) => `/${page}${search}`}
          onNavigateSite={(page) => navigate(`/${page}${search}`)}
          onBack={() => navigate(`/${search}`)}
          {...siteAccountLinks(data.salon, (page) => `/${page}${search}`, (page) => navigate(`/${page}${search}`))}
        />
      );
    }

    return (
      <div
        className="flex min-h-[100dvh] flex-col sm:items-center sm:justify-center sm:p-6"
        style={{
          background: `radial-gradient(ellipse 110% 60% at 50% 0%, ${theme.accentColor}20 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 80% 110%, ${theme.accentColor}0c 0%, transparent 50%), ${theme.heroBg ?? "#EEF2F4"}`,
        }}
      >
        <div className="w-full sm:max-w-3xl lg:max-w-5xl 2xl:max-w-7xl h-[100dvh] sm:h-[calc(100dvh-48px)] sm:rounded-2xl sm:overflow-hidden sm:shadow-2xl">
          <GenerativeUIWebsite
            salon={data.salon}
            staff={data.staff}
            services={data.services}
            theme={data.theme}
            getPagePath={(page) => `/${page}${search}`}
            onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
          />
        </div>
        <footer className="w-full px-5 py-4 sm:max-w-3xl lg:max-w-5xl 2xl:max-w-7xl sm:mx-auto">
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
            {data.salon.contact?.phone && <a href={`tel:${data.salon.contact.phone}`} className="hover:underline">{data.salon.contact.phone}</a>}
            {data.salon.contact?.email && <a href={`mailto:${data.salon.contact.email}`} className="hover:underline">{translateUi("Contact us")}</a>}
            <FeedbackLink />
            <RatingsLink />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">© {new Date().getFullYear()} {data.salon.name}</p>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-3">
              <SalonPolicyLinks policies={policiesForSurface(data.websitePolicies, "website")} color="#64748B" salonName={data.salon.name} />
              {hasCustomerAccount(data.salon) && <a href={`/account${search}`} className="text-[11px] font-semibold hover:underline" style={{ color: theme.accentColor }}>{translateUi("My account")}</a>}
              <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:opacity-75">
                {translateUi("Back to top ")}<ArrowUp className="h-3 w-3" />
              </button>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <SalonWebsite
      salon={data.salon}
      staff={data.staff}
      services={data.services}
      theme={data.theme}
      websitePolicies={data.websitePolicies}
      bookingPolicies={data.bookingPolicies}
      membershipPolicies={data.membershipPolicies}
      shopPolicies={data.shopPolicies}
      loyaltyPolicies={data.loyaltyPolicies}
      activePage={activePage}
      getPagePath={(page) => `/${page}${search}`}
      onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
    />
  );
}
