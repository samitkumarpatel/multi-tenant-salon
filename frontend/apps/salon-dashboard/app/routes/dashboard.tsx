import { useI18n } from "@salon/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { redirect, useLoaderData, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs, ShouldRevalidateFunctionArgs } from "react-router";
import {
  CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard,
  Maximize2, Minimize2, Minus, Pencil, Plus, Receipt, ShoppingCart, Trash2, TriangleAlert, UserRound, X, XCircle,
  Search,
} from "lucide-react";
import {
  BookingPaymentLinkDialog, BookingPaymentLinkHistory, PaymentFollowUps, latestLinkByBooking,
  noShowFeeFor, Toast, useToast, type BookingFeePolicy, type BookingPaymentLink, type PaymentFollowUp,
} from "@salon/ui-shared";
import { ADMIN_API, CUSTOMER_API, apiFetch } from "~/lib/api";
import { getDashboardSession } from "~/lib/auth";
import { formatPrice } from "~/lib/format";
import { DaySheet } from "~/components/DaySheet";
import { ColorPopover, StaffCalendar } from "~/components/StaffCalendar";
import {
  JS_DAYS, addDays, hasBookableServiceAtTime, isSalonOpenAt, isTimeInPast, localDateKey, nextDateKey, parseDate, prettyDate,
  restrictionFor, staffColorMap, withAlpha, type StaffScheduleData,
} from "~/lib/calendar";
import { MembershipDesk, type MembershipDeskView } from "~/components/MembershipDesk";
import { LoyaltyDesk } from "~/components/LoyaltyDesk";
import { BookingSearch } from "~/components/BookingSearch";
import { TerminalPaymentDialog, loadTerminals, type Terminal, type TerminalPayment } from "~/components/TerminalPaymentDialog";
import type {
  AvailableSlot, Booking, Country, OperatingHours, Salon, SalonClosure, SalonHoliday, ServiceItem, StaffAvailability,
  StaffAvailabilityOverride, StaffMember,
} from "@salon/ui-website";
import { CustomerDetailsFields, StripeCheckoutPanel, beginCheckout, type CheckoutInstructions, type CheckoutResult, type ContactMethod } from "@salon/ui-website";

type DashboardView = "appointments" | "cashier" | "membership" | "loyalty";
type CashierView = "pos" | "invoices" | "report";

interface DashboardSettings {
  salonId: string;
  bookingManagementEnabled: boolean;
  cashierEnabled: boolean;
}

interface CashierItem {
  sourceType: "SERVICE" | "PRODUCT" | "BOOKING";
  sourceId: number;
  name: string;
  detail?: string | null;
  price: number;
  currency: string;
  availableQuantity?: number | null;
}

interface PosSale {
  id: number;
  saleNumber: string;
  customerName?: string | null;
  paymentMethod: "CASH" | "CARD" | "OTHER";
  total: number;
  currency: string;
  createdAt: string;
  paymentStatus?: "PENDING" | "PAID" | "FAILED";
  paymentReference?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  refundedAmount?: number | null;
}
interface PaymentSetup {
  stripe: {
    account: { chargesEnabled: boolean } | null;
    testMode: boolean;
    settings: { areas: { area: string; enabled: boolean; checkoutUi: string }[] };
  };
}

/** What the operator should read a sale as — a pending or failed card sale must not look paid. */
function saleStatus(sale: PosSale): { label: string; tone: string } | null {
  if (sale.voidedAt) return { label: sale.refundedAmount ? "Voided · refunded" : "Voided", tone: "border-slate-200 bg-slate-100 text-slate-500" };
  if (sale.paymentStatus === "PENDING") return { label: "Awaiting payment", tone: "border-amber-200 bg-amber-50 text-amber-700" };
  if (sale.paymentStatus === "FAILED") return { label: "Failed", tone: "border-red-200 bg-red-50 text-red-700" };
  return null;
}

/** The area takes card payments: switched on by the owner, and Stripe can charge the account. */
function cardArea(setup: PaymentSetup | null, area: "POS" | "MEMBERSHIP") {
  return Boolean(setup?.stripe.account?.chargesEnabled && setup.stripe.settings.areas?.some((a) => a.area === area && a.enabled));
}

interface CartLine extends CashierItem { quantity: number }

