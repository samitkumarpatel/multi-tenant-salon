import { useEffect, useMemo, useRef, useState } from "react";
import { redirect, useLoaderData, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  Bell, CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard,
  Maximize2, Minimize2, Minus, Pencil, Plus, Receipt, ShoppingCart, UserRound, X, XCircle,
  Search,
} from "lucide-react";
import { Toast, useToast } from "@salon/ui-shared";
import { ADMIN_API, CUSTOMER_API, apiFetch } from "~/lib/api";
import { getDashboardSession } from "~/lib/auth";
import { formatPrice } from "~/lib/format";
import type {
  AvailableSlot, Booking, Country, OperatingHours, Salon, SalonClosure, SalonHoliday, ServiceItem, StaffAvailability,
  StaffAvailabilityOverride, StaffMember,
} from "@salon/ui-website";
import { CustomerDetailsFields, type ContactMethod } from "@salon/ui-website";

type DashboardView = "appointments" | "cashier";
type CashierView = "pos" | "invoices";

interface DashboardSettings {
  salonId: string;
  bookingManagementEnabled: boolean;
  cashierEnabled: boolean;
  notificationsEnabled: boolean;
  defaultNotification?: string | null;
}

interface CashierItem {
  sourceType: "SERVICE" | "PRODUCT";
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
}
interface PaymentSetup { stripe: { account: { chargesEnabled: boolean } | null; settings: { posEnabled: boolean } } }

interface CartLine extends CashierItem { quantity: number }

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  if (!getDashboardSession()) throw redirect(`/login?salon=${encodeURIComponent(params.salonId!)}`);
  const sid = params.salonId!;
  const salon = await apiFetch<Salon>(`${ADMIN_API}/${sid}`);
  if (!salon.features?.includes("DASHBOARD")) throw new Response("Dashboard is not enabled for this salon", { status: 403 });
  const settings = await apiFetch<DashboardSettings>(`${ADMIN_API}/${sid}/dashboard/settings`);
  const bookingEnabled = settings.bookingManagementEnabled && salon.features?.includes("BOOKING");
  const [bookings, staff, services, closures, holidays, cashierItems, sales, countries, paymentSetup] = await Promise.all([
    bookingEnabled ? apiFetch<Booking[]>(`${ADMIN_API}/${sid}/booking`).catch((): Booking[] => []) : Promise.resolve([]),
    bookingEnabled ? apiFetch<StaffMember[]>(`${ADMIN_API}/${sid}/staff`).catch((): StaffMember[] => []) : Promise.resolve([]),
    bookingEnabled ? apiFetch<ServiceItem[]>(`${ADMIN_API}/${sid}/services`).catch((): ServiceItem[] => []) : Promise.resolve([]),
    bookingEnabled ? apiFetch<SalonClosure[]>(`${ADMIN_API}/${sid}/closures`).catch((): SalonClosure[] => []) : Promise.resolve([]),
    bookingEnabled ? apiFetch<SalonHoliday[]>(`${ADMIN_API}/${sid}/holidays`).catch((): SalonHoliday[] => []) : Promise.resolve([]),
    settings.cashierEnabled
      ? apiFetch<CashierItem[]>(`${ADMIN_API}/${sid}/dashboard/cashier/items`).catch((): CashierItem[] => [])
      : Promise.resolve([] as CashierItem[]),
    settings.cashierEnabled ? apiFetch<PosSale[]>(`${ADMIN_API}/${sid}/dashboard/sales`).catch((): PosSale[] => []) : Promise.resolve([]),
    bookingEnabled ? apiFetch<Country[]>(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"}/api/salon-utility/countries`).catch((): Country[] => []) : Promise.resolve([] as Country[]),
    settings.cashierEnabled ? apiFetch<PaymentSetup>(`${ADMIN_API}/${sid}/payments/stripe`).catch((): null => null) : Promise.resolve(null),
  ]);
  const schedules = bookingEnabled ? (await Promise.all(staff.map(async (member) => {
    const [availability, overrides] = await Promise.all([
      apiFetch<StaffAvailability[]>(`${ADMIN_API}/${sid}/staff/${member.id}/availability`).catch((): StaffAvailability[] => []),
      apiFetch<StaffAvailabilityOverride[]>(`${ADMIN_API}/${sid}/staff/${member.id}/availability/overrides`).catch((): StaffAvailabilityOverride[] => []),
    ]);
    return { staffId: member.id, availability, overrides };
  }))) : [];
  return { sid, salon, settings, bookings, staff, services, closures, holidays, schedules, cashierItems, sales, countries, paymentSetup };
}

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

