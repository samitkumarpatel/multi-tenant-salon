import { useI18n } from "@salon/i18n";
import { useEffect, useState } from "react";
import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { ArrowLeft, Ban, Mail, MessageSquarePlus, Printer, RotateCcw, Send } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { Toast, useToast } from "@salon/ui-shared";
import { Modal, ModalActions } from "~/components/ShopModal";
import { MembershipStatusBadge, renewalLine } from "~/components/MembershipStatusBadge";
import { INTERVAL_LABEL, fmtDate, fmtDateTime, memberQrUrl, planPrice } from "~/lib/membership";
import { formatPrice } from "~/lib/constants";
import type { MembershipActivityType, MembershipDetail } from "~/lib/types";
import type { MembershipOutletContext } from "./membership";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const detail = await apiFetch<MembershipDetail>(`${ADMIN_API}/${sid}/membership/subscriptions/${params.subscriptionId}`);
  return { sid, detail };
}

const ACTIVITY_DOT: Record<MembershipActivityType, string> = {
  CHECKOUT_STARTED: "bg-slate-300",
  CHECKOUT_FAILED: "bg-slate-400",
  ACTIVATED: "bg-green-500",
  RENEWAL_STARTED: "bg-slate-300",
  RENEWED: "bg-green-400",
  PAYMENT_FAILED: "bg-red-500",
  EXPIRED: "bg-amber-400",
  CANCELLATION_SCHEDULED: "bg-amber-500",
  CANCELLATION_UNDONE: "bg-sky-500",
  CANCELLED: "bg-red-400",
  CUSTOMER_NOTIFIED: "bg-indigo-400",
  NOTE: "bg-slate-500",
};

const PAYMENT_LABEL = { PENDING: "Awaiting payment", PAID: "Paid", FAILED: "Not completed" } as const;
const PAYMENT_TONE = { PENDING: "text-slate-500", PAID: "text-green-700", FAILED: "text-red-600" } as const;

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const btnCls =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer disabled:opacity-40";

