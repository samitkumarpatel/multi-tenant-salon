import { useI18n } from "@salon/i18n";
import { useEffect, useRef, useState } from "react";
import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Camera, CheckCircle2, ChevronRight, ScanLine, XCircle } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { isNotFoundError } from "@salon/ui-shared";
import { MembershipStatusBadge, renewalLine } from "~/components/MembershipStatusBadge";
import { fmtDate } from "~/lib/membership";
import type { MembershipDetail } from "~/lib/types";
import type { MembershipOutletContext } from "./membership";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return { sid: await resolveSalonUUID(params.salonId!) };
}

/** Chromium's built-in QR decoder; absent on browsers without it, where staff type or use a USB scanner. */
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const BarcodeDetectorCtor = typeof window !== "undefined"
  ? (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector
  : undefined;

type Result = { kind: "found"; detail: MembershipDetail } | { kind: "missing"; code: string } | { kind: "error"; message: string };

export default function MembershipCheckIn() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  useOutletContext<MembershipOutletContext>();
  const { sid } = useLoaderData<typeof clientLoader>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function lookUp(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setBusy(true);
    try {
      const detail = await apiFetch<MembershipDetail>(`${ADMIN_API}/${sid}/membership/verify?code=${encodeURIComponent(value)}`);
      setResult({ kind: "found", detail });
    } catch (e) {
      setResult(isNotFoundError(e) ? { kind: "missing", code: value } : { kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      setCode("");
      inputRef.current?.focus();
    }
  }

  useEffect(() => {
    if (!scanning || !BarcodeDetectorCtor) return;
    const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stopped) return;
          const codes = await detector.detect(video).catch(() => []);
          if (codes[0]?.rawValue) {
            setScanning(false);
            void lookUp(codes[0].rawValue);
            return;
          }
          timer = setTimeout(tick, 250);
        };
        void tick();
      } catch {
        setScanning(false);
        setResult({ kind: "error", message: translateUi("Couldn't open the camera. Allow camera access, or type the member code.") });
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // lookUp is stable enough for a scan session; restarting the camera on each render would flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const m = result?.kind === "found" ? result.detail.subscription : null;
  const valid = m?.status === "ACTIVE";
  const lapsed = m?.status === "EXPIRED";

  return (
    <div className="max-w-xl space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <label htmlFor="member-code" className="block text-sm font-semibold text-slate-800 mb-1">{translateUi("Check in a member")}</label>
        <p className="text-xs text-slate-500 mb-3">{translateUi("Scan the QR code from the member's email, or type their member code.")}</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void lookUp(code); }}>
          <div className="relative flex-1">
            <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="member-code" ref={inputRef} autoFocus autoComplete="off" spellCheck={false}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm font-mono uppercase tracking-wider outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10"
              placeholder="M7K2Q9XZT" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button type="submit" disabled={busy || !code.trim()}
            className="px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer disabled:opacity-45">
            {translateUi("Check")}
          </button>
          {BarcodeDetectorCtor && (
            <button type="button" onClick={() => setScanning((s) => !s)} aria-pressed={scanning}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 cursor-pointer">
              <Camera className="w-4 h-4" /> {scanning ? translateUi("Stop") : translateUi("Scan")}
            </button>
          )}
        </form>
        {scanning && <video ref={videoRef} muted playsInline className="mt-3 w-full rounded-lg bg-slate-900 aspect-video object-cover" />}
      </div>

      {result?.kind === "found" && m && (
        <div className={`rounded-xl border-2 p-5 ${valid ? "border-green-300 bg-green-50" : lapsed ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"}`}>
          <div className="flex items-start gap-3">
            {valid ? <CheckCircle2 className="w-7 h-7 shrink-0 text-green-600" />
              : <XCircle className={`w-7 h-7 shrink-0 ${lapsed ? "text-amber-600" : "text-red-600"}`} />}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-slate-900">
                {valid ? translateUi("Valid member") : lapsed ? translateUi("Membership expired — not renewed yet") : translateUi("Not an active member")}
              </p>
              <p className="text-sm text-slate-800 mt-1">{m.customerName} · {m.planName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <MembershipStatusBadge status={m.status} />
                <span>{renewalLine(m, translateUi, uiLocale)}</span>
                {m.startedAt && <span>· {translateUi("Member since {date}", { date: fmtDate(m.startedAt, uiLocale) })}</span>}
              </div>
            </div>
            <Link to={`../members/${m.id}`} relative="path" className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-900 no-underline shrink-0">
              {translateUi("Details")} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
      {result?.kind === "missing" && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5 flex items-start gap-3">
          <XCircle className="w-7 h-7 shrink-0 text-red-600" />
          <div>
            <p className="text-base font-bold text-slate-900">{translateUi("No member found")}</p>
            <p className="text-sm text-slate-600 mt-1">{translateUi("No membership at this salon has the code {code}.", { code: result.code.toUpperCase() })}</p>
          </div>
        </div>
      )}
      {result?.kind === "error" && <p className="text-sm text-red-600">{result.message}</p>}
    </div>
  );
}