export default function DashboardPage() {
  const initial = useLoaderData<typeof clientLoader>();
  const salon = initial.salon;
  const [params, setParams] = useSearchParams();
  const { toast, notify } = useToast();
  const appointmentEnabled = initial.settings.bookingManagementEnabled && initial.salon.features?.includes("BOOKING");
  const requestedView = params.get("view");
  const cashierView: CashierView = params.get("cashierView") === "invoices" ? "invoices" : "pos";
  const invoicePeriod = params.get("invoicePeriod") ?? "all";
  const [invoicePicker, setInvoicePicker] = useState<"month" | "range" | null>(null);
  const paymentReturn = params.get("payment");
  const returnedSessionId = params.get("session_id");
  const appointmentsView = params.get("appointmentsView");
  const todayView = params.get("todayView") === "stylist" ? "stylist" : "day";
  const view: DashboardView = requestedView === "cashier" && initial.settings.cashierEnabled
    ? "cashier"
    : appointmentEnabled ? "appointments" : "cashier";

  const [settings] = useState(initial.settings);
  const cardPaymentEnabled = Boolean(initial.paymentSetup?.stripe.settings.posEnabled && initial.paymentSetup?.stripe.account?.chargesEnabled);
  const [bookings, setBookings] = useState(initial.bookings);
  const [cashierItems] = useState(initial.cashierItems);
  const [cashierSearch, setCashierSearch] = useState("");
  const [cashierFilter, setCashierFilter] = useState<"ALL" | "SERVICE" | "PRODUCT">("ALL");
  const [sales, setSales] = useState(initial.sales);
  useEffect(() => {
    if (paymentReturn !== "success") return;
    let stopped = false;
    let attempts = 0;
    const poll = async () => {
      try {
        const refreshed = await apiFetch<PosSale[]>(`${ADMIN_API}/${initial.sid}/dashboard/sales`);
        if (stopped) return;
        setSales(refreshed);
        if (refreshed.some((sale) => sale.paymentReference === returnedSessionId && sale.paymentStatus !== "PENDING")) {
          window.clearInterval(timer);
        }
      } catch { /* Keep the current sale list if a refresh fails. */ }
      attempts += 1;
      if (attempts >= 8) window.clearInterval(timer);
    };
    const timer = window.setInterval(() => { void poll(); }, 1500);
    void poll();
    return () => { stopped = true; window.clearInterval(timer); };
  }, [paymentReturn, returnedSessionId, initial.sid]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PosSale["paymentMethod"]>("CASH");
  const [customerName, setCustomerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [newDefaults, setNewDefaults] = useState<{ date: string; time?: string; serviceId?: number; staffId?: number } | null>(null);
  const [servicePickerTime, setServicePickerTime] = useState<{ date: string; time: string; staffId?: number } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<Booking | null>(null);

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
    setCart((current) => {
      const existing = current.find((line) => line.sourceType === item.sourceType && line.sourceId === item.sourceId);
      if (existing) return current.map((line) => line === existing ? { ...line, quantity: line.quantity + 1 } : line);
      if (current.length && current[0].currency !== item.currency) {
        notify("Items with different currencies cannot share one sale.", "error");
        return current;
      }
      return [...current, { ...item, quantity: 1 }];
    });
  }

  function changeQuantity(line: CartLine, delta: number) {
    setCart((current) => current
      .map((item) => item.sourceType === line.sourceType && item.sourceId === line.sourceId
        ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const cartCurrency = cart[0]?.currency ?? "USD";
  const visibleCashierItems = useMemo(() => {
    const query = cashierSearch.trim().toLocaleLowerCase();
    return cashierItems.filter((item) => (cashierFilter === "ALL" || item.sourceType === cashierFilter)
      && (!query || `${item.name} ${item.detail ?? ""}`.toLocaleLowerCase().includes(query)));
  }, [cashierItems, cashierFilter, cashierSearch]);

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
      const response = await apiFetch<PosSale | { sale: PosSale; checkoutUrl: string }>(`${ADMIN_API}/${initial.sid}/dashboard/sales${paymentMethod === "CARD" ? "/card-checkout" : ""}`, {
        method: "POST",
        body: JSON.stringify({
          customerName: customerName.trim() || null,
          paymentMethod,
          items: cart.map(({ sourceType, sourceId, quantity }) => ({ sourceType, sourceId, quantity })),
        }),
      });
      const sale = "sale" in response ? response.sale : response;
      setSales((current) => [sale, ...current]);
      setCart([]);
      setCustomerName("");
      if ("checkoutUrl" in response) {
        window.location.assign(response.checkoutUrl);
        return;
      }
      notify(`Sale ${sale.saleNumber} completed.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not complete sale", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{view === "cashier" ? cashierView === "invoices" ? "Invoices" : "Till / POS" : appointmentsView === "new" ? "Book appointment" : "Overview"}</h1>
            <p className="mt-1 text-sm text-slate-500">{view === "cashier" ? cashierView === "invoices" ? "Review sales recorded through Till / POS." : "Build an in-salon sale from services and products." : appointmentsView === "new" ? "Choose an available time to start a booking." : "Appointments for the selected date."}</p>
          </div>
          {view === "appointments" && appointmentsView !== "new" && <button type="button" onClick={() => { const next = new URLSearchParams(params); next.set("view", "appointments"); next.set("appointmentsView", "new"); setParams(next); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-matcha-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-matcha-800 focus:outline-none focus:ring-2 focus:ring-matcha-500 focus:ring-offset-2">Book</button>}
        </div>
      </div>

      {!appointmentEnabled && !settings.cashierEnabled && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <h2 className="text-sm font-semibold text-slate-800">This salon desk is not available yet</h2>
          <p className="mt-1 text-xs text-slate-400">Ask the salon manager to enable appointments or cashier.</p>
        </div>
      )}

      {view === "appointments" && appointmentsView !== "new" && settings.bookingManagementEnabled && (
        <TodayAppointmentsReadOnly bookings={bookings} staff={initial.staff} services={initial.services} operatingHours={salon.operatingHours}
          date={params.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("date")!) ? params.get("date")! : localDateKey()} mode={todayView}
          onDateChange={(date) => { const next = new URLSearchParams(params); next.set("date", date); setParams(next); }}
          onModeChange={(mode) => { const next = new URLSearchParams(params); next.set("todayView", mode); setParams(next); }} />
      )}

      {view === "appointments" && appointmentsView === "new" && settings.bookingManagementEnabled && (
        <AppointmentsCalendar bookings={bookings} staff={initial.staff} services={initial.services}
          operatingHours={salon.operatingHours} closures={initial.closures} holidays={initial.holidays}
          schedules={initial.schedules}
          bookingAdvanceDays={salon.bookingAdvanceDays}
          searchParams={params} setSearchParams={setParams}
          onNew={(date, time, staffId) => setServicePickerTime({ date, time: time ?? "09:00", staffId })} onSelect={setSelectedBooking} />
      )}

      {view === "cashier" && cashierView === "invoices" && settings.cashierEnabled && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter invoices by date">
              {([ ["all", "All"], ["today", "Today"], ["week", "This week"], ["month", "Month"], ["range", "Date"]] as const).map(([key, label]) => <div key={key} className="relative">
                <button type="button" onClick={() => {
                  if (key === "month" || key === "range") {
                    selectInvoicePeriod(key);
                    setInvoicePicker((current) => current === key ? null : key);
                  } else {
                    selectInvoicePeriod(key);
                    setInvoicePicker(null);
                  }
                }} aria-pressed={invoicePeriod === key} aria-expanded={(key === "month" || key === "range") && invoicePicker === key} className={`cursor-pointer rounded-md px-3 py-2 text-xs font-semibold transition-colors ${invoicePeriod === key ? "bg-matcha-100 text-matcha-900" : "text-slate-500 hover:bg-slate-50"}`}>{label}</button>
                {key === "month" && invoicePicker === "month" && <div role="dialog" aria-label="Choose invoice month" className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <label className="block text-xs font-medium text-slate-600">Choose month<input type="month" value={params.get("invoiceMonth") ?? localDateKey().slice(0, 7)} onChange={(event) => { const next = new URLSearchParams(params); next.set("invoiceMonth", event.target.value); setParams(next); }} className="mt-2 w-full cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700" /></label>
                  <button type="button" onClick={() => setInvoicePicker(null)} className="mt-3 w-full cursor-pointer rounded-lg bg-matcha-700 px-3 py-2 text-xs font-semibold text-white hover:bg-matcha-800">Done</button>
                </div>}
                {key === "range" && invoicePicker === "range" && <div role="dialog" aria-label="Choose invoice date range" className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-slate-600">From<input type="date" value={params.get("invoiceFrom") ?? ""} onChange={(event) => { const next = new URLSearchParams(params); const from = event.target.value; if (from) next.set("invoiceFrom", from); else next.delete("invoiceFrom"); const to = next.get("invoiceTo"); if (to && from && to <= from) next.delete("invoiceTo"); setParams(next); }} className="mt-1 w-full cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700" /></label>
                    <label className="block text-xs font-medium text-slate-600">To<input type="date" min={params.get("invoiceFrom") ? nextDateKey(params.get("invoiceFrom")!) : undefined} value={params.get("invoiceTo") ?? ""} onChange={(event) => { const next = new URLSearchParams(params); const to = event.target.value; if (to) next.set("invoiceTo", to); else next.delete("invoiceTo"); setParams(next); }} className="mt-1 w-full cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700" /></label>
                  </div>
                  <button type="button" onClick={() => setInvoicePicker(null)} className="mt-3 w-full cursor-pointer rounded-lg bg-matcha-700 px-3 py-2 text-xs font-semibold text-white hover:bg-matcha-800">Done</button>
                </div>}
              </div>)}
            </div>
          </div>
          {visibleSales.length ? <div className="divide-y divide-slate-100">
            {visibleSales.map((sale) => <div key={sale.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
              <Receipt className="h-4 w-4 text-slate-400" />
              <span className="font-mono font-semibold text-slate-700">{sale.saleNumber}</span>
              <span className="min-w-0 flex-1 truncate text-slate-500">{sale.customerName || "Walk-in customer"}</span>
              <span className="text-slate-400">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.createdAt))}</span>
              <span className="capitalize text-slate-500">{sale.paymentMethod.toLowerCase()}{sale.paymentStatus === "PENDING" ? " · awaiting payment" : sale.paymentStatus === "FAILED" ? " · failed" : ""}</span>
              <span className="font-semibold text-slate-800">{formatPrice(sale.total, sale.currency)}</span>
            </div>)}
          </div> : <p className="px-4 py-12 text-center text-sm text-slate-400">No invoices found for this period.</p>}
        </section>
      )}

      {view === "cashier" && cashierView === "pos" && settings.cashierEnabled && (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <div className="order-2 flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white lg:order-1 lg:h-[calc(100vh-10rem)]">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Services and products</h2>
              <p className="mt-0.5 text-xs text-slate-400">Products appear when Shop is enabled and stock is available.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="relative min-w-[180px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="search" value={cashierSearch} onChange={(event) => setCashierSearch(event.target.value)} placeholder="Search services and products" aria-label="Search services and products" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-matcha-500" />
                </label>
                <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter cashier items">
                  {([ ["ALL", "All"], ["SERVICE", "Services"], ["PRODUCT", "Products"] ] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setCashierFilter(key)} aria-pressed={cashierFilter === key} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${cashierFilter === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{label}</button>)}
                </div>
              </div>
            </div>
            <div className="grid max-h-[38vh] gap-2 overflow-y-auto p-3 sm:grid-cols-2 xl:grid-cols-3 lg:min-h-0 lg:max-h-none lg:flex-1 lg:content-start">
              {visibleCashierItems.map((item) => (
                <button key={`${item.sourceType}-${item.sourceId}`} type="button" onClick={() => addToCart(item)}
                  className="group flex min-h-[64px] items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-matcha-300 hover:bg-matcha-50 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 focus-visible:ring-offset-1 cursor-pointer">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-matcha-100 group-hover:text-matcha-700">
                    {item.sourceType === "SERVICE" ? <CalendarCheck className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700">{item.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">{item.detail || (item.sourceType === "SERVICE" ? "Service" : "Product")}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">{formatPrice(item.price, item.currency)}</span>
                    {(() => {
                      const quantity = cart.find((line) => line.sourceType === item.sourceType && line.sourceId === item.sourceId)?.quantity ?? 0;
                      return <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold transition-colors ${quantity ? "bg-matcha-100 text-matcha-800" : "bg-slate-100 text-slate-500 group-hover:bg-matcha-600 group-hover:text-white"}`} aria-label={quantity ? `${quantity} in current sale` : "Add to current sale"}>{quantity || <Plus className="h-3 w-3" />}</span>;
                    })()}
                  </div>
                </button>
              ))}
              {!cashierItems.length ? <p className="p-4 text-sm text-slate-400">No active services or products are available.</p>
                : !visibleCashierItems.length && <p className="p-4 text-sm text-slate-400">No items match your search.</p>}
            </div>
          </div>

          <div className="order-1 sticky top-20 z-20 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white lg:order-2">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Receipt className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Current sale</h2>
            </div>
            <div className="space-y-3 p-4">
              {!cart.length ? <p className="py-4 text-center text-xs text-slate-400">Select a service or product to begin.</p> : cart.map((line) => (
                <div key={`${line.sourceType}-${line.sourceId}`} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700">{line.name}</p>
                    <p className="text-[11px] text-slate-400">{formatPrice(line.price, line.currency)} each</p>
                  </div>
                  <button onClick={() => changeQuantity(line, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label={`Remove one ${line.name}`}><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-5 text-center text-xs font-semibold">{line.quantity}</span>
                  <button onClick={() => changeQuantity(line, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label={`Add one ${line.name}`}><Plus className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3">
                <div className="mb-3 flex justify-between text-sm font-bold text-slate-800">
                  <span>Total</span><span>{formatPrice(cartTotal, cartCurrency)}</span>
                </div>
                <input className={`${inputCls} mb-2`} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name (optional)" />
                <select className={`${inputCls} mb-3`} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PosSale["paymentMethod"])}>
                  <option value="CASH">Cash</option><option value="CARD" disabled={!cardPaymentEnabled}>Card{cardPaymentEnabled ? " · Stripe" : " · connect Stripe in Admin"}</option><option value="OTHER">Other</option>
                </select>
                <button type="button" disabled={!cart.length || saving} onClick={completeSale}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-matcha-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-40 cursor-pointer">
                  <CreditCard className="h-4 w-4" /> {saving ? "Processing…" : paymentMethod === "CARD" ? "Continue to card payment" : "Record payment"}
                </button>
              </div>
            </div>
          </div>

          {sales.length > 0 && (
            <div className="order-3 rounded-xl border border-slate-200 bg-white lg:col-span-2">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Recent sales</div>
              <div className="divide-y divide-slate-100">
                {sales.slice(0, 8).map((sale) => (
                  <div key={sale.id} className="flex items-center gap-3 px-4 py-3 text-xs">
                    <span className="font-mono font-semibold text-slate-600">{sale.saleNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-400">{sale.customerName || "Walk-in customer"} · {sale.paymentMethod.toLowerCase()}</span>
                    <span className="font-semibold text-slate-700">{formatPrice(sale.total, sale.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {servicePickerTime && <AvailableServicePicker sid={initial.sid} date={servicePickerTime.date} time={servicePickerTime.time} staffId={servicePickerTime.staffId} services={initial.services} staff={initial.staff}
        onClose={() => setServicePickerTime(null)} onSelect={(serviceId) => { setNewDefaults({ ...servicePickerTime, serviceId }); setServicePickerTime(null); }} />}
      {newDefaults && <AppointmentEditor sid={initial.sid} staff={initial.staff} services={initial.services} countries={initial.countries} defaultCountry={salon.location?.country} defaultDate={newDefaults.date} defaultTime={newDefaults.time} defaultServiceId={newDefaults.serviceId} defaultStaffId={newDefaults.staffId}
        operatingHours={salon.operatingHours} closures={initial.closures} holidays={initial.holidays} schedules={initial.schedules}
        bookingAdvanceDays={salon.bookingAdvanceDays}
        onClose={() => setNewDefaults(null)} onSaved={(booking) => { setBookings((current) => [...current, booking]); setNewDefaults(null); notify("Appointment created."); }} />}
      {selectedBooking && <BookingActions booking={selectedBooking} staff={initial.staff} services={initial.services}
        notificationsEnabled={settings.notificationsEnabled} onClose={() => setSelectedBooking(null)}
        onEdit={() => { setEditTarget(selectedBooking); setSelectedBooking(null); }}
        onNotify={() => { setNotifyTarget(selectedBooking); setSelectedBooking(null); }} onAction={updateBooking} />}
      {editTarget && <AppointmentEditor sid={initial.sid} staff={initial.staff} services={initial.services} countries={initial.countries} defaultCountry={salon.location?.country} booking={editTarget}
        operatingHours={salon.operatingHours} closures={initial.closures} holidays={initial.holidays} schedules={initial.schedules}
        bookingAdvanceDays={salon.bookingAdvanceDays}
        onClose={() => setEditTarget(null)} onSaved={(booking) => { setBookings((current) => current.map((item) => item.id === booking.id ? booking : item)); setEditTarget(null); notify("Appointment updated."); }} />}
      {notifyTarget && <NotificationDialog sid={initial.sid} booking={notifyTarget} defaultMessage={settings.defaultNotification ?? ""}
        onClose={() => setNotifyTarget(null)} onSent={() => { setNotifyTarget(null); notify("Notification queued."); }} />}
      <Toast toast={toast} />
    </div>
  );
}

const JS_DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const STATUS_STYLE: Record<Booking["status"], string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  CONFIRMED: "border-blue-200 bg-blue-50 text-blue-800",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-400 line-through",
  COMPLETED: "border-green-200 bg-green-50 text-green-800",
  NO_SHOW: "border-red-200 bg-red-50 text-red-700",
};

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}
function parseDate(value: string) { return new Date(`${value}T12:00:00`); }
function addDays(date: Date, amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); return next; }
function prettyDate(date: Date, options: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat(undefined, options).format(date); }
function isTimeInPast(date: string, time: string, now = new Date()) {
  if (date < localDateKey(now)) return true;
  if (date > localDateKey(now)) return false;
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) < now.getHours() * 60 + now.getMinutes();
}

function holidayApplies(date: Date, holiday: SalonHoliday) {
  const year = date.getFullYear();
  if (holiday.year != null && holiday.year !== year) return false;
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  const start = holiday.month * 100 + holiday.day;
  const end = (holiday.endMonth ?? holiday.month) * 100 + (holiday.endDay ?? holiday.day);
  return end >= start ? md >= start && md <= end : md >= start || md <= end;
}

function restrictionFor(dateKey: string, hours: OperatingHours[] | undefined, closures: SalonClosure[], holidays: SalonHoliday[], bookingAdvanceDays?: number) {
  const date = parseDate(dateKey);
  if (dateKey < localDateKey()) return "Past date";
  if (bookingAdvanceDays && dateKey > localDateKey(addDays(new Date(), bookingAdvanceDays))) return "Outside booking window";
  const holiday = holidays.find((item) => holidayApplies(date, item));
  if (holiday) return holiday.name;
  const closure = closures.find((item) => dateKey >= item.startDate && dateKey <= item.endDate);
  if (closure) return closure.reason || "Salon closure";
  const dayHours = hours?.find((item) => item.day === JS_DAYS[date.getDay()]);
  if (hours?.length && (!dayHours || dayHours.closed)) return "Closed";
  return null;
}

type StaffScheduleData = { staffId: number; availability: StaffAvailability[]; overrides: StaffAvailabilityOverride[] };

function isSalonOpenAt(dateKey: string, time: string, hours?: OperatingHours[]) {
  if (!hours?.length) return true;
  const dayHours = hours.find((item) => item.day === JS_DAYS[parseDate(dateKey).getDay()]);
  if (!dayHours || dayHours.closed) return false;
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const opening = Number(dayHours.openTime.slice(0, 2)) * 60 + Number(dayHours.openTime.slice(3, 5));
  const closing = Number(dayHours.closeTime.slice(0, 2)) * 60 + Number(dayHours.closeTime.slice(3, 5));
  return minutes >= opening && minutes < closing;
}

function staffWindowAt(member: StaffMember, dateKey: string, time: string, schedules: StaffScheduleData[]) {
  if (member.status !== "ACTIVE" || member.availableForBooking === false) return null;
  const schedule = schedules.find((item) => item.staffId === member.id);
  if (!schedule) return null;
  const toMinutes = (value?: string) => value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : null;
  const minutes = toMinutes(time)!;
  const override = schedule.overrides.find((item) => item.overrideDate === dateKey);
  if (override) {
    const start = toMinutes(override.startTime);
    const end = toMinutes(override.endTime);
    return override.available && start !== null && end !== null && minutes >= start && minutes < end ? { start, end } : null;
  }
  const weekday = JS_DAYS[parseDate(dateKey).getDay()];
  const workingWindows = schedule.availability.filter((item) => item.dayOfWeek === weekday && item.available);
  for (const window of workingWindows) {
    const start = toMinutes(window.startTime);
    const end = toMinutes(window.endTime);
    if (start !== null && end !== null && minutes >= start && minutes < end) return { start, end };
  }
  return null;
}

function hasBookableServiceAtTime(member: StaffMember, date: string, time: string, schedules: StaffScheduleData[], services: ServiceItem[], bookings: Booking[], hours?: OperatingHours[]) {
  const window = staffWindowAt(member, date, time, schedules);
  if (!window) return false;
  const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const dayHours = hours?.find((item) => item.day === JS_DAYS[parseDate(date).getDay()]);
  const salonClose = dayHours && !dayHours.closed
    ? Number(dayHours.closeTime.slice(0, 2)) * 60 + Number(dayHours.closeTime.slice(3, 5))
    : Number.POSITIVE_INFINITY;
  return services.some((service) => {
    const assignedIds = (service.assignedStaffIds ?? []).map(Number);
    const end = start + service.durationMinutes;
    if (!service.active || (assignedIds.length > 0 && !assignedIds.includes(member.id)) || end > window.end || end > salonClose) return false;
    return !bookings.some((booking) => booking.staffId === member.id && booking.status !== "CANCELLED"
      && start < Number(booking.endTime.slice(0, 2)) * 60 + Number(booking.endTime.slice(3, 5))
      && end > Number(booking.startTime.slice(0, 2)) * 60 + Number(booking.startTime.slice(3, 5)));
  });
}

function AppointmentsCalendar({ bookings, staff, services, operatingHours, closures, holidays, schedules, bookingAdvanceDays, searchParams, setSearchParams, onNew, onSelect }: {
  bookings: Booking[]; staff: StaffMember[]; services: ServiceItem[]; operatingHours?: OperatingHours[];
  closures: SalonClosure[]; holidays: SalonHoliday[]; schedules: StaffScheduleData[]; bookingAdvanceDays?: number; searchParams: URLSearchParams;
  setSearchParams: (next: URLSearchParams) => void; onNew: (date: string, time?: string, staffId?: number) => void; onSelect: (booking: Booking) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"overall" | "stylist">("overall");
  const requestedDate = searchParams.get("date");
  const selectedDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : localDateKey();
  const selectedDay = parseDate(selectedDate);
  const staffMap = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);
  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service.name])), [services]);
  const dayBookings = useMemo(() => bookings.filter((booking) => booking.appointmentDate === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [bookings, selectedDate]);
  const restriction = restrictionFor(selectedDate, operatingHours, closures, holidays, bookingAdvanceDays);

  function chooseDate(date: string) {
    const params = new URLSearchParams(searchParams);
    params.set("view", "appointments");
    params.set("date", date);
    params.delete("range");
    setSearchParams(params);
  }

  return <div className={expanded ? "fixed inset-3 z-50 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" : "rounded-xl border border-slate-200 bg-white shadow-sm"}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-1"><button onClick={() => chooseDate(localDateKey(addDays(selectedDay, -1)))} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => chooseDate(localDateKey())} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Today</button><button onClick={() => chooseDate(localDateKey(addDays(selectedDay, 1)))} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Next day"><ChevronRight className="h-4 w-4" /></button></div>
        <div className="min-w-[190px] flex-1"><h2 className="text-sm font-bold text-slate-800">{prettyDate(selectedDay, { weekday: "long", day: "numeric", month: "long" })}</h2><p className="text-xs text-slate-400">{dayBookings.length} {dayBookings.length === 1 ? "appointment" : "appointments"}</p></div>
        <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Booking calendar layout">
          <button type="button" onClick={() => setMode("overall")} aria-pressed={mode === "overall"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "overall" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>Overall</button>
          <button type="button" onClick={() => setMode("stylist")} aria-pressed={mode === "stylist"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "stylist" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>By Stylist</button>
        </div>
        <input type="date" value={selectedDate} onChange={(event) => chooseDate(event.target.value)} aria-label="Choose date" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-matcha-500" />
        <button type="button" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? "Exit expanded calendar" : "Expand calendar"} title={expanded ? "Exit expanded calendar" : "Expand calendar"} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ExpandIcon expanded={expanded} /></button>
      </div>
      <div className={expanded ? "min-h-0 flex-1 overflow-y-auto" : ""}>{mode === "stylist"
        ? <BookByStylistCalendar date={selectedDate} bookings={dayBookings} staff={staff} schedules={schedules} operatingHours={operatingHours} restriction={restriction} services={services} serviceMap={serviceMap} onNew={onNew} onSelect={onSelect} />
        : <TodayCalendar date={selectedDate} bookings={dayBookings} staff={staff} schedules={schedules} operatingHours={operatingHours} restriction={restriction} services={services} serviceMap={serviceMap} staffMap={staffMap} onNew={onNew} onSelect={onSelect} />}</div>
  </div>;
}

function TodayAppointmentsReadOnly({ bookings, staff, services, operatingHours, date, mode, onDateChange, onModeChange }: {
  bookings: Booking[]; staff: StaffMember[]; services: ServiceItem[]; operatingHours?: OperatingHours[];
  date: string; mode: "stylist" | "day"; onDateChange: (date: string) => void; onModeChange: (mode: "stylist" | "day") => void;
}) {
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

  return <section className={expanded ? "fixed inset-3 z-50 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl" : "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"}>
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
      <div className="min-w-[180px] flex-1"><h2 className="text-sm font-bold text-slate-800">{prettyDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><p className="text-xs text-slate-400">{dayBookings.length} {dayBookings.length === 1 ? "appointment" : "appointments"} · Read only</p></div>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Date<input type="date" value={date} onChange={(event) => event.target.value && onDateChange(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-matcha-500" /></label>
      <button type="button" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? "Exit expanded calendar" : "Expand calendar"} title={expanded ? "Exit expanded calendar" : "Expand calendar"} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ExpandIcon expanded={expanded} /></button>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-100 px-4 py-2.5">
      <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Appointment overview layout">
        <button type="button" onClick={() => onModeChange("stylist")} aria-pressed={mode === "stylist"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "stylist" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>By Stylist</button>
        <button type="button" onClick={() => onModeChange("day")} aria-pressed={mode === "day"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "day" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>Overall view</button>
      </div>
    </div>
    {mode === "stylist" ? <StylistSchedule date={date} groups={grouped} operatingHours={operatingHours} services={serviceMap} />
      : dayBookings.length ? <ReadOnlyDayTimeline date={date} bookings={dayBookings} services={serviceMap} staff={staffMap} operatingHours={operatingHours} closed={!!dayHours?.closed} />
        : <p className="px-4 py-12 text-center text-sm text-slate-400">No appointments scheduled for this date.</p>}
  </section>;
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />;
}

function StaffAvatar({ member, size = "sm" }: { member?: StaffMember; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "h-9 w-9 text-xs" : "h-6 w-6 text-[9px]";
  return <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-500 ${sizeClass}`} title={member?.name ?? "Stylist"} aria-hidden="true">
    <span>{member?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?"}</span>
    {member?.avatarUrl && <img src={member.avatarUrl} alt="" className="absolute inset-0 h-full w-full rounded-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
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

function ReadOnlyDayTimeline({ date, bookings, services, staff, operatingHours, closed }: {
  date: string; bookings: Booking[]; services: Map<number, string>; staff: Map<number, StaffMember>;
  operatingHours?: OperatingHours[]; closed: boolean;
}) {
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
    {closed && <p className="bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">Salon is marked closed today. Existing appointments are shown below.</p>}
    {slots.map((minutes) => <div key={minutes} className="flex min-h-12"><span className="sticky left-0 z-10 w-20 shrink-0 border-r border-slate-100 bg-white px-3 py-3 text-right text-[11px] font-medium tabular-nums text-slate-400">{minutes % 60 === 0 ? `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00` : ""}</span><div className="min-w-0 flex-1 space-y-1 px-2 py-1">{(bookedAt.get(minutes) ?? []).map((booking) => { const member = staff.get(booking.staffId); const past = isTimeInPast(date, booking.startTime); return <div key={booking.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 ${past ? "border-slate-200 bg-slate-100 text-slate-400" : STATUS_STYLE[booking.status]}`}><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)} · {booking.customerName}</p><p className="truncate text-[10px] opacity-75">{services.get(booking.serviceId) ?? "Service"} · {member?.name ?? "Staff"}</p></div><StaffAvatar member={member} /></div>; })}</div></div>)}
  </div>;
}

function StylistSchedule({ date, groups, operatingHours, services }: {
  date: string; groups: { member: StaffMember; appointments: Booking[] }[];
  operatingHours?: OperatingHours[]; services: Map<number, string>;
}) {
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
    {hasOverflow && <p className="mx-4 mt-3 flex w-fit items-center rounded-full border border-matcha-200 bg-matcha-50 px-2.5 py-1.5 text-[11px] font-semibold text-matcha-800">Scroll to see all stylists</p>}
    {!groups.length ? <p className="px-4 py-12 text-center text-sm text-slate-400">No active stylists are available.</p> : <div className="flex min-w-0 px-4 pb-4 pt-3">
      <div className="sticky left-0 z-20 w-16 shrink-0 border-r border-slate-200 bg-white">
        <div className="flex h-11 items-center justify-center border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">Time</div>
        {times.map((minutes) => <div key={minutes} className="h-16 border-b border-slate-100 pr-2 pt-1 text-right text-[10px] font-medium tabular-nums text-slate-400">{minutes % 60 === 0 ? `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00` : ""}</div>)}
      </div>
      <div className="relative min-w-0 flex-1">
      <div ref={columnsRef} className="min-w-0 overflow-x-auto">
        <div className="grid auto-cols-[240px] grid-flow-col gap-3">
          {groups.map(({ member, appointments }) => <section key={member.id} className="overflow-hidden rounded-lg border border-slate-200">
            <h3 className="flex h-11 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-700"><span className="flex min-w-0 items-center gap-2"><StaffAvatar member={member} /><span className="truncate">{member.name}</span></span><span className="shrink-0 font-normal text-slate-400">{appointments.length}</span></h3>
            {times.map((minutes) => {
              const rowBookings = appointments.filter((booking) => Math.floor(toMinutes(booking.startTime) / 30) * 30 === minutes);
              return <div key={minutes} className="h-16 overflow-hidden border-b border-slate-100 px-1 py-1">
                {rowBookings.map((booking) => { const past = isTimeInPast(date, booking.startTime); return <div key={booking.id} className={`truncate rounded border px-2 py-1 text-[10px] ${past ? "border-slate-200 bg-slate-100 text-slate-400" : STATUS_STYLE[booking.status]}`} title={`${booking.startTime.slice(0, 5)} ${booking.customerName} · ${services.get(booking.serviceId) ?? "Service"}`}>
                  <p className="truncate font-bold">{booking.startTime.slice(0, 5)} · {booking.customerName}</p><p className="truncate opacity-75">{services.get(booking.serviceId) ?? "Service"}</p>
                </div>; })}
              </div>;
            })}
          </section>)}
        </div>
      </div>
      {floatingPosition && canScrollLeft && <button type="button" onClick={() => columnsRef.current?.scrollBy({ left: -Math.max(240, columnsRef.current.clientWidth * 0.75), behavior: "smooth" })} aria-label="Scroll to previous stylists" style={{ position: "fixed", top: floatingPosition.top, left: floatingPosition.left }} className="z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xl transition hover:scale-105 hover:bg-slate-50"><ChevronLeft className="h-6 w-6" /></button>}
      {floatingPosition && canScrollRight && <button type="button" onClick={() => columnsRef.current?.scrollBy({ left: Math.max(240, columnsRef.current.clientWidth * 0.75), behavior: "smooth" })} aria-label="Scroll to more stylists" style={{ position: "fixed", top: floatingPosition.top, left: floatingPosition.right }} className="z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xl transition hover:scale-105 hover:bg-slate-50"><ChevronRight className="h-6 w-6" /></button>}
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

function BookByStylistCalendar({ date, bookings, staff, schedules, operatingHours, restriction, services, serviceMap, onNew, onSelect }: {
  date: string; bookings: Booking[]; staff: StaffMember[]; schedules: StaffScheduleData[]; operatingHours?: OperatingHours[]; restriction: string | null;
  services: ServiceItem[]; serviceMap: Map<number, string>; onNew: (date: string, time?: string, staffId?: number) => void; onSelect: (booking: Booking) => void;
}) {
  const columnsRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const floatingPosition = useFloatingScrollPosition(anchorRef, canScrollLeft || canScrollRight);
  const dayHours = operatingHours?.find((item) => item.day === JS_DAYS[parseDate(date).getDay()]);
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const formatTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const opening = dayHours && !dayHours.closed ? toMinutes(dayHours.openTime) : 8 * 60;
  const closing = dayHours && !dayHours.closed ? toMinutes(dayHours.closeTime) : 20 * 60;
  const scheduled = bookings.map((booking) => toMinutes(booking.startTime));
  const start = Math.min(Math.floor(opening / 30) * 30, ...scheduled.map((value) => Math.floor(value / 30) * 30));
  const end = Math.max(Math.ceil(closing / 30) * 30, ...scheduled.map((value) => Math.floor(value / 30) * 30 + 30));
  const slots = Array.from({ length: Math.max(1, (end - start) / 30) }, (_, index) => start + index * 30);
  const activeStaff = staff.filter((member) => member.status === "ACTIVE");

  useEffect(() => {
    const columns = columnsRef.current;
    if (!columns) return;
    const update = () => {
      setCanScrollLeft(columns.scrollLeft > 1);
      setCanScrollRight(columns.scrollLeft + columns.clientWidth < columns.scrollWidth - 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(columns);
    columns.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); columns.removeEventListener("scroll", update); };
  }, [activeStaff.length]);

  return <div ref={anchorRef}>
    {restriction && <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3"><XCircle className="h-4 w-4 shrink-0 text-amber-500" /><div><p className="text-xs font-semibold text-amber-800">{restriction}</p><p className="text-[11px] text-amber-600">Existing appointments are shown; new appointments cannot be added for this date.</p></div></div>}
    {!activeStaff.length ? <p className="px-4 py-12 text-center text-sm text-slate-400">No active stylists are available.</p> : <div className="flex min-w-0 px-4 pb-4 pt-3">
      <div className="sticky left-0 z-20 w-20 shrink-0 border-r border-slate-200 bg-white">
        <div className="flex h-12 items-center justify-center border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">Time</div>
        {slots.map((minutes) => <div key={minutes} className="h-14 border-b border-slate-100 pr-2 pt-1 text-right text-[10px] font-medium tabular-nums text-slate-400">{minutes % 60 === 0 ? formatTime(minutes) : ""}</div>)}
      </div>
      <div className="relative min-w-0 flex-1">
        <div ref={columnsRef} className="overflow-x-auto">
          <div className="grid auto-cols-[220px] grid-flow-col gap-2">
            {activeStaff.map((member) => <section key={member.id} className="overflow-hidden rounded-lg border border-slate-200">
              <h3 className="flex h-12 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700"><StaffAvatar member={member} size="md" /><span className="truncate">{member.name}</span></h3>
              {slots.map((minutes) => {
                const time = formatTime(minutes);
                const slotBookings = bookings.filter((booking) => booking.staffId === member.id && Math.floor(toMinutes(booking.startTime) / 30) * 30 === minutes);
                const passed = isTimeInPast(date, time);
                const staffWorking = hasBookableServiceAtTime(member, date, time, schedules, services, bookings, operatingHours);
                const salonOpen = isSalonOpenAt(date, time, operatingHours);
                const bookable = !restriction && !passed && salonOpen && staffWorking;
                return <div key={minutes} className="flex h-14 flex-col justify-center gap-0.5 overflow-hidden border-b border-slate-100 px-1 py-1">
                  {slotBookings.map((booking) => {
                    const bookingPassed = isTimeInPast(date, booking.startTime);
                    return <button key={booking.id} type="button" disabled={bookingPassed} onClick={() => onSelect(booking)} className={`truncate rounded border px-2 py-1 text-left text-[10px] disabled:cursor-not-allowed ${bookingPassed ? "border-slate-200 bg-slate-100 text-slate-400" : STATUS_STYLE[booking.status]}`}><span className="font-bold">{booking.startTime.slice(0, 5)} · {booking.customerName}</span><span className="ml-1 opacity-75">{serviceMap.get(booking.serviceId)}</span></button>;
                  })}
                  {!slotBookings.length && <button type="button" disabled={!bookable} onClick={() => onNew(date, time, member.id)} aria-label={`Book ${member.name} at ${time}`} title={!bookable ? restriction || (passed ? "This time has passed" : !salonOpen ? "Outside salon opening hours" : "Stylist is unavailable") : `Book ${member.name} at ${time}`} className={`h-full w-full rounded px-2 text-left text-[10px] font-medium transition-colors disabled:cursor-not-allowed ${bookable ? "text-slate-400 hover:bg-matcha-50 hover:text-matcha-700 focus-visible:bg-matcha-50 focus-visible:text-matcha-700" : "bg-slate-50 text-slate-300"}`}>{bookable ? "+ Book" : "Unavailable"}</button>}
                </div>;
              })}
            </section>)}
          </div>
        </div>
        {floatingPosition && canScrollLeft && <button type="button" onClick={() => columnsRef.current?.scrollBy({ left: -Math.max(240, columnsRef.current.clientWidth * 0.75), behavior: "smooth" })} aria-label="Scroll to previous stylists" style={{ position: "fixed", top: floatingPosition.top, left: floatingPosition.left }} className="z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xl transition hover:scale-105 hover:bg-slate-50"><ChevronLeft className="h-6 w-6" /></button>}
        {floatingPosition && canScrollRight && <button type="button" onClick={() => columnsRef.current?.scrollBy({ left: Math.max(240, columnsRef.current.clientWidth * 0.75), behavior: "smooth" })} aria-label="Scroll to more stylists" style={{ position: "fixed", top: floatingPosition.top, left: floatingPosition.right }} className="z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xl transition hover:scale-105 hover:bg-slate-50"><ChevronRight className="h-6 w-6" /></button>}
      </div>
    </div>}
  </div>;
}

function TodayCalendar({ date, bookings, staff, schedules, operatingHours, restriction, services, serviceMap, staffMap, onNew, onSelect }: { date: string; bookings: Booking[]; staff: StaffMember[]; schedules: StaffScheduleData[]; operatingHours?: OperatingHours[]; restriction: string | null; services: ServiceItem[]; serviceMap: Map<number, string>; staffMap: Map<number, StaffMember>; onNew: (date: string, time?: string, staffId?: number) => void; onSelect: (booking: Booking) => void }) {
  const dayHours = operatingHours?.find((item) => item.day === JS_DAYS[parseDate(date).getDay()]);
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const formatTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const openingMinutes = dayHours && !dayHours.closed ? toMinutes(dayHours.openTime) : 8 * 60;
  const closingMinutes = dayHours && !dayHours.closed ? toMinutes(dayHours.closeTime) : 20 * 60;
  const scheduledMinutes = bookings.map((booking) => toMinutes(booking.startTime));
  const start = Math.min(Math.floor(openingMinutes / 30) * 30, ...scheduledMinutes.map((minutes) => Math.floor(minutes / 30) * 30));
  const end = Math.max(Math.ceil(closingMinutes / 30) * 30, ...scheduledMinutes.map((minutes) => Math.floor(minutes / 30) * 30 + 30));
  const slots = Array.from({ length: Math.max(1, (end - start) / 30) }, (_, index) => start + index * 30);
  return <div>
    {restriction && <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3"><XCircle className="h-4 w-4 shrink-0 text-amber-500" /><div><p className="text-xs font-semibold text-amber-800">{restriction}</p><p className="text-[11px] text-amber-600">Existing appointments remain available, but new appointments cannot be added.</p></div></div>}
    <div className="divide-y divide-slate-100">{slots.map((minutes) => {
      const time = formatTime(minutes);
      const inSlot = bookings.filter((booking) => Math.floor(toMinutes(booking.startTime) / 30) * 30 === minutes);
      const slotPassed = isTimeInPast(date, time);
      const salonOpen = isSalonOpenAt(date, time, operatingHours);
      const anyStaffWorking = staff.some((member) => hasBookableServiceAtTime(member, date, time, schedules, services, bookings, operatingHours));
      const canBook = !restriction && !slotPassed && salonOpen && anyStaffWorking;
      return <div key={minutes} className={`group flex min-h-12 ${!canBook && !inSlot.length ? "bg-slate-50" : ""}`}>
        <span className={`sticky left-0 z-10 w-20 shrink-0 border-r border-slate-100 bg-white px-3 py-3 text-right text-[11px] font-medium tabular-nums ${slotPassed ? "text-slate-300" : "text-slate-400"}`}>{minutes % 60 === 0 ? time : ""}</span>
        <HorizontalScrollCue label="More appointments in this time slot">
          {inSlot.map((booking) => {
            const bookingPassed = isTimeInPast(date, booking.startTime);
            return <button key={booking.id} type="button" disabled={bookingPassed} onClick={() => onSelect(booking)} className={`min-h-10 w-56 shrink-0 rounded-md border px-3 py-2 text-left disabled:cursor-not-allowed ${bookingPassed ? "border-slate-200 bg-slate-100 text-slate-400" : STATUS_STYLE[booking.status]}`}>
            <span className="block truncate text-xs font-bold">{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)} · {booking.customerName}</span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] opacity-75"><StaffAvatar member={staffMap.get(booking.staffId)} /><span className="truncate">{serviceMap.get(booking.serviceId)} · {staffMap.get(booking.staffId)?.name ?? "Stylist"}</span></span>
            </button>;
          })}
          {!slotPassed && <button type="button" disabled={!canBook} onClick={() => onNew(date, time)} aria-label={`Book at ${time}`} title={!canBook ? restriction || (!salonOpen ? "Outside salon opening hours" : !anyStaffWorking ? "No stylist is available at this time" : "This time has passed") : `Book at ${time}`} className={`flex min-h-9 w-36 shrink-0 items-center rounded-md px-3 text-left text-xs transition-colors disabled:cursor-not-allowed ${canBook ? "text-slate-400 hover:bg-matcha-50 hover:text-matcha-700 focus:bg-matcha-50 focus:text-matcha-700" : "bg-slate-50 text-slate-300"}`}>
            <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">+ Book at {time}</span>
          </button>}
        </HorizontalScrollCue>
      </div>;
    })}</div>
  </div>;
}

function HorizontalScrollCue({ children, label }: { children: React.ReactNode; label: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      setCanScrollLeft(element.scrollLeft > 1);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [children]);
  return <div className="relative min-w-0 flex-1">
    <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden">
      <div className="flex w-max min-w-full items-start gap-2 px-2 py-1">{children}</div>
    </div>
    {canScrollLeft && <button type="button" title={label} aria-label="Scroll to previous appointments" onClick={() => scrollRef.current?.scrollBy({ left: -Math.max(224, scrollRef.current.clientWidth * 0.75), behavior: "smooth" })} className="absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:scale-105 hover:bg-slate-50"><ChevronLeft className="h-5 w-5" /></button>}
    {canScrollRight && <button type="button" title={label} aria-label="Scroll to more appointments" onClick={() => scrollRef.current?.scrollBy({ left: Math.max(224, scrollRef.current.clientWidth * 0.75), behavior: "smooth" })} className="absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:scale-105 hover:bg-slate-50"><ChevronRight className="h-5 w-5" /></button>}
  </div>;
}

function BookingActions({ booking, staff, services, notificationsEnabled, onClose, onEdit, onNotify, onAction }: { booking: Booking; staff: StaffMember[]; services: ServiceItem[]; notificationsEnabled: boolean; onClose: () => void; onEdit: () => void; onNotify: () => void; onAction: (id: number, action: "confirm" | "cancel" | "complete" | "no-show") => Promise<void> }) {
  const service = services.find((item) => item.id === booking.serviceId); const member = staff.find((item) => item.id === booking.staffId); const active = booking.status === "PENDING" || booking.status === "CONFIRMED";
  const confirmAction = (action: "cancel" | "no-show", message: string) => {
    if (window.confirm(message)) void onAction(booking.id, action);
  };
  return <Dialog title={`${booking.customerName} · #${booking.id}`} onClose={onClose}><div className="space-y-4"><div className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-800">{booking.appointmentDate}</p><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${STATUS_STYLE[booking.status]}`}>{booking.status.replace("_", " ")}</span></div><p className="mt-1 text-sm text-slate-600">{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)} · {service?.name ?? "Service"}</p><p className="mt-1 text-xs text-slate-400">{member?.name ?? "Staff"} · {booking.customerEmail}{booking.customerPhone ? ` · ${booking.customerPhone}` : ""}</p>{booking.notes && <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">{booking.notes}</p>}</div><div className="grid grid-cols-2 gap-2"><button onClick={onEdit} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Edit / reschedule</button>{notificationsEnabled && <button onClick={onNotify} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Bell className="h-3.5 w-3.5" />Notify customer</button>}{booking.status === "PENDING" && <button onClick={() => onAction(booking.id, "confirm")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" />Confirm</button>}{booking.status === "CONFIRMED" && <><button onClick={() => onAction(booking.id, "complete")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" />Complete</button><button onClick={() => confirmAction("no-show", `Mark ${booking.customerName} as a no-show?`)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">Mark no-show</button></>}{active && <button onClick={() => confirmAction("cancel", `Cancel ${booking.customerName}'s appointment?`)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><XCircle className="h-3.5 w-3.5" />Cancel booking</button>}</div></div></Dialog>;
}

function AvailableServicePicker({ sid, date, time, staffId, services, staff, onClose, onSelect }: {
  sid: string; date: string; time: string; staffId?: number; services: ServiceItem[]; staff: StaffMember[];
  onClose: () => void; onSelect: (serviceId: number) => void;
}) {
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

  return <Dialog title="Choose a service" onClose={onClose}>
    <div className="space-y-3">
      <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-xs font-semibold text-slate-700">{prettyDate(parseDate(date), { weekday: "long", day: "numeric", month: "long" })} at {time}</p><p className="text-[11px] text-slate-400">{staffId ? `Services available with ${staff.find((member) => member.id === staffId)?.name ?? "this stylist"} are shown.` : "Only services available at this time are shown."}</p></div>
      {timeHasPassed ? <p className="py-8 text-center text-sm text-slate-400">This time has already passed. Choose another time.</p>
        : loading ? <p className="py-8 text-center text-sm text-slate-400">Checking available services…</p>
        : available.length ? <div className="max-h-[55vh] space-y-2 overflow-y-auto">{available.map(({ service, staffIds }) => {
          const availableStaff = staff.filter((member) => staffIds.includes(member.id) && member.status === "ACTIVE");
          return <button key={service.id} type="button" onClick={() => onSelect(service.id)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-matcha-400 hover:bg-matcha-50 focus:outline-none focus:ring-2 focus:ring-matcha-500">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{service.name}</p><p className="mt-0.5 text-xs text-slate-400">{service.durationMinutes} min · {availableStaff.map((member) => member.name).join(", ") || `${staffIds.length} available ${staffIds.length === 1 ? "stylist" : "stylists"}`}</p></div>
            <span className="shrink-0 text-xs font-semibold text-slate-700">{formatPrice(service.price, service.currency)}</span>
          </button>;
        })}</div>
        : <div className="py-8 text-center"><p className="text-sm font-medium text-slate-600">No services are available at {time}.</p><p className="mt-1 text-xs text-slate-400">Choose another time to see available services.</p>{failed && <p className="mt-2 text-[11px] text-red-500">Some availability checks could not be completed.</p>}</div>}
      <div className="flex justify-end border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button></div>
    </div>
  </Dialog>;
}

function AppointmentEditor({ sid, staff, services, countries, defaultCountry, booking, defaultDate, defaultTime, defaultServiceId, defaultStaffId, operatingHours, closures, holidays, schedules, bookingAdvanceDays, onClose, onSaved }: {
  sid: string; staff: StaffMember[]; services: ServiceItem[]; countries: Country[]; defaultCountry?: string; booking?: Booking; defaultDate?: string; defaultTime?: string; defaultServiceId?: number; defaultStaffId?: number;
  operatingHours?: OperatingHours[]; closures: SalonClosure[]; holidays: SalonHoliday[]; bookingAdvanceDays?: number;
  schedules: { staffId: number; availability: StaffAvailability[]; overrides: StaffAvailabilityOverride[] }[];
  onClose: () => void; onSaved: (booking: Booking) => void;
}) {
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
  return <Dialog title={booking ? "Edit appointment" : "Book appointment"} onClose={onClose}>
    <div className="space-y-3">
      {!booking && <><CustomerDetailsFields
        form={{ name: form.customerName, email: form.customerEmail, phone: form.customerPhone, notes: form.notes }}
        onChange={(details) => setForm({ ...form, customerName: details.name, customerEmail: details.email, customerPhone: details.phone, notes: details.notes })}
        contactMethod={contactMethod} onContactMethodChange={setContactMethod}
        countries={countries} defaultCountry={defaultCountry}
      /><select className={inputCls} value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: Number(e.target.value), staffId: 0 })}>{services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></>}
      <input type="date" min={booking ? undefined : localDateKey()} className={inputCls} value={form.appointmentDate} onChange={(e) => setForm({ ...form, appointmentDate: e.target.value, startTime: "" })} />
      {salonRestriction && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">{salonRestriction} — select another date.</p>}
      <div className="grid grid-cols-2 gap-3"><select className={inputCls} value={form.staffId || ""} onChange={(e) => { const staffId = Number(e.target.value); const originalTime = !!booking && staffId === booking.staffId && form.appointmentDate === booking.appointmentDate; const timeIsAvailable = slots.some((slot) => slot.staffId === staffId && slot.startTime.slice(0, 5) === form.startTime); setForm({ ...form, staffId, startTime: timeIsAvailable || originalTime || (hasCalendarTime && !staffId) ? form.startTime : "" }); }}><option value="">{loadingSlots ? "Loading stylists…" : hasCalendarTime ? "Any available stylist — auto-assign" : "Select stylist"}</option>{eligibleStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{hasCalendarTime
        ? <div className={`${inputCls} flex items-center justify-between bg-slate-50 text-slate-700`} aria-label="Selected appointment time"><span>{form.startTime || "Selected time"}</span><span className="text-[10px] font-medium text-slate-400">From calendar</span></div>
        : <select className={inputCls} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} disabled={!form.staffId || !!restriction}><option value="">{loadingSlots ? "Loading times…" : "Select time"}</option>{timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}</select>}</div>
      {selectedTimePassed && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">This time has already passed. Choose a later time.</p>}
      {staffRestriction && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">{staffRestriction}.</p>}
      {!loadingSlots && !salonRestriction && slots.length === 0 && !originalSlot && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">No bookable slots remain for this service and date.</p>}
      {booking && <textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" />}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 cursor-pointer">Cancel</button><button onClick={save} disabled={saving || loadingSlots || (!booking && !hasContact) || (!form.staffId && !hasCalendarTime) || !form.serviceId || !form.startTime || !validSlot || selectedTimePassed || (!!restriction && !originalSlot)} className="rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 cursor-pointer">{saving ? "Saving…" : "Save appointment"}</button></div>
    </div>
  </Dialog>;
}

function NotificationDialog({ sid, booking, defaultMessage, onClose, onSent }: { sid: string; booking: Booking; defaultMessage: string; onClose: () => void; onSent: () => void }) {
  const [custom, setCustom] = useState(false); const [message, setMessage] = useState(defaultMessage); const [sending, setSending] = useState(false); const [error, setError] = useState("");
  async function send() { setSending(true); setError(""); try { await apiFetch(`${ADMIN_API}/${sid}/dashboard/bookings/${booking.id}/notifications`, { method: "POST", body: JSON.stringify({ message: custom ? message : null }) }); onSent(); } catch (err) { setError(err instanceof Error ? err.message : "Could not send notification"); } finally { setSending(false); } }
  return <Dialog title={`Notify ${booking.customerName}`} onClose={onClose}><div className="space-y-3"><p className="text-sm text-slate-500">Send the configured default message or customise it for this appointment.</p><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} /> Customise message</label>{custom && <textarea className={inputCls} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />}{error && <p className="text-xs font-medium text-red-600">{error}</p>}<div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 cursor-pointer">Cancel</button><button onClick={send} disabled={sending || (custom && !message.trim())} className="inline-flex items-center gap-2 rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 cursor-pointer"><Bell className="h-4 w-4" /> {sending ? "Sending…" : custom ? "Send custom message" : "Send default message"}</button></div></div></Dialog>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}><div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4"><h2 className="font-bold text-slate-900">{title}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}