export default function MembershipMember() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  useOutletContext<MembershipOutletContext>();
  const { sid, detail: init } = useLoaderData<typeof clientLoader>();
  const [detail, setDetail] = useState<MembershipDetail>(init);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"cancel" | "note" | null>(null);
  const [atPeriodEnd, setAtPeriodEnd] = useState(true);
  const [text, setText] = useState("");
  const { toast, notify } = useToast();
  const m = detail.subscription;
  const current = m.status === "ACTIVE";
  const renewable = m.status === "ACTIVE" || m.status === "EXPIRED";
  const base = `${ADMIN_API}/${sid}/membership/subscriptions/${m.id}`;

  useEffect(() => { setDetail(init); }, [init]);
  useEffect(() => {
    let url: string | null = null;
    memberQrUrl(sid, m.id).then((u) => { url = u; setQr(u); }).catch(() => setQr(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [sid, m.id]);

  async function act(path: string, body: unknown, success: string) {
    setBusy(true);
    try {
      const next = await apiFetch<MembershipDetail>(`${base}/${path}`, { method: "POST", body: body == null ? undefined : JSON.stringify(body) });
      setDetail(next);
      setModal(null);
      setText("");
      notify(translateUi(success));
    } catch (e) {
      notify(e instanceof Error ? e.message : translateUi("Something went wrong"), "error");
    } finally {
      setBusy(false);
    }
  }

  function printCard() {
    if (!qr) return;
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    w.document.write(`<!doctype html><title>${esc(m.memberCode)}</title><body style="font-family:system-ui;text-align:center;padding:24px">
      <h2 style="margin:0">${esc(m.customerName)}</h2><p style="color:#64748b;margin:4px 0 16px">${esc(m.planName)}</p>
      <img src="${qr}" width="240" height="240" alt=""><p style="font-family:monospace;font-size:20px;letter-spacing:2px">${esc(m.memberCode)}</p>
      <script>window.onload=()=>{window.print()}</script></body>`);
    w.document.close();
  }

  return (
    <div className="space-y-5">
      <Link to="../members" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 no-underline">
        <ArrowLeft className="w-3.5 h-3.5" /> {translateUi("All members")}
      </Link>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{m.customerName}</h2>
            <MembershipStatusBadge status={m.status} />
            {m.cancelAtPeriodEnd && current && (
              <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                {translateUi("Cancels {date}", { date: fmtDate(m.currentPeriodEnd, uiLocale) })}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            <a href={`mailto:${m.customerEmail}`} className="text-slate-600">{m.customerEmail}</a>
            {m.customerPhone && <> · <a href={`tel:${m.customerPhone}`} className="text-slate-600">{m.customerPhone}</a></>}
          </p>

          <dl className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <Field label="Plan" value={m.planName} />
            <Field label="Price" value={planPrice(m.price, m.currency, m.billingInterval, uiLocale)} />
            <Field label="Billing" value={translateUi(INTERVAL_LABEL[m.billingInterval])} />
            <Field label="Member since" value={fmtDate(m.startedAt, uiLocale)} />
            <Field label="Next" value={renewalLine(m, translateUi, uiLocale)} />
            <Field label="Last payment" value={m.lastPaymentStatus
              ? `${m.lastPaymentStatus === "PAID" ? translateUi("Paid") : translateUi("Failed")} · ${fmtDate(m.lastPaymentAt, uiLocale)}`
              : translateUi("No payment yet")} tone={m.lastPaymentStatus === "FAILED" ? "bad" : undefined} />
            {m.signupFee ? <Field label="Sign-up fee" value={formatPrice(m.signupFee, m.currency, uiLocale)} /> : null}
            {m.cancelReason && <Field label="Cancellation reason" value={m.cancelReason} />}
            {m.renewalReminderFor && m.renewalReminderFor === m.currentPeriodEnd && (
              <Field label="Renewal reminder" value={translateUi("Sent for this period")} />
            )}
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            {renewable && !m.cancelAtPeriodEnd && (
              <button className={btnCls} disabled={busy} onClick={() => act("send-renewal-link", null, "Renewal link sent")}>
                <Send className="w-3.5 h-3.5" /> {translateUi("Send renewal link")}
              </button>
            )}
            {renewable && !m.cancelAtPeriodEnd && (
              <button className={`${btnCls} border-red-200 text-red-600 hover:bg-red-50`} disabled={busy}
                onClick={() => { setAtPeriodEnd(current); setText(""); setModal("cancel"); }}>
                <Ban className="w-3.5 h-3.5" /> {translateUi("Cancel membership")}
              </button>
            )}
            {current && m.cancelAtPeriodEnd && (
              <>
                <button className={btnCls} disabled={busy} onClick={() => act("resume", null, "Cancellation undone")}>
                  <RotateCcw className="w-3.5 h-3.5" /> {translateUi("Undo cancellation")}
                </button>
                <button className={`${btnCls} border-red-200 text-red-600 hover:bg-red-50`} disabled={busy}
                  onClick={() => { setAtPeriodEnd(false); setText(""); setModal("cancel"); }}>
                  <Ban className="w-3.5 h-3.5" /> {translateUi("End now")}
                </button>
              </>
            )}
            {current && (
              <button className={btnCls} disabled={busy} onClick={() => act("resend-welcome", null, "QR code email sent")}>
                <Mail className="w-3.5 h-3.5" /> {translateUi("Resend QR email")}
              </button>
            )}
            <button className={btnCls} disabled={busy} onClick={() => { setText(""); setModal("note"); }}>
              <MessageSquarePlus className="w-3.5 h-3.5" /> {translateUi("Add note")}
            </button>
          </div>
        </div>

        <div className="sm:w-44 shrink-0 flex flex-col items-center text-center">
          <div className="w-40 h-40 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
            {qr ? <img src={qr} alt={translateUi("Member QR code")} className="w-full h-full" /> : <span className="text-xs text-slate-300">QR</span>}
          </div>
          <p className="mt-2 font-mono text-sm tracking-widest text-slate-800">{m.memberCode}</p>
          <button className={`${btnCls} mt-2`} disabled={!qr} onClick={printCard}>
            <Printer className="w-3.5 h-3.5" /> {translateUi("Print card")}
          </button>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <h3 className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-800">{translateUi("Payments")}</h3>
          {detail.payments.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-slate-400">{translateUi("No payments yet.")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {detail.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span>
                    <span className={`text-sm font-medium ${PAYMENT_TONE[p.status]}`}>
                      {translateUi(PAYMENT_LABEL[p.status])} {formatPrice(p.amount, p.currency, uiLocale)}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {translateUi(p.kind === "SIGNUP" ? "Sign-up" : "Renewal")}
                      {p.periodStart && p.periodEnd && ` · ${fmtDate(p.periodStart, uiLocale)} – ${fmtDate(p.periodEnd, uiLocale)}`}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500 text-right">
                    {fmtDateTime(p.paidAt ?? p.createdAt, uiLocale)}
                    {p.checkoutSessionId && <span className="block font-mono text-[10px] text-slate-300 max-w-[160px] truncate">{p.checkoutSessionId}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <h3 className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-800">{translateUi("Timeline")}</h3>
          <ol className="px-5 py-4 space-y-3">
            {[...detail.activity].reverse().map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${ACTIVITY_DOT[a.type]}`} />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-700 break-words">{a.message}</span>
                  <span className="block text-[11px] text-slate-400">{fmtDateTime(a.createdAt, uiLocale)} · {a.actor}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {modal === "cancel" && (
        <Modal title={translateUi("Cancel membership")} onClose={() => setModal(null)}>
          {!m.cancelAtPeriodEnd && current && (
            <div className="space-y-2 mb-4">
              <Choice checked={atPeriodEnd} onChange={() => setAtPeriodEnd(true)}
                title={translateUi("At the end of the paid period")}
                hint={translateUi("Stays active until {date}, then ends. No renewal reminder is sent.", { date: fmtDate(m.currentPeriodEnd, uiLocale) })} />
              <Choice checked={!atPeriodEnd} onChange={() => setAtPeriodEnd(false)}
                title={translateUi("Immediately")}
                hint={translateUi("Ends today. No refund is issued automatically — refund in Stripe if needed.")} />
            </div>
          )}
          {m.cancelAtPeriodEnd && (
            <p className="text-sm text-slate-600 mb-4">{translateUi("End this membership today instead of at the end of the period? No refund is issued automatically.")}</p>
          )}
          {m.status === "EXPIRED" && (
            <p className="text-sm text-slate-600 mb-4">{translateUi("This membership has expired. Cancelling it stops the member from renewing with their link.")}</p>
          )}
          <label className="block text-sm font-medium text-slate-700 mb-1">{translateUi("Reason (internal)")}</label>
          <input className={inputCls} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
          <p className="text-[11px] text-slate-400 mt-1">{translateUi("The member gets an email confirming the cancellation.")}</p>
          <ModalActions busy={busy} danger onCancel={() => setModal(null)} saveLabel={translateUi("Cancel membership")}
            onSave={() => act("cancel", { atPeriodEnd: current && !m.cancelAtPeriodEnd && atPeriodEnd, reason: text || null },
              current && !m.cancelAtPeriodEnd && atPeriodEnd ? "Cancellation scheduled" : "Membership cancelled")} />
        </Modal>
      )}

      {modal === "note" && (
        <Modal title={translateUi("Add note")} onClose={() => setModal(null)} narrow>
          <textarea autoFocus className={`${inputCls} min-h-[90px]`} value={text} onChange={(e) => setText(e.target.value)} />
          <ModalActions busy={busy} disabled={!text.trim()} onCancel={() => setModal(null)} saveLabel={translateUi("Add note")}
            onSave={() => act("notes", { note: text }, "Note added")} />
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  );
}

function Field({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: "bad" }) {
  const { t: translateUi } = useI18n();
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{translateUi(label)}</dt>
      <dd className={`text-slate-800 break-words ${mono ? "font-mono text-xs" : ""} ${tone === "bad" ? "text-red-600" : ""}`}>{value}</dd>
    </div>
  );
}

function Choice({ checked, onChange, title, hint }: { checked: boolean; onChange: () => void; title: string; hint: string }) {
  return (
    <label className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${checked ? "border-matcha-500 bg-matcha-50/50" : "border-slate-200"}`}>
      <input type="radio" className="mt-0.5 accent-matcha-600" checked={checked} onChange={onChange} />
      <span>
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