// View switches are search-param-only and render from data already in memory;
// re-running this loader (15+ requests) on each click made every link feel slow.
export function shouldRevalidate({ currentParams, nextParams }: ShouldRevalidateFunctionArgs) {
  return currentParams.salonId !== nextParams.salonId;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  if (!getDashboardSession()) throw redirect(`/login?salon=${encodeURIComponent(params.salonId!)}`);
  const sid = params.salonId!;
  // Settings are requested alongside the salon (not after it) to save a round trip.
  const settingsRequest = apiFetch<DashboardSettings>(`${ADMIN_API}/${sid}/dashboard/settings`)
    .then((value) => ({ value, error: null }), (error: unknown) => ({ value: null, error }));
  const [salon, settingsResult] = await Promise.all([apiFetch<Salon>(`${ADMIN_API}/${sid}`), settingsRequest]);
  if (!salon.features?.includes("DASHBOARD")) throw new Response("Dashboard is not enabled for this salon", { status: 403 });
  if (!settingsResult.value) throw settingsResult.error;
  const settings = settingsResult.value;
  const bookingEnabled = settings.bookingManagementEnabled && salon.features?.includes("BOOKING");
  const membershipEnabled = Boolean(salon.features?.includes("MEMBERSHIP"));
  const [bookings, staff, services, closures, holidays, cashierItems, sales, payableBookings, countries, paymentSetup, terminals] = await Promise.all([
    bookingEnabled ? apiFetch<Booking[]>(`${ADMIN_API}/${sid}/booking`).catch((): Booking[] => []) : Promise.resolve([]),
    bookingEnabled ? apiFetch<StaffMember[]>(`${ADMIN_API}/${sid}/staff`).catch((): StaffMember[] => []) : Promise.resolve([]),
    bookingEnabled ? apiFetch<ServiceItem[]>(`${ADMIN_API}/${sid}/services`).catch((): ServiceItem[] => []) : Promise.resolve([]),
    bookingEnabled ? apiFetch<SalonClosure[]>(`${ADMIN_API}/${sid}/closures`).catch((): SalonClosure[] => []) : Promise.resolve([]),
    bookingEnabled ? apiFetch<SalonHoliday[]>(`${ADMIN_API}/${sid}/holidays`).catch((): SalonHoliday[] => []) : Promise.resolve([]),
    settings.cashierEnabled
      ? apiFetch<CashierItem[]>(`${ADMIN_API}/${sid}/dashboard/cashier/items`).catch((): CashierItem[] => [])
      : Promise.resolve([] as CashierItem[]),
    settings.cashierEnabled ? apiFetch<PosSale[]>(`${ADMIN_API}/${sid}/dashboard/sales`).catch((): PosSale[] => []) : Promise.resolve([]),
    // Appointments booked online that the customer still has to pay for when they arrive.
    settings.cashierEnabled
      ? apiFetch<CashierItem[]>(`${ADMIN_API}/${sid}/dashboard/cashier/bookings`).catch((): CashierItem[] => [])
      : Promise.resolve([] as CashierItem[]),
    bookingEnabled ? apiFetch<Country[]>(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"}/api/salon-utility/countries`).catch((): Country[] => []) : Promise.resolve([] as Country[]),
    settings.cashierEnabled || membershipEnabled ? apiFetch<PaymentSetup>(`${ADMIN_API}/${sid}/payments/stripe`).catch((): null => null) : Promise.resolve(null),
    settings.cashierEnabled || membershipEnabled ? loadTerminals(sid) : Promise.resolve([] as Terminal[]),
  ]);
  const schedules = bookingEnabled ? (await Promise.all(staff.map(async (member) => {
    const [availability, overrides] = await Promise.all([
      apiFetch<StaffAvailability[]>(`${ADMIN_API}/${sid}/staff/${member.id}/availability`).catch((): StaffAvailability[] => []),
      apiFetch<StaffAvailabilityOverride[]>(`${ADMIN_API}/${sid}/staff/${member.id}/availability/overrides`).catch((): StaffAvailabilityOverride[] => []),
    ]);
    return { staffId: member.id, availability, overrides };
  }))) : [];
  return { sid, salon, settings, bookings, staff, services, closures, holidays, schedules, cashierItems, sales, payableBookings, countries, paymentSetup, terminals };
}

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

export default function DashboardPage() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const initial = useLoaderData<typeof clientLoader>();
  const salon = initial.salon;
  const [params, setParams] = useSearchParams();
  const { toast, notify } = useToast();
  const appointmentEnabled = initial.settings.bookingManagementEnabled && initial.salon.features?.includes("BOOKING");
  const requestedView = params.get("view");
  const requestedCashierView = params.get("cashierView");
  const cashierView: CashierView = requestedCashierView === "invoices" ? "invoices" : requestedCashierView === "report" ? "report" : "pos";
  const invoicePeriod = params.get("invoicePeriod") ?? "all";
  const [invoicePicker, setInvoicePicker] = useState<"month" | "range" | null>(null);
  const paymentReturn = params.get("payment");
  const returnedSessionId = params.get("session_id");
  const appointmentsView = params.get("appointmentsView");
  const todayView = params.get("todayView") === "stylist" ? "stylist" : "day";
  const membershipEnabled = Boolean(initial.salon.features?.includes("MEMBERSHIP"));
  const membershipView: MembershipDeskView = params.get("membershipView") === "sell" ? "sell" : "check-in";
  const loyaltyEnabled = Boolean(initial.salon.features?.includes("LOYALTY_PROGRAM"));
  const view: DashboardView = requestedView === "cashier" && initial.settings.cashierEnabled
    ? "cashier"
    : requestedView === "membership" && membershipEnabled ? "membership"
    : requestedView === "loyalty" && loyaltyEnabled ? "loyalty"
    : appointmentEnabled ? "appointments"
    : !initial.settings.cashierEnabled && !membershipEnabled && loyaltyEnabled ? "loyalty"
    : initial.settings.cashierEnabled || !membershipEnabled ? "cashier" : "membership";

  const [settings] = useState(initial.settings);
  const cardPaymentEnabled = cardArea(initial.paymentSetup, "POS");
  const membershipCardEnabled = cardArea(initial.paymentSetup, "MEMBERSHIP");
  const testMode = Boolean(initial.paymentSetup?.stripe.testMode);
  const terminals = initial.terminals;
  // Card payments go to a reader by default when the salon has one; "online" is Stripe's card form/checkout.
  const [cardVia, setCardVia] = useState<number | "online">(initial.terminals[0]?.id ?? "online");
  const [readerPayment, setReaderPayment] = useState<{ saleId: number; payment: TerminalPayment } | null>(null);
  const [inlineCheckout, setInlineCheckout] = useState<CheckoutInstructions | null>(null);
  const [bookings, setBookings] = useState(initial.bookings);
  const [cashierItems, setCashierItems] = useState(initial.cashierItems);
  // Appointments are kept in their own list so settling one can remove it without touching the catalogue.
  const [payableBookings, setPayableBookings] = useState(initial.payableBookings);
  const [cashierSearch, setCashierSearch] = useState("");
  const [cashierFilter, setCashierFilter] = useState<"ALL" | "BOOKING" | "SERVICE" | "PRODUCT">("ALL");
  const [sales, setSales] = useState(initial.sales);
  useEffect(() => {
    if (view !== "cashier") return;
    if (paymentReturn === "cancel") {
      // Backing out of Stripe lands back on an empty till. Without saying so, the operator can't tell
      // "the customer changed their mind" from "it went wrong", and the unpaid sale sits unexplained.
      setPaymentNotice({ tone: "warn", text: "The card payment wasn't completed, so the customer has not been charged. The sale is still listed as awaiting payment in Recent sales — void it, or take the payment again." });
      void apiFetch<PosSale[]>(`${ADMIN_API}/${initial.sid}/dashboard/sales`).then(setSales).catch(() => {});
      return;
    }
    if (paymentReturn !== "success") return;
    let stopped = false;
    let attempts = 0;
    const poll = async () => {
      try {
        const refreshed = await apiFetch<PosSale[]>(`${ADMIN_API}/${initial.sid}/dashboard/sales`);
        if (stopped) return;
        setSales(refreshed);
        if (refreshed.some((sale) => sale.paymentReference === returnedSessionId && sale.paymentStatus !== "PENDING")) {
          setPaymentNotice(null);
          window.clearInterval(timer);
          return;
        }
      } catch { /* Keep the current sale list if a refresh fails. */ }
      attempts += 1;
      if (attempts >= 8) {
        window.clearInterval(timer);
        // Giving up silently left a card sale that looks identical to a paid one. Say it's unconfirmed.
        if (!stopped) setPaymentNotice({ tone: "info", text: "Still waiting for the card payment to be confirmed. It can take a minute — check Recent sales before handing anything over." });
      }
    };
    const timer = window.setInterval(() => { void poll(); }, 1500);
    void poll();
    return () => { stopped = true; window.clearInterval(timer); };
  }, [paymentReturn, returnedSessionId, initial.sid, view]);
  const [cart, setCart] = useState<CartLine[]>([]);
  // One key per distinct cart. If a reply is lost (salon wifi, the 55s client abort) and the operator
  // taps again with the cart unchanged, the server hands back the sale it already made instead of
  // ringing it up — and charging for it — twice. Any edit to the cart makes it a different cart.
  const [cartKey, setCartKey] = useState(() => crypto.randomUUID());
  // Payment and stock errors live inside the sale panel until dismissed: a 3.5s toast is easy to
  // miss at a busy counter, and a missed "payment failed" is the one error that costs money.
  const [saleError, setSaleError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{ tone: "warn" | "info"; text: string } | null>(null);
  const [voiding, setVoiding] = useState<PosSale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PosSale["paymentMethod"]>("CASH");
  const [customerName, setCustomerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [newDefaults, setNewDefaults] = useState<{ date: string; time?: string; serviceId?: number; staffId?: number } | null>(null);
  const [servicePickerTime, setServicePickerTime] = useState<{ date: string; time: string; staffId?: number } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [paymentLinkTarget, setPaymentLinkTarget] = useState<Booking | null>(null);
  const [paymentLinkFee, setPaymentLinkFee] = useState(0);
  // The latest payment link of every appointment that has one: the follow-up list and the status in the appointment dialog.
  const [followUps, setFollowUps] = useState<PaymentFollowUp[] | null>(null);
  const [followUpsError, setFollowUpsError] = useState<string | null>(null);
  const bookingManagement = initial.settings.bookingManagementEnabled;
  const loadFollowUps = useCallback(async () => {
    if (!bookingManagement) return;
    try {
      setFollowUps(await apiFetch<PaymentFollowUp[]>(`${ADMIN_API}/${initial.sid}/booking/payment-links?status=ALL&limit=200`) ?? []);
      setFollowUpsError(null);
    } catch (e) {
      setFollowUps((current) => current ?? []);
      setFollowUpsError(e instanceof Error ? e.message : "Could not load payment links.");
    }
  }, [initial.sid, bookingManagement]);
  useEffect(() => { void loadFollowUps(); }, [loadFollowUps]);
  const paymentLinksValue = useMemo(() => ({
    latest: latestLinkByBooking(followUps),
    loadHistory: async (bookingId: number) => (await apiFetch<BookingPaymentLink[]>(`${ADMIN_API}/${initial.sid}/booking/${bookingId}/payment-links`)) ?? [],
    resend: async (bookingId: number, linkId: number) => {
      const sent = await apiFetch<BookingPaymentLink>(`${ADMIN_API}/${initial.sid}/booking/${bookingId}/payment-links/${linkId}/resend`, { method: "POST" });
      void loadFollowUps();
      return sent;
    },
  }), [followUps, initial.sid, loadFollowUps]);

  /** "New payment link" from the follow-up list: the appointment may not be in the loaded range, so fetch it if needed. */
  async function newLinkFor(item: PaymentFollowUp) {
    try {
      const booking = bookings.find((b) => b.id === item.link.bookingId)
        ?? await apiFetch<Booking>(`${ADMIN_API}/${initial.sid}/booking/${item.link.bookingId}`);
      await openPaymentLink(booking);
    } catch (e) { notify(e instanceof Error ? e.message : "Could not open the appointment", "error"); }
  }

  /** A no-show is billed the salon's no-show fee, so look it up before the dialog opens with its default amount. */
  async function openPaymentLink(booking: Booking) {
    let fee = 0;
    if (booking.status === "NO_SHOW") {
      const policy = await apiFetch<BookingFeePolicy>(`${CUSTOMER_API}/${initial.sid}/booking-fee-policy`).catch(() => null);
      fee = noShowFeeFor(policy, initial.services.find((item) => item.id === booking.serviceId)?.price);
    }
    setPaymentLinkFee(fee);
    setPaymentLinkTarget(booking);
  }

  async function createPaymentLink(booking: Booking, body: { amount?: number; sendEmail: boolean }) {
    const result = await apiFetch<{ booking: Booking; paymentUrl: string; amount: number; currency: string; emailed: boolean }>(
      `${ADMIN_API}/${initial.sid}/booking/${booking.id}/payment-link`, { method: "POST", body: JSON.stringify(body) });
    setBookings((current) => current.map((item) => item.id === booking.id ? result.booking : item));
    setSelectedBooking((current) => current?.id === booking.id ? result.booking : current);
    void loadFollowUps();
    return result;
  }

  const [staffColors, setStaffColors] = useState<Record<number, string | null>>({});

  /** Drag-and-drop on the calendar: the same reschedule the edit dialog makes, so the server re-checks the slot. */
  async function moveBooking(booking: Booking, target: { date: string; startTime: string; staffId: number }) {
    const updated = await apiFetch<Booking>(`${ADMIN_API}/${initial.sid}/booking/${booking.id}`, {
      method: "PUT",
      body: JSON.stringify({ appointmentDate: target.date, startTime: target.startTime, staffId: target.staffId, notes: booking.notes ?? null }),
    });
    setBookings((current) => current.map((item) => item.id === booking.id ? updated : item));
    notify("Appointment moved.");
  }

  async function changeStaffColor(staffId: number, color: string | null) {
    const previous = staffColors[staffId];
    setStaffColors((current) => ({ ...current, [staffId]: color }));
    try {
      await apiFetch<StaffMember>(`${ADMIN_API}/${initial.sid}/staff/${staffId}/calendar-color`, { method: "PUT", body: JSON.stringify({ color }) });
    } catch (error) {
      setStaffColors((current) => ({ ...current, [staffId]: previous }));
      notify(error instanceof Error ? error.message : "Could not change the colour", "error");
    }
  }

  async function updateBooking(id: number, action: "confirm" | "cancel" | "complete" | "no-show") {
    try {
      const updated = await apiFetch<Booking>(`${ADMIN_API}/${initial.sid}/booking/${id}/${action}`, { method: "POST" });
      setBookings((current) => current.map((booking) => booking.id === id ? updated : booking));
      setSelectedBooking(updated);
      const labels = { confirm: "confirmed", cancel: "cancelled", complete: "completed", "no-show": "marked as no-show" } as const;
      notify(`Appointment ${labels[action]}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update appointment", "error");
    }
  }

  function addToCart(item: CashierItem) {
    setSaleError(null);
    setCartKey(crypto.randomUUID());
    setCart((current) => {
      const existing = current.find((line) => line.sourceType === item.sourceType && line.sourceId === item.sourceId);
      if (existing) {
        // availableQuantity is the stock for a product and 1 for an appointment (paid for once).
        if (item.availableQuantity != null && existing.quantity >= item.availableQuantity) {
          notify(item.sourceType === "BOOKING"
            ? "An appointment is paid for once."
            : `Only ${item.availableQuantity} of ${item.name} in stock.`, "error");
          return current;
        }
        return current.map((line) => line === existing ? { ...line, quantity: line.quantity + 1 } : line);
      }
      if (current.length && current[0].currency !== item.currency) {
        notify("Items with different currencies cannot share one sale.", "error");
        return current;
      }
      return [...current, { ...item, quantity: 1 }];
    });
  }

  function removeLine(line: CartLine) {
    setCartKey(crypto.randomUUID());
    setCart((current) => current.filter((item) => !(item.sourceType === line.sourceType && item.sourceId === line.sourceId)));
  }

  function clearSale() {
    setCartKey(crypto.randomUUID());
    setSaleError(null);
    setCart([]);
  }

  function changeQuantity(line: CartLine, delta: number) {
    if (delta > 0 && line.availableQuantity != null && line.quantity >= line.availableQuantity) {
      notify(line.sourceType === "BOOKING" ? "An appointment is paid for once." : `Only ${line.availableQuantity} of ${line.name} in stock.`, "error");
      return;
    }
    setCartKey(crypto.randomUUID());
    setCart((current) => current
      .map((item) => item.sourceType === line.sourceType && item.sourceId === line.sourceId
        ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  // An empty cart still shows a total; use the salon's own currency rather than a hardcoded dollar.
  const cartCurrency = cart[0]?.currency ?? cashierItems[0]?.currency ?? payableBookings[0]?.currency ?? "USD";
  const visibleCashierItems = useMemo(() => {
    const query = cashierSearch.trim().toLocaleLowerCase();
    // Appointments first: a customer standing at the counter is the reason the operator is here.
    return [...payableBookings, ...cashierItems].filter((item) => (cashierFilter === "ALL" || item.sourceType === cashierFilter)
      && (!query || `${item.name} ${item.detail ?? ""}`.toLocaleLowerCase().includes(query)));
  }, [payableBookings, cashierItems, cashierFilter, cashierSearch]);

  const visibleSales = useMemo(() => {
    const now = new Date();
    const today = localDateKey(now);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStart = localDateKey(startOfWeek);
    const selectedMonth = params.get("invoiceMonth") ?? today.slice(0, 7);
    const from = params.get("invoiceFrom") ?? "";
    const to = params.get("invoiceTo") ?? "";
    return sales.filter((sale) => {
      const date = localDateKey(new Date(sale.createdAt));
      if (invoicePeriod === "today") return date === today;
      if (invoicePeriod === "week") return date >= weekStart && date <= today;
      if (invoicePeriod === "month") return date.slice(0, 7) === selectedMonth;
      if (invoicePeriod === "range") return (!from || date >= from) && (!to || date <= to);
      return true;
    });
  }, [sales, invoicePeriod, params]);

  function selectInvoicePeriod(period: "all" | "today" | "week" | "month" | "range") {
    const next = new URLSearchParams(params);
    const samePeriod = next.get("invoicePeriod") === period;
    next.set("view", "cashier");
    next.set("cashierView", "invoices");
    next.set("invoicePeriod", period);
    if (!samePeriod || period !== "month") next.delete("invoiceMonth");
    if (!samePeriod || period !== "range") {
      next.delete("invoiceFrom");
      next.delete("invoiceTo");
    }
    setParams(next);
  }

  async function completeSale() {
    if (!cart.length) return;
    setSaving(true);
    try {
      const onReader = paymentMethod === "CARD" && cardVia !== "online";
      const endpoint = paymentMethod !== "CARD" ? "" : onReader ? "/terminal-checkout" : "/card-checkout";
      const response = await apiFetch<PosSale | ({ sale: PosSale } & CheckoutResult) | { sale: PosSale; terminalPayment: TerminalPayment }>(
        `${ADMIN_API}/${initial.sid}/dashboard/sales${endpoint}`, {
        method: "POST",
        body: JSON.stringify({
          customerName: customerName.trim() || null,
          paymentMethod,
          items: cart.map(({ sourceType, sourceId, quantity }) => ({ sourceType, sourceId, quantity })),
          inlineCheckout: true,
          terminalId: onReader ? cardVia : null,
          idempotencyKey: cartKey,
        }),
      });
      const sale = "sale" in response ? response.sale : response;
      setSales((current) => [sale, ...current]);
      // Any appointment on this sale is now spoken for — drop it so it can't be rung up twice while
      // a card payment is still settling. A refused sale leaves the list untouched.
      const settled = new Set(cart.filter((line) => line.sourceType === "BOOKING").map((line) => line.sourceId));
      if (settled.size) setPayableBookings((current) => current.filter((item) => !settled.has(item.sourceId)));
      setCart([]);
      setCartKey(crypto.randomUUID());
      setSaleError(null);
      setCustomerName("");
      void refreshCatalogue();
      if ("terminalPayment" in response) {
        setReaderPayment({ saleId: sale.id, payment: response.terminalPayment });
        return;
      }
      if ("sale" in response) {
        const inline = beginCheckout(response);
        if (inline) setInlineCheckout(inline);
        return;
      }
      notify(`Sale ${sale.saleNumber} completed.`);
    } catch (error) {
      // The cart and its key are deliberately left alone: if the sale did go through and only the
      // reply was lost, tapping again replays it rather than charging a second time.
      setSaleError(error instanceof Error ? error.message : "Could not complete sale");
    } finally {
      setSaving(false);
    }
  }

  /** The catalogue is loaded once per visit, so a tablet left open all day would show yesterday's stock. */
  async function refreshCatalogue() {
    const [items, payable] = await Promise.all([
      apiFetch<CashierItem[]>(`${ADMIN_API}/${initial.sid}/dashboard/cashier/items`).catch(() => null),
      apiFetch<CashierItem[]>(`${ADMIN_API}/${initial.sid}/dashboard/cashier/bookings`).catch(() => null),
    ]);
    if (items) setCashierItems(items);
    if (payable) setPayableBookings(payable);
  }

  async function confirmVoid() {
    if (!voiding) return;
    setSaving(true);
    try {
      const updated = await apiFetch<PosSale>(`${ADMIN_API}/${initial.sid}/dashboard/sales/${voiding.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: voidReason.trim() || null }),
      });
      setSales((current) => current.map((sale) => sale.id === updated.id ? updated : sale));
      notify(`Sale ${updated.saleNumber} voided.`);
      setVoiding(null);
      setVoidReason("");
      void refreshCatalogue();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not void sale", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{view === "loyalty" ? translateUi("Loyalty") : view === "membership" ? membershipView === "sell" ? translateUi("Sell membership") : translateUi("Member check-in") : view === "cashier" ? cashierView === "invoices" ? translateUi("Invoices") : cashierView === "report" ? translateUi("End of day") : translateUi("Till / POS") : appointmentsView === "new" ? translateUi("Book appointment") : appointmentsView === "payments" ? translateUi("Payment follow-ups") : translateUi("Overview")}</h1>
            <p className="mt-1 text-sm text-slate-500">{view === "loyalty" ? translateUi("Hand over a reward or check a customer's points.") : view === "membership" ? membershipView === "sell" ? translateUi("Sign a customer up to a membership plan at the till.") : translateUi("Verify a member's QR code or member code.") : view === "cashier" ? cashierView === "invoices" ? translateUi("Review sales recorded through Till / POS.") : cashierView === "report" ? translateUi("What was taken today, how, and by whom — to count the drawer against.") : translateUi("Build an in-salon sale from services and products.") : appointmentsView === "new" ? translateUi("Choose an available time to start a booking.") : appointmentsView === "payments" ? translateUi("Payment links you have sent: see what is unpaid, resend or copy a link, or send a new one.") : translateUi("Appointments for the selected date.")}</p>
          </div>
          {view === "appointments" && appointmentsView !== "new" && appointmentsView !== "payments" && <button type="button" onClick={() => { const next = new URLSearchParams(params); next.set("view", "appointments"); next.set("appointmentsView", "new"); setParams(next); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-matcha-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-matcha-800 focus:outline-none focus:ring-2 focus:ring-matcha-500 focus:ring-offset-2">{translateUi("Book")}</button>}
        </div>
      </div>

      {!appointmentEnabled && !settings.cashierEnabled && !membershipEnabled && !loyaltyEnabled && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <h2 className="text-sm font-semibold text-slate-800">{translateUi("This salon desk is not available yet")}</h2>
          <p className="mt-1 text-xs text-slate-400">{translateUi("Ask the salon manager to enable appointments or cashier.")}</p>
        </div>
      )}

      {view === "appointments" && settings.bookingManagementEnabled && (
        // Keyed by salon so a search never carries over when the desk switches salon. Opening a result uses the same
        // dialog as the calendar, so it can be confirmed, completed, cancelled, edited or charged from here.
        <BookingSearch key={initial.sid} salonId={initial.sid} bookings={bookings} staff={initial.staff} services={initial.services}
          onOpen={setSelectedBooking}
          onGoToDate={(date) => { const next = new URLSearchParams(params); next.set("view", "appointments"); next.set("date", date); next.delete("appointmentsView"); setParams(next); }} />
      )}

      {view === "appointments" && appointmentsView !== "new" && appointmentsView !== "payments" && settings.bookingManagementEnabled && (
        <TodayAppointmentsReadOnly colors={staffColorMap(initial.staff, staffColors)} colorOverrides={staffColors} onColorChange={changeStaffColor} bookings={bookings} staff={initial.staff} services={initial.services} operatingHours={salon.operatingHours}
          date={params.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("date")!) ? params.get("date")! : localDateKey()} mode={todayView}
          onDateChange={(date) => { const next = new URLSearchParams(params); next.set("date", date); setParams(next); }}
          onModeChange={(mode) => { const next = new URLSearchParams(params); next.set("todayView", mode); setParams(next); }} />
      )}

      {view === "appointments" && appointmentsView === "payments" && settings.bookingManagementEnabled && (
        <PaymentFollowUps items={followUps} error={followUpsError} onRefresh={() => void loadFollowUps()}
          onResend={(item) => paymentLinksValue.resend(item.link.bookingId, item.link.id)} onNew={(item) => void newLinkFor(item)} />
      )}

      {view === "appointments" && appointmentsView === "new" && settings.bookingManagementEnabled && (
        <StaffCalendar bookings={bookings} staff={initial.staff} services={initial.services}
          operatingHours={salon.operatingHours} closures={initial.closures} holidays={initial.holidays}
          schedules={initial.schedules}
          bookingAdvanceDays={salon.bookingAdvanceDays}
          colorOverrides={staffColors}
          searchParams={params} setSearchParams={setParams}
          onNew={(date, time, staffId) => setServicePickerTime({ date, time: time ?? "09:00", staffId })} onSelect={setSelectedBooking}
          onMove={moveBooking} onColorChange={changeStaffColor} />
      )}

      {view === "cashier" && cashierView === "report" && settings.cashierEnabled && <DaySheet sid={initial.sid} />}

      {view === "cashier" && cashierView === "invoices" && settings.cashierEnabled && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap gap-1" role="group" aria-label={translateUi("Filter invoices by date")}>
              {([ ["all", "All"], ["today", "Today"], ["week", "This week"], ["month", "Month"], ["range", "Date"]] as const).map(([key, label]) => <div key={key} className="relative">
                <button type="button" onClick={() => {
                  if (key === "month" || key === "range") {
                    selectInvoicePeriod(key);
                    setInvoicePicker((current) => current === key ? null : key);
                  } else {
                    selectInvoicePeriod(key);
                    setInvoicePicker(null);
                  }
                }} aria-pressed={invoicePeriod === key} aria-expanded={(key === "month" || key === "range") && invoicePicker === key} className={`cursor-pointer rounded-md px-3 py-2 text-xs font-semibold transition-colors ${invoicePeriod === key ? "bg-matcha-100 text-matcha-900" : "text-slate-500 hover:bg-slate-50"}`}>{translateUi(label)}</button>
                {key === "month" && invoicePicker === "month" && <div role="dialog" aria-label={translateUi("Choose invoice month")} className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <label className="block text-xs font-medium text-slate-600">{translateUi("Choose month")}<input type="month" value={params.get("invoiceMonth") ?? localDateKey().slice(0, 7)} onChange={(event) => { const next = new URLSearchParams(params); next.set("invoiceMonth", event.target.value); setParams(next); }} className="mt-2 w-full cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700" /></label>
                  <button type="button" onClick={() => setInvoicePicker(null)} className="mt-3 w-full cursor-pointer rounded-lg bg-matcha-700 px-3 py-2 text-xs font-semibold text-white hover:bg-matcha-800">{translateUi("Done")}</button>
                </div>}
                {key === "range" && invoicePicker === "range" && <div role="dialog" aria-label={translateUi("Choose invoice date range")} className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-slate-600">{translateUi("From")}<input type="date" value={params.get("invoiceFrom") ?? ""} onChange={(event) => { const next = new URLSearchParams(params); const from = event.target.value; if (from) next.set("invoiceFrom", from); else next.delete("invoiceFrom"); const to = next.get("invoiceTo"); if (to && from && to <= from) next.delete("invoiceTo"); setParams(next); }} className="mt-1 w-full cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700" /></label>
                    <label className="block text-xs font-medium text-slate-600">{translateUi("To")}<input type="date" min={params.get("invoiceFrom") ? nextDateKey(params.get("invoiceFrom")!) : undefined} value={params.get("invoiceTo") ?? ""} onChange={(event) => { const next = new URLSearchParams(params); const to = event.target.value; if (to) next.set("invoiceTo", to); else next.delete("invoiceTo"); setParams(next); }} className="mt-1 w-full cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700" /></label>
                  </div>
                  <button type="button" onClick={() => setInvoicePicker(null)} className="mt-3 w-full cursor-pointer rounded-lg bg-matcha-700 px-3 py-2 text-xs font-semibold text-white hover:bg-matcha-800">{translateUi("Done")}</button>
                </div>}
              </div>)}
            </div>
          </div>
          {visibleSales.length ? <div className="divide-y divide-slate-100">
            {visibleSales.map((sale) => <div key={sale.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
              <Receipt className="h-4 w-4 text-slate-400" />
              <span className="font-mono font-semibold text-slate-700">{sale.saleNumber}</span>
              <span className="min-w-0 flex-1 truncate text-slate-500">{sale.customerName || "Walk-in customer"}</span>
              <span className="text-slate-400">{new Intl.DateTimeFormat(uiLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.createdAt))}</span>
              <span className="capitalize text-slate-500">{sale.paymentMethod.toLowerCase()}{sale.paymentStatus === "PENDING" ? translateUi(" · awaiting payment") : sale.paymentStatus === "FAILED" ? translateUi(" · failed") : ""}</span>
              <span className="font-semibold text-slate-800">{formatPrice(sale.total, sale.currency, uiLocale)}</span>
            </div>)}
          </div> : <p className="px-4 py-12 text-center text-sm text-slate-400">{translateUi("No invoices found for this period.")}</p>}
        </section>
      )}

      {view === "cashier" && cashierView === "pos" && settings.cashierEnabled && (
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_320px]">
          {paymentNotice && (
            <div role="status" aria-live="polite"
              className={`md:col-span-2 order-0 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs ${paymentNotice.tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1">{translateUi(paymentNotice.text)}</p>
              <button type="button" onClick={() => setPaymentNotice(null)} aria-label={translateUi("Dismiss")} className="shrink-0 cursor-pointer p-1"><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="order-2 flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white md:order-1 md:h-[calc(100dvh-10rem)]">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">{translateUi("Appointments, services and products")}</h2>
              <p className="mt-0.5 text-xs text-slate-400">{translateUi("Today\u2019s unpaid appointments appear first, so a customer who booked online can pay on arrival.")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="relative min-w-[180px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="search" value={cashierSearch} onChange={(event) => setCashierSearch(event.target.value)} placeholder={translateUi("Search appointments, services and products")} aria-label={translateUi("Search appointments, services and products")} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-matcha-500" />
                </label>
                <div className="flex flex-wrap rounded-lg bg-slate-100 p-1" role="group" aria-label={translateUi("Filter cashier items")}>
                  {([ ["ALL", "All"], ["BOOKING", "Appointments"], ["SERVICE", "Services"], ["PRODUCT", "Products"] ] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setCashierFilter(key)} aria-pressed={cashierFilter === key} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${cashierFilter === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{translateUi(label)}</button>)}
                </div>
              </div>
            </div>
            <div className="grid max-h-[38dvh] gap-2 overflow-y-auto p-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 md:min-h-0 md:max-h-none md:flex-1 md:content-start">
              {visibleCashierItems.map((item) => (
                <button key={`${item.sourceType}-${item.sourceId}`} type="button" onClick={() => addToCart(item)}
                  className="group flex min-h-[64px] items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-matcha-300 hover:bg-matcha-50 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 focus-visible:ring-offset-1 cursor-pointer">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-matcha-100 group-hover:text-matcha-700">
                    {item.sourceType === "PRODUCT" ? <ShoppingCart className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700">{item.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">{item.detail || (item.sourceType === "SERVICE" ? "Service" : item.sourceType === "BOOKING" ? translateUi("Appointment") : "Product")}
                      {item.sourceType === "PRODUCT" && item.availableQuantity != null && (
                        <span className={item.availableQuantity <= 3 ? " font-semibold text-amber-600" : ""}> · {translateUi("{count} left", { count: item.availableQuantity })}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">{formatPrice(item.price, item.currency, uiLocale)}</span>
                    {(() => {
                      const quantity = cart.find((line) => line.sourceType === item.sourceType && line.sourceId === item.sourceId)?.quantity ?? 0;
                      return <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold transition-colors ${quantity ? "bg-matcha-100 text-matcha-800" : "bg-slate-100 text-slate-500 group-hover:bg-matcha-600 group-hover:text-white"}`} aria-label={quantity ? `${quantity} in current sale` : translateUi("Add to current sale")}>{quantity || <Plus className="h-3 w-3" />}</span>;
                    })()}
                  </div>
                </button>
              ))}
              {!cashierItems.length ? <p className="p-4 text-sm text-slate-400">{translateUi("No appointments, services or products are available.")}</p>
                : !visibleCashierItems.length && <p className="p-4 text-sm text-slate-400">{translateUi("No items match your search.")}</p>}
            </div>
          </div>

          <div className="order-1 sticky top-20 z-20 h-fit max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white md:order-2">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Receipt className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">{translateUi("Current sale")}</h2>
              {cart.length > 0 && (
                <button type="button" onClick={clearSale} className="ml-auto cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                  {translateUi("Clear sale")}
                </button>
              )}
            </div>
            <div className="space-y-3 p-4">
              {!cart.length ? <p className="py-4 text-center text-xs text-slate-400">{translateUi("Select a service or product to begin.")}</p> : cart.map((line) => (
                <div key={`${line.sourceType}-${line.sourceId}`} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700">{line.name}</p>
                    <p className="text-[11px] text-slate-400">{formatPrice(line.price, line.currency, uiLocale)} {translateUi("each")}</p>
                  </div>
                  <button onClick={() => changeQuantity(line, -1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:bg-slate-200 cursor-pointer" aria-label={`Remove one ${line.name}`}><Minus className="h-4 w-4" /></button>
                  <span className="w-6 text-center text-sm font-semibold" aria-live="polite">{line.quantity}</span>
                  <button onClick={() => changeQuantity(line, 1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:bg-slate-200 cursor-pointer" aria-label={`Add one ${line.name}`}><Plus className="h-4 w-4" /></button>
                  <button onClick={() => removeLine(line)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100 cursor-pointer" aria-label={`Remove ${line.name} from the sale`}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3">
                <div className="mb-3 flex justify-between text-sm font-bold text-slate-800">
                  <span>{translateUi("Total")}</span><span>{formatPrice(cartTotal, cartCurrency, uiLocale)}</span>
                </div>
                <input className={`${inputCls} mb-2`} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={translateUi("Customer name (optional)")} />
                <select className={`${inputCls} mb-3`} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PosSale["paymentMethod"])}>
                  <option value="CASH">{translateUi("Cash")}</option><option value="CARD" disabled={!cardPaymentEnabled}>{translateUi("Card")}{cardPaymentEnabled ? translateUi(" · Stripe") : translateUi(" · connect Stripe in Admin")}</option><option value="OTHER">{translateUi("Other")}</option>
                </select>
                {paymentMethod === "CARD" && terminals.length > 0 && (
                  <select className={`${inputCls} mb-3`} aria-label={translateUi("Take the card payment on")} value={String(cardVia)}
                    onChange={(event) => setCardVia(event.target.value === "online" ? "online" : Number(event.target.value))}>
                    {terminals.map((reader) => <option key={reader.id} value={reader.id}>{translateUi("Card reader")}: {reader.label}{reader.status === "offline" ? ` · ${translateUi("offline")}` : ""}</option>)}
                    <option value="online">{translateUi("Card form on this screen")}</option>
                  </select>
                )}
                {saleError && (
                  <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p className="flex-1">{saleError}</p>
                    <button type="button" onClick={() => setSaleError(null)} aria-label={translateUi("Dismiss")} className="shrink-0 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <button type="button" disabled={!cart.length || saving} onClick={completeSale}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-matcha-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-40 cursor-pointer">
                  <CreditCard className="h-4 w-4" /> {saving ? translateUi("Processing…") : paymentMethod === "CARD" ? translateUi("Continue to card payment") : translateUi("Record payment")}
                </button>
              </div>
            </div>
          </div>

          {sales.length > 0 && (
            <div className="order-3 rounded-xl border border-slate-200 bg-white md:col-span-2">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">{translateUi("Recent sales")}</div>
              <div className="divide-y divide-slate-100">
                {sales.slice(0, 8).map((sale) => {
                  const status = saleStatus(sale);
                  return (
                    <div key={sale.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 text-xs ${sale.voidedAt ? "opacity-60" : ""}`}>
                      <span className={`font-mono font-semibold text-slate-600 ${sale.voidedAt ? "line-through" : ""}`}>{sale.saleNumber}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-400">{sale.customerName || "Walk-in customer"} · {sale.paymentMethod.toLowerCase()}</span>
                      {status && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.tone}`}>{translateUi(status.label)}</span>}
                      <span className={`font-semibold text-slate-700 ${sale.voidedAt ? "line-through" : ""}`}>{formatPrice(sale.total, sale.currency, uiLocale)}</span>
                      {!sale.voidedAt && sale.paymentStatus !== "PENDING" && (
                        <button type="button" onClick={() => { setVoiding(sale); setVoidReason(""); }}
                          className="min-h-9 cursor-pointer rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                          {translateUi("Void")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {view === "loyalty" && <LoyaltyDesk sid={initial.sid} notify={notify} />}

      {view === "membership" && (
        <MembershipDesk sid={initial.sid} view={membershipView} cardEnabled={membershipCardEnabled} notify={notify}
          terminals={terminals} testMode={testMode} />
      )}

      {inlineCheckout && <StripeCheckoutPanel checkout={inlineCheckout} title={translateUi("Card payment")} />}
      {readerPayment && (
        <TerminalPaymentDialog sid={initial.sid} payment={readerPayment.payment} terminals={terminals} testMode={testMode}
          onFinished={(done) => {
            setSales((current) => current.map((sale) => sale.id === readerPayment.saleId
              ? { ...sale, paymentStatus: done.status === "SUCCEEDED" ? "PAID" : "FAILED" } : sale));
            notify(done.status === "SUCCEEDED" ? translateUi("Card payment received.") : translateUi("Card payment was not completed."),
              done.status === "SUCCEEDED" ? "success" : "error");
          }}
          onClose={() => setReaderPayment(null)} />
      )}

      {voiding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={(e) => e.target === e.currentTarget && !saving && setVoiding(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="void-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="void-title" className="text-base font-bold text-slate-900">{translateUi("Void sale {number}?", { number: voiding.saleNumber })}</h2>
            <p className="mt-2 text-xs text-slate-500">
              {voiding.paymentMethod === "CARD" && voiding.paymentStatus === "PAID"
                ? translateUi("Products go back in stock, and the card payment of {amount} is refunded to the customer.", { amount: formatPrice(voiding.total, voiding.currency, uiLocale) })
                : translateUi("Products go back in stock. Hand the {amount} back to the customer — this records that you did.", { amount: formatPrice(voiding.total, voiding.currency, uiLocale) })}
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600" htmlFor="void-reason">{translateUi("Reason (optional)")}</label>
            <input id="void-reason" className={`${inputCls} mt-1`} value={voidReason} maxLength={200} autoFocus
              onChange={(event) => setVoidReason(event.target.value)} placeholder={translateUi("e.g. Rang up the wrong customer")} />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setVoiding(null)}
                className="min-h-10 cursor-pointer rounded-lg border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50">{translateUi("Keep sale")}</button>
              <button type="button" disabled={saving} onClick={confirmVoid}
                className="min-h-10 cursor-pointer rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
                {saving ? translateUi("Voiding…") : translateUi("Void sale")}
              </button>
            </div>
          </div>
        </div>
      )}

      {servicePickerTime && <AvailableServicePicker sid={initial.sid} date={servicePickerTime.date} time={servicePickerTime.time} staffId={servicePickerTime.staffId} services={initial.services} staff={initial.staff}
        onClose={() => setServicePickerTime(null)} onSelect={(serviceId) => { setNewDefaults({ ...servicePickerTime, serviceId }); setServicePickerTime(null); }} />}
      {newDefaults && <AppointmentEditor sid={initial.sid} staff={initial.staff} services={initial.services} countries={initial.countries} defaultCountry={salon.location?.country} defaultDate={newDefaults.date} defaultTime={newDefaults.time} defaultServiceId={newDefaults.serviceId} defaultStaffId={newDefaults.staffId}
        operatingHours={salon.operatingHours} closures={initial.closures} holidays={initial.holidays} schedules={initial.schedules}
        bookingAdvanceDays={salon.bookingAdvanceDays}
        onClose={() => setNewDefaults(null)} onSaved={(booking) => { setBookings((current) => [...current, booking]); setNewDefaults(null); notify("Appointment created."); }} />}
      {selectedBooking && <BookingActions booking={selectedBooking} staff={initial.staff} services={initial.services} paymentLinks={paymentLinksValue}
        onClose={() => setSelectedBooking(null)}
        onEdit={() => { setEditTarget(selectedBooking); setSelectedBooking(null); }}
        onRequestPayment={() => { void openPaymentLink(selectedBooking); setSelectedBooking(null); }}
        onAction={updateBooking} />}
      {paymentLinkTarget && (() => {
        const service = initial.services.find((item) => item.id === paymentLinkTarget.serviceId);
        return <BookingPaymentLinkDialog customerName={paymentLinkTarget.customerName} customerEmail={paymentLinkTarget.customerEmail}
          defaultAmount={paymentLinkFee > 0 ? paymentLinkFee : service?.price} currency={service?.currency}
          amountHint={paymentLinkFee > 0 ? translateUi("Your no-show fee for this service.") : undefined}
          onCreate={(body) => createPaymentLink(paymentLinkTarget, body)} onClose={() => setPaymentLinkTarget(null)} />;
      })()}
      {editTarget && <AppointmentEditor sid={initial.sid} staff={initial.staff} services={initial.services} countries={initial.countries} defaultCountry={salon.location?.country} booking={editTarget}
        operatingHours={salon.operatingHours} closures={initial.closures} holidays={initial.holidays} schedules={initial.schedules}
        bookingAdvanceDays={salon.bookingAdvanceDays}
        onClose={() => setEditTarget(null)} onSaved={(booking) => { setBookings((current) => current.map((item) => item.id === booking.id ? booking : item)); setEditTarget(null); notify("Appointment updated."); }} />}
      <Toast toast={toast} />
    </div>
  );
}

/**
 * An appointment card takes its stylist's colour (so the desk can tell stylists apart at a glance), and the status shows
 * as a small badge and in the border: dashed while pending, faded once it is over or cancelled.
 */
function stylistCardStyle(color: string, status: Booking["status"], past: boolean): React.CSSProperties {
  const faded = past || status === "CANCELLED";
  return {
    background: withAlpha(color, faded ? 0.08 : 0.2),
    border: `1px ${status === "PENDING" ? "dashed" : "solid"} ${withAlpha(color, faded ? 0.3 : 0.55)}`,
    borderLeft: `4px solid ${color}`,
  };
}

const STATUS_STYLE: Record<Booking["status"], string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  CONFIRMED: "border-blue-200 bg-blue-50 text-blue-800",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-400 line-through",
  COMPLETED: "border-green-200 bg-green-50 text-green-800",
  NO_SHOW: "border-red-200 bg-red-50 text-red-700",
};

function TodayAppointmentsReadOnly({ bookings, staff, services, operatingHours, colors, colorOverrides, onColorChange, date, mode, onDateChange, onModeChange }: {
  colors: Map<number, string>; colorOverrides: Record<number, string | null | undefined>; onColorChange: (staffId: number, color: string | null) => Promise<void>;
  bookings: Booking[]; staff: StaffMember[]; services: ServiceItem[]; operatingHours?: OperatingHours[];
  date: string; mode: "stylist" | "day"; onDateChange: (date: string) => void; onModeChange: (mode: "stylist" | "day") => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const selectedDate = parseDate(date);
  const dayBookings = bookings.filter((booking) => booking.appointmentDate === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const staffMap = new Map(staff.map((member) => [member.id, member]));
  const serviceMap = new Map(services.map((service) => [service.id, service.name]));
  const dayHours = operatingHours?.find((item) => item.day === JS_DAYS[selectedDate.getDay()]);
  const grouped = staff.filter((member) => member.status === "ACTIVE").map((member) => ({
    member,
    appointments: dayBookings.filter((booking) => booking.staffId === member.id),
  }));

  return <section className={expanded ? "fixed inset-3 z-50 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl" : "rounded-xl border border-slate-200 bg-white shadow-sm"}>
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
      <div className="min-w-[180px] flex-1"><h2 className="text-sm font-bold text-slate-800">{prettyDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><p className="text-xs text-slate-400">{dayBookings.length} {dayBookings.length === 1 ? translateUi("appointment") : translateUi("appointments")} {translateUi("· Read only")}</p></div>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">{translateUi("Date")}<input type="date" value={date} onChange={(event) => event.target.value && onDateChange(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-matcha-500" /></label>
      <button type="button" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? translateUi("Exit expanded calendar") : translateUi("Expand calendar")} title={expanded ? translateUi("Exit expanded calendar") : translateUi("Expand calendar")} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ExpandIcon expanded={expanded} /></button>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-100 px-4 py-2.5">
      <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label={translateUi("Appointment overview layout")}>
        <button type="button" onClick={() => onModeChange("stylist")} aria-pressed={mode === "stylist"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "stylist" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{translateUi("By Stylist")}</button>
        <button type="button" onClick={() => onModeChange("day")} aria-pressed={mode === "day"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "day" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{translateUi("Overall view")}</button>
      </div>
    </div>
    <StylistColorLegend staff={staff} colors={colors} colorOverrides={colorOverrides} dayBookings={dayBookings} onColorChange={onColorChange} />
    {mode === "stylist" ? <StylistSchedule date={date} groups={grouped} operatingHours={operatingHours} services={serviceMap} colors={colors} />
      : dayBookings.length ? <ReadOnlyDayTimeline date={date} bookings={dayBookings} services={serviceMap} staff={staffMap} colors={colors} operatingHours={operatingHours} closed={!!dayHours?.closed} />
        : <p className="px-4 py-12 text-center text-sm text-slate-400">{translateUi("No appointments scheduled for this date.")}</p>}
  </section>;
}

/** Each active stylist with their colour and today's count. The swatch opens the colour picker, so a colour can be assigned right here. */
function StylistColorLegend({ staff, colors, colorOverrides, dayBookings, onColorChange }: {
  staff: StaffMember[]; colors: Map<number, string>; colorOverrides: Record<number, string | null | undefined>; dayBookings: Booking[];
  onColorChange: (staffId: number, color: string | null) => Promise<void>;
}) {
  const { t: translateUi } = useI18n();
  const [editing, setEditing] = useState<number | null>(null);
  const active = staff.filter((member) => member.status === "ACTIVE");
  if (!active.length) return null;
  return <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
    {active.map((member) => {
      const color = colors.get(member.id) ?? "#94a3b8";
      const count = dayBookings.filter((booking) => booking.staffId === member.id && booking.status !== "CANCELLED").length;
      return <div key={member.id} className="relative">
        <div className="flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2.5 text-xs font-semibold text-slate-700" style={{ borderColor: withAlpha(color, 0.5), background: withAlpha(color, 0.1) }}>
          <button type="button" onClick={() => setEditing(editing === member.id ? null : member.id)} title={translateUi("Change colour")}
            aria-label={`${translateUi("Change colour")} — ${member.name}`} aria-expanded={editing === member.id}
            className="h-5 w-5 rounded-full ring-1 ring-white" style={{ background: color }} />
          <span>{member.name}</span><span className="font-normal text-slate-400">{count}</span>
        </div>
        {editing === member.id && <ColorPopover current={color} custom={(member.id in colorOverrides ? colorOverrides[member.id] : member.calendarColor) != null}
          onPick={(next) => { void onColorChange(member.id, next); setEditing(null); }} onClose={() => setEditing(null)} />}
      </div>;
    })}
  </div>;
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />;
}

function StaffAvatar({ member, size = "sm" }: { member?: StaffMember; size?: "sm" | "md" }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const sizeClass = size === "md" ? "h-9 w-9 text-xs" : "h-6 w-6 text-[9px]";
  return <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-500 ${sizeClass}`} title={member?.name ?? "Stylist"} aria-hidden="true">
    <span>{member?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?"}</span>
    {member?.avatarUrl && <img src={member.avatarUrl} alt={""} className="absolute inset-0 h-full w-full rounded-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
  </span>;
}

function useFloatingScrollPosition(anchorRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [position, setPosition] = useState<{ top: number; left: number; right: number } | null>(null);
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !enabled) { setPosition(null); return; }
    const update = () => {
      const bounds = anchor.getBoundingClientRect();
      const visibleTop = Math.max(12, bounds.top);
      const visibleBottom = Math.min(window.innerHeight - 12, bounds.bottom);
      if (visibleBottom <= visibleTop) { setPosition(null); return; }
      const buttonSize = 48;
      const top = Math.max(12, Math.min(window.innerHeight - buttonSize - 12, (visibleTop + visibleBottom - buttonSize) / 2));
      const left = Math.max(12, Math.min(window.innerWidth - buttonSize - 12, bounds.left + 92));
      const right = Math.max(12, Math.min(window.innerWidth - buttonSize - 12, bounds.right - buttonSize - 8));
      setPosition((current) => current?.top === top && current.left === left && current.right === right ? current : { top, left, right });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); observer.disconnect(); };
  }, [anchorRef, enabled]);
  return position;
}

function ReadOnlyDayTimeline({ date, bookings, services, staff, colors, operatingHours, closed }: {
  colors: Map<number, string>; date: string; bookings: Booking[]; services: Map<number, string>; staff: Map<number, StaffMember>;
  operatingHours?: OperatingHours[]; closed: boolean;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const hours = operatingHours?.find((item) => item.day === JS_DAYS[parseDate(date).getDay()]);
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const opening = hours && !hours.closed ? toMinutes(hours.openTime) : 8 * 60;
  const closing = hours && !hours.closed ? toMinutes(hours.closeTime) : 20 * 60;
  const bookedAt = new Map<number, Booking[]>();
  for (const booking of bookings) {
    const key = Math.floor(toMinutes(booking.startTime) / 30) * 30;
    bookedAt.set(key, [...(bookedAt.get(key) ?? []), booking]);
  }
  const starts = [...bookedAt.keys()];
  const start = Math.min(Math.floor(opening / 30) * 30, ...starts);
  const end = Math.max(Math.ceil(closing / 30) * 30, ...starts.map((minutes) => minutes + 30));
  const slots = Array.from({ length: Math.max(1, (end - start) / 30) }, (_, index) => start + index * 30);
  return <div className="divide-y divide-slate-100">
    {closed && <p className="bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">{translateUi("Salon is marked closed today. Existing appointments are shown below.")}</p>}
    {slots.map((minutes) => <div key={minutes} className="flex min-h-12"><span className="sticky left-0 z-10 w-20 shrink-0 border-r border-slate-100 bg-white px-3 py-3 text-right text-[11px] font-medium tabular-nums text-slate-400">{minutes % 60 === 0 ? `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00` : ""}</span><div className="min-w-0 flex-1 space-y-1 px-2 py-1">{(bookedAt.get(minutes) ?? []).map((booking) => { const member = staff.get(booking.staffId); const past = isTimeInPast(date, booking.startTime); return <div key={booking.id} style={stylistCardStyle(colors.get(booking.staffId) ?? "#94a3b8", booking.status, past)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-slate-800 ${past || booking.status === "CANCELLED" ? "text-slate-500" : ""} ${booking.status === "CANCELLED" ? "line-through" : ""}`}><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)} · {booking.customerName}</p><p className="truncate text-[10px] opacity-75">{services.get(booking.serviceId) ?? "Service"} · {member?.name ?? "Staff"}</p></div><span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold no-underline ${STATUS_STYLE[booking.status]}`}>{booking.status.replace("_", " ")}</span><StaffAvatar member={member} /></div>; })}</div></div>)}
  </div>;
}

function StylistSchedule({ date, groups, operatingHours, services, colors }: {
  colors: Map<number, string>; date: string; groups: { member: StaffMember; appointments: Booking[] }[];
  operatingHours?: OperatingHours[]; services: Map<number, string>;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const columnsRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const floatingPosition = useFloatingScrollPosition(anchorRef, canScrollLeft || canScrollRight);
  const dayHours = operatingHours?.find((item) => item.day === JS_DAYS[parseDate(date).getDay()]);
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const opening = dayHours && !dayHours.closed ? toMinutes(dayHours.openTime) : 8 * 60;
  const closing = dayHours && !dayHours.closed ? toMinutes(dayHours.closeTime) : 20 * 60;
  const starts = groups.flatMap(({ appointments }) => appointments.map((booking) => toMinutes(booking.startTime)));
  const start = Math.min(Math.floor(opening / 30) * 30, ...starts.map((minutes) => Math.floor(minutes / 30) * 30));
  const end = Math.max(Math.ceil(closing / 30) * 30, ...starts.map((minutes) => Math.floor(minutes / 30) * 30 + 30));
  const times = Array.from({ length: Math.max(1, (end - start) / 30) }, (_, index) => start + index * 30);

  useEffect(() => {
    const columns = columnsRef.current;
    if (!columns) return;
    const updateOverflow = () => {
      const overflow = columns.scrollWidth > columns.clientWidth + 1;
      setHasOverflow(overflow);
      setCanScrollLeft(columns.scrollLeft > 1);
      setCanScrollRight(columns.scrollLeft + columns.clientWidth < columns.scrollWidth - 1);
    };
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(columns);
    columns.addEventListener("scroll", updateOverflow, { passive: true });
    return () => { observer.disconnect(); columns.removeEventListener("scroll", updateOverflow); };
  }, [groups.length]);

  return <div ref={anchorRef}>
    {hasOverflow && <p className="mx-4 mt-3 flex w-fit items-center rounded-full border border-matcha-200 bg-matcha-50 px-2.5 py-1.5 text-[11px] font-semibold text-matcha-800">{translateUi("Scroll to see all stylists")}</p>}
    {!groups.length ? <p className="px-4 py-12 text-center text-sm text-slate-400">{translateUi("No active stylists are available.")}</p> : <div className="flex min-w-0 px-4 pb-4 pt-3">
      <div className="sticky left-0 z-20 w-16 shrink-0 border-r border-slate-200 bg-white">
        <div className="flex h-11 items-center justify-center border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">{translateUi("Time")}</div>
        {times.map((minutes) => <div key={minutes} className="h-16 border-b border-slate-100 pr-2 pt-1 text-right text-[10px] font-medium tabular-nums text-slate-400">{minutes % 60 === 0 ? `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00` : ""}</div>)}
      </div>
      <div className="relative min-w-0 flex-1">
      <div ref={columnsRef} className="min-w-0 overflow-x-auto">
        <div className="grid auto-cols-[240px] grid-flow-col gap-3">
          {groups.map(({ member, appointments }) => <section key={member.id} className="overflow-hidden rounded-lg border border-slate-200">
            <h3 className="flex h-11 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-700"><span className="flex min-w-0 items-center gap-2"><span className="h-6 w-1 shrink-0 rounded-full" style={{ background: colors.get(member.id) ?? "#94a3b8" }} /><StaffAvatar member={member} /><span className="truncate">{member.name}</span></span><span className="shrink-0 font-normal text-slate-400">{appointments.length}</span></h3>
            {times.map((minutes) => {
              const rowBookings = appointments.filter((booking) => Math.floor(toMinutes(booking.startTime) / 30) * 30 === minutes);
              return <div key={minutes} className="h-16 overflow-hidden border-b border-slate-100 px-1 py-1">
                {rowBookings.map((booking) => { const past = isTimeInPast(date, booking.startTime); return <div key={booking.id} style={stylistCardStyle(colors.get(member.id) ?? "#94a3b8", booking.status, past)} className={`truncate rounded px-2 py-1 text-[10px] text-slate-800 ${past || booking.status === "CANCELLED" ? "text-slate-500" : ""} ${booking.status === "CANCELLED" ? "line-through" : ""}`} title={`${booking.startTime.slice(0, 5)} ${booking.customerName} · ${services.get(booking.serviceId) ?? "Service"} · ${booking.status.replace("_", " ")}`}>
                  <p className="flex items-center gap-1"><span className="min-w-0 flex-1 truncate font-bold">{booking.startTime.slice(0, 5)} · {booking.customerName}</span><span className={`shrink-0 rounded-full border px-1 text-[8px] font-bold no-underline ${STATUS_STYLE[booking.status]}`}>{booking.status.replace("_", " ")}</span></p><p className="truncate opacity-75">{services.get(booking.serviceId) ?? "Service"}</p>
                </div>; })}
              </div>;
            })}
          </section>)}
        </div>
      </div>
      {floatingPosition && canScrollLeft && <button type="button" onClick={() => columnsRef.current?.scrollBy({ left: -Math.max(240, columnsRef.current.clientWidth * 0.75), behavior: "smooth" })} aria-label={translateUi("Scroll to previous stylists")} style={{ position: "fixed", top: floatingPosition.top, left: floatingPosition.left }} className="z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xl transition hover:scale-105 hover:bg-slate-50"><ChevronLeft className="h-6 w-6" /></button>}
      {floatingPosition && canScrollRight && <button type="button" onClick={() => columnsRef.current?.scrollBy({ left: Math.max(240, columnsRef.current.clientWidth * 0.75), behavior: "smooth" })} aria-label={translateUi("Scroll to more stylists")} style={{ position: "fixed", top: floatingPosition.top, left: floatingPosition.right }} className="z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xl transition hover:scale-105 hover:bg-slate-50"><ChevronRight className="h-6 w-6" /></button>}
      </div>
    </div>}
  </div>;
}

function ReadOnlyAppointment({ booking, serviceName, staffName, compact = false }: { booking: Booking; serviceName: string; staffName: string; compact?: boolean }) {
  return <div className={`flex items-center gap-3 ${compact ? "py-1" : "px-3 py-2.5"}`}>
    {!compact && <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-slate-500">{booking.startTime.slice(0, 5)}</span>}
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{booking.customerName}</p><p className="truncate text-[11px] text-slate-400">{serviceName} · {staffName}{booking.customerPhone ? ` · ${booking.customerPhone}` : ""}</p></div>
    {!compact && <span className="rounded-full border px-2 py-1 text-[10px] font-bold text-slate-500">{booking.status.replace("_", " ")}</span>}
  </div>;
}

type PaymentLinksData = {
  latest: Map<number, BookingPaymentLink>;
  loadHistory: (bookingId: number) => Promise<BookingPaymentLink[]>;
  resend: (bookingId: number, linkId: number) => Promise<unknown>;
};

/** One appointment's payment links, refetched whenever the page learns its latest link changed (new, re-emailed, paid, expired). */
function BookingLinkHistorySection({ booking, data, onNew }: { booking: Booking; data: PaymentLinksData; onNew?: () => void }) {
  const [links, setLinks] = useState<BookingPaymentLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = data.latest.get(booking.id);
  const { loadHistory } = data;
  useEffect(() => {
    let alive = true;
    loadHistory(booking.id)
      .then((l) => { if (alive) { setLinks(l); setError(null); } })
      .catch((e) => { if (alive) { setLinks([]); setError(e instanceof Error ? e.message : "Could not load payment links."); } });
    return () => { alive = false; };
  }, [booking.id, loadHistory, current?.id, current?.status, current?.emailCount]);
  return <BookingPaymentLinkHistory links={links} customerEmail={booking.customerEmail} error={error} onNew={onNew}
    onResend={(link) => data.resend(booking.id, link.id)} />;
}

function BookingActions({ booking, staff, services, paymentLinks, onClose, onEdit, onRequestPayment, onAction }: { booking: Booking; staff: StaffMember[]; services: ServiceItem[]; paymentLinks: PaymentLinksData; onClose: () => void; onEdit: () => void; onRequestPayment: () => void; onAction: (id: number, action: "confirm" | "cancel" | "complete" | "no-show") => Promise<void> }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const service = services.find((item) => item.id === booking.serviceId); const member = staff.find((item) => item.id === booking.staffId); const active = booking.status === "PENDING" || booking.status === "CONFIRMED";
  const confirmAction = (action: "cancel" | "no-show", message: string) => {
    if (window.confirm(message)) void onAction(booking.id, action);
  };
  return <Dialog title={`${booking.customerName} · #${booking.id}`} onClose={onClose}><div className="space-y-4"><div className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-800">{booking.appointmentDate}</p><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${STATUS_STYLE[booking.status]}`}>{booking.status.replace("_", " ")}</span></div><p className="mt-1 text-sm text-slate-600">{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)} · {service?.name ?? "Service"}</p><p className="mt-1 text-xs text-slate-400">{member?.name ?? "Staff"} · {booking.customerEmail}{booking.customerPhone ? ` · ${booking.customerPhone}` : ""}</p>{booking.notes && <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">{booking.notes}</p>}</div><div className="grid grid-cols-2 gap-2"><button onClick={onEdit} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />{translateUi("Edit / reschedule")}</button>{booking.status === "PENDING" && <button onClick={() => onAction(booking.id, "confirm")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" />{translateUi("Confirm")}</button>}{booking.status === "CONFIRMED" && <><button onClick={() => onAction(booking.id, "complete")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" />{translateUi("Complete")}</button><button onClick={() => confirmAction("no-show", `Mark ${booking.customerName}'s appointment as a no-show?`)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">{translateUi("Mark no-show")}</button></>}{(booking.status === "NO_SHOW" || booking.status === "COMPLETED") && booking.paymentStatus !== "PAID" && <button onClick={onRequestPayment} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"><CreditCard className="h-3.5 w-3.5" />{translateUi(booking.status === "NO_SHOW" ? "Request payment (no-show)" : "Request payment")}</button>}{active && <button onClick={() => confirmAction("cancel", `Cancel ${booking.customerName}'s appointment?`)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><XCircle className="h-3.5 w-3.5" />{translateUi("Cancel booking")}</button>}</div>{((booking.status === "NO_SHOW" || booking.status === "COMPLETED") && booking.paymentStatus !== "PAID") || paymentLinks.latest.has(booking.id) ? <div className="border-t border-slate-100 pt-4"><BookingLinkHistorySection booking={booking} data={paymentLinks} onNew={(booking.status === "NO_SHOW" || booking.status === "COMPLETED") && booking.paymentStatus !== "PAID" ? onRequestPayment : undefined} /></div> : null}</div></Dialog>;
}

function AvailableServicePicker({ sid, date, time, staffId, services, staff, onClose, onSelect }: {
  sid: string; date: string; time: string; staffId?: number; services: ServiceItem[]; staff: StaffMember[];
  onClose: () => void; onSelect: (serviceId: number) => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [available, setAvailable] = useState<{ service: ServiceItem; staffIds: number[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const timeHasPassed = isTimeInPast(date, time);

  useEffect(() => {
    let cancelled = false;
    const activeServices = services.filter((service) => service.active);
    setLoading(true);
    setFailed(false);
    Promise.all(activeServices.map(async (service) => {
      const params = new URLSearchParams({ serviceId: String(service.id), date });
      try {
        const slots = await apiFetch<AvailableSlot[]>(`${CUSTOMER_API}/${sid}/booking/slots?${params}`);
        const staffIds = [...new Set(slots.filter((slot) => !slot.booked && slot.startTime.slice(0, 5) === time && (!staffId || slot.staffId === staffId)).map((slot) => slot.staffId))];
        return staffIds.length ? { service, staffIds } : null;
      } catch {
        if (!cancelled) setFailed(true);
        return null;
      }
    })).then((results) => {
      if (!cancelled) setAvailable(results.filter((result): result is { service: ServiceItem; staffIds: number[] } => result !== null));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, services, sid, time, staffId]);

  return <Dialog title={translateUi("Choose a service")} onClose={onClose}>
    <div className="space-y-3">
      <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-xs font-semibold text-slate-700">{prettyDate(parseDate(date), { weekday: "long", day: "numeric", month: "long" })} {translateUi("at ")}{time}</p><p className="text-[11px] text-slate-400">{staffId ? `Services available with ${staff.find((member) => member.id === staffId)?.name ?? "this stylist"} are shown.` : translateUi("Only services available at this time are shown.")}</p></div>
      {timeHasPassed ? <p className="py-8 text-center text-sm text-slate-400">{translateUi("This time has already passed. Choose another time.")}</p>
        : loading ? <p className="py-8 text-center text-sm text-slate-400">{translateUi("Checking available services…")}</p>
        : available.length ? <div className="max-h-[55dvh] space-y-2 overflow-y-auto">{available.map(({ service, staffIds }) => {
          const availableStaff = staff.filter((member) => staffIds.includes(member.id) && member.status === "ACTIVE");
          return <button key={service.id} type="button" onClick={() => onSelect(service.id)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-matcha-400 hover:bg-matcha-50 focus:outline-none focus:ring-2 focus:ring-matcha-500">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{service.name}</p><p className="mt-0.5 text-xs text-slate-400">{service.durationMinutes} {translateUi("min · ")}{availableStaff.map((member) => member.name).join(", ") || `${staffIds.length} available ${staffIds.length === 1 ? "stylist" : "stylists"}`}</p></div>
            <span className="shrink-0 text-xs font-semibold text-slate-700">{formatPrice(service.price, service.currency, uiLocale)}</span>
          </button>;
        })}</div>
        : <div className="py-8 text-center"><p className="text-sm font-medium text-slate-600">{translateUi("No services are available at ")}{time}.</p><p className="mt-1 text-xs text-slate-400">{translateUi("Choose another time to see available services.")}</p>{failed && <p className="mt-2 text-[11px] text-red-500">{translateUi("Some availability checks could not be completed.")}</p>}</div>}
      <div className="flex justify-end border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">{translateUi("Cancel")}</button></div>
    </div>
  </Dialog>;
}

function AppointmentEditor({ sid, staff, services, countries, defaultCountry, booking, defaultDate, defaultTime, defaultServiceId, defaultStaffId, operatingHours, closures, holidays, schedules, bookingAdvanceDays, onClose, onSaved }: {
  sid: string; staff: StaffMember[]; services: ServiceItem[]; countries: Country[]; defaultCountry?: string; booking?: Booking; defaultDate?: string; defaultTime?: string; defaultServiceId?: number; defaultStaffId?: number;
  operatingHours?: OperatingHours[]; closures: SalonClosure[]; holidays: SalonHoliday[]; bookingAdvanceDays?: number;
  schedules: { staffId: number; availability: StaffAvailability[]; overrides: StaffAvailabilityOverride[] }[];
  onClose: () => void; onSaved: (booking: Booking) => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [form, setForm] = useState({ customerName: booking?.customerName ?? "", customerEmail: booking?.customerEmail ?? "", customerPhone: booking?.customerPhone ?? "", serviceId: booking?.serviceId ?? defaultServiceId ?? services[0]?.id ?? 0, staffId: booking?.staffId ?? defaultStaffId ?? (defaultServiceId ? 0 : staff[0]?.id ?? 0), appointmentDate: booking?.appointmentDate ?? defaultDate ?? localDateKey(), startTime: booking?.startTime?.slice(0, 5) ?? defaultTime ?? "09:00", notes: booking?.notes ?? "" });
  const [contactMethod, setContactMethod] = useState<ContactMethod>(booking?.customerPhone && !booking.customerEmail ? "phone" : "email");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const salonRestriction = restrictionFor(form.appointmentDate, operatingHours, closures, holidays, bookingAdvanceDays);
  const staffSchedule = schedules.find((item) => item.staffId === form.staffId);
  const staffOverride = staffSchedule?.overrides.find((item) => item.overrideDate === form.appointmentDate);
  const weeklyAvailability = staffSchedule?.availability.find((item) => item.dayOfWeek === JS_DAYS[parseDate(form.appointmentDate).getDay()]);
  const staffRestriction = staffOverride?.available === false ? (staffOverride.reason || "Staff member unavailable")
    : !staffOverride && staffSchedule && (!weeklyAvailability || !weeklyAvailability.available) ? "Staff member does not work on this day" : null;
  const restriction = salonRestriction || staffRestriction;
  const originalSlot = !!booking && booking.appointmentDate === form.appointmentDate && booking.staffId === form.staffId && booking.startTime.slice(0, 5) === form.startTime;
  const selectedTimePassed = !booking && !!form.startTime && isTimeInPast(form.appointmentDate, form.startTime);

  useEffect(() => {
    if (!form.serviceId || !form.appointmentDate || salonRestriction) { setSlots([]); return; }
    let cancelled = false; setLoadingSlots(true);
    apiFetch<AvailableSlot[]>(`${CUSTOMER_API}/${sid}/booking/slots?serviceId=${form.serviceId}&date=${form.appointmentDate}`)
      .then((available) => { if (!cancelled) setSlots(available.filter((slot) => !slot.booked)); })
      .catch(() => { if (!cancelled) setSlots([]); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [sid, form.serviceId, form.appointmentDate, salonRestriction]);

  const service = services.find((item) => item.id === form.serviceId);
  const assigned = new Set((service?.assignedStaffIds ?? []).map(Number));
  const slotStaffIds = new Set(slots.map((slot) => slot.staffId));
  const slotsAtSelectedTime = slots.filter((slot) => slot.startTime.slice(0, 5) === form.startTime);
  const staffAtSelectedTime = new Set(slotsAtSelectedTime.map((slot) => slot.staffId));
  const hasCalendarTime = !booking && !!defaultTime;
  const eligibleStaff = staff.filter((member) => member.status === "ACTIVE" && (!assigned.size || assigned.has(member.id)) && (loadingSlots || originalSlot || (hasCalendarTime ? staffAtSelectedTime.has(member.id) : slotStaffIds.has(member.id))));
  const staffSlots = slots.filter((slot) => slot.staffId === form.staffId);
  const timeOptions = [...staffSlots.map((slot) => slot.startTime.slice(0, 5)), ...(originalSlot ? [form.startTime] : [])].filter((value, index, all) => all.indexOf(value) === index).sort();
  const validSlot = originalSlot || (hasCalendarTime && !form.staffId ? staffAtSelectedTime.size > 0 : timeOptions.includes(form.startTime));
  const hasContact = contactMethod === "email"
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())
    : form.customerPhone.trim().length > 4;
  async function save() {
    setSaving(true); setError("");
    try {
      const payload = booking ? { appointmentDate: form.appointmentDate, startTime: form.startTime, staffId: form.staffId, notes: form.notes || null } : { ...form, staffId: form.staffId || null, notes: form.notes || null };
      const saved = await apiFetch<Booking>(`${ADMIN_API}/${sid}/booking${booking ? `/${booking.id}` : ""}`, { method: booking ? "PUT" : "POST", body: JSON.stringify(payload) });
      onSaved(saved);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save appointment"); } finally { setSaving(false); }
  }
  return <Dialog title={booking ? translateUi("Edit appointment") : translateUi("Book appointment")} onClose={onClose}>
    <div className="space-y-3">
      {!booking && <><CustomerDetailsFields
        form={{ name: form.customerName, email: form.customerEmail, phone: form.customerPhone, notes: form.notes }}
        onChange={(details) => setForm({ ...form, customerName: details.name, customerEmail: details.email, customerPhone: details.phone, notes: details.notes })}
        contactMethod={contactMethod} onContactMethodChange={setContactMethod}
        countries={countries} defaultCountry={defaultCountry}
      /><p className="text-xs text-slate-500">{translateUi("Email confirmations are sent automatically. Phone notifications are currently previewed in the server log.")}</p><select className={inputCls} value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: Number(e.target.value), staffId: 0 })}>{services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></>}
      <input type="date" min={booking ? undefined : localDateKey()} className={inputCls} value={form.appointmentDate} onChange={(e) => setForm({ ...form, appointmentDate: e.target.value, startTime: "" })} />
      {salonRestriction && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">{salonRestriction} {translateUi("— select another date.")}</p>}
      <div className="grid grid-cols-2 gap-3"><select className={inputCls} value={form.staffId || ""} onChange={(e) => { const staffId = Number(e.target.value); const originalTime = !!booking && staffId === booking.staffId && form.appointmentDate === booking.appointmentDate; const timeIsAvailable = slots.some((slot) => slot.staffId === staffId && slot.startTime.slice(0, 5) === form.startTime); setForm({ ...form, staffId, startTime: timeIsAvailable || originalTime || (hasCalendarTime && !staffId) ? form.startTime : "" }); }}><option value="">{loadingSlots ? translateUi("Loading stylists…") : hasCalendarTime ? translateUi("Any available stylist — auto-assign") : translateUi("Select stylist")}</option>{eligibleStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{hasCalendarTime
        ? <div className={`${inputCls} flex items-center justify-between bg-slate-50 text-slate-700`} aria-label={translateUi("Selected appointment time")}><span>{form.startTime || "Selected time"}</span><span className="text-[10px] font-medium text-slate-400">{translateUi("From calendar")}</span></div>
        : <select className={inputCls} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} disabled={!form.staffId || !!restriction}><option value="">{loadingSlots ? translateUi("Loading times…") : translateUi("Select time")}</option>{timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}</select>}</div>
      {selectedTimePassed && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{translateUi("This time has already passed. Choose a later time.")}</p>}
      {staffRestriction && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">{staffRestriction}.</p>}
      {!loadingSlots && !salonRestriction && slots.length === 0 && !originalSlot && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{translateUi("No bookable slots remain for this service and date.")}</p>}
      {booking && <textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={translateUi("Notes (optional)")} />}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 cursor-pointer">{translateUi("Cancel")}</button><button onClick={save} disabled={saving || loadingSlots || (!booking && !hasContact) || (!form.staffId && !hasCalendarTime) || !form.serviceId || !form.startTime || !validSlot || selectedTimePassed || (!!restriction && !originalSlot)} className="rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 cursor-pointer">{saving ? translateUi("Saving…") : translateUi("Save appointment")}</button></div>
    </div>
  </Dialog>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}><div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4"><h2 className="font-bold text-slate-900">{title}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}
