"use client";

import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { SupportContact } from "@/components/support-contact";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatIdr } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  checkPaymentStatusAction,
  type PaymentStatusState,
} from "@/server/actions/payment-status";

const POLL_INTERVAL_MS = 4000;
// Berhenti otomatis ~6 menit agar tak mem-poll tanpa henti bila klien lupa
// menutup tab. Webhook (M3.2) tetap mengaktifkan di latar; klien bisa cek ulang.
const MAX_POLLS = 90;

type View = PaymentStatusState["status"] | "timeout";

const c = copy.paymentStatus;

export function PaymentStatusPoller({
  invitationId,
  slug,
  orderCode,
  amountIdr,
  packageName,
  initialStatus,
}: {
  invitationId: string;
  slug: string;
  orderCode: string;
  amountIdr: number;
  packageName: string;
  initialStatus: PaymentStatusState["status"];
}) {
  const [view, setView] = useState<View>(initialStatus);
  const [activeSlug, setActiveSlug] = useState(slug);
  // `checking` = ada poll SEDANG berjalan (indikator tombol), terpisah dari
  // `view` (status server). Kegagalan transien tetap `pending` → tombol aktif lagi.
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);
  const polls = useRef(0);

  const isWaiting = view === "pending";

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      const res = await checkPaymentStatusAction(invitationId);
      if (res.status === "active") setActiveSlug(res.slug);
      // Poll yang telat selesai TIDAK boleh menghidupkan ulang layar terminal:
      // bila batas poll sudah tercapai dan hasilnya masih `pending`, tetap ke
      // `timeout` (mencegah osilasi tak berujung di koneksi lambat, di mana
      // latensi > interval poll). Transisi terminal nyata (active/expired/
      // review) tetap diterapkan.
      if (res.status === "pending" && polls.current >= MAX_POLLS) {
        setView("timeout");
      } else {
        setView(res.status);
      }
    } catch {
      // Kegagalan tak terduga → menunggu lagi, kecuali sudah mencapai batas.
      setView(polls.current >= MAX_POLLS ? "timeout" : "pending");
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, [invitationId]);

  // Selama menunggu: cek sekali segera (webhook bisa sudah mengaktifkan sebelum
  // klien tiba di sini), lalu poll berkala. Jeda saat tab tak aktif; batasi total.
  // `check()` dipanggil dari callback timer (bukan sinkron di badan efek) → tak
  // memicu `set-state-in-effect`.
  useEffect(() => {
    if (!isWaiting) return;
    const kick = setTimeout(() => void check(), 0);
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (polls.current >= MAX_POLLS) {
        setView("timeout");
        return;
      }
      polls.current += 1;
      void check();
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [isWaiting, check]);

  function recheck() {
    polls.current = 0;
    setView("pending");
    void check();
  }

  if (view === "active") {
    return (
      <StatusCard
        icon={<CheckCircle2 className="size-10 text-emerald-600" />}
        title={c.successTitle}
        body={c.successBody}
      >
        <OrderSummary
          packageName={packageName}
          amountIdr={amountIdr}
          orderCode={orderCode}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href={`/${activeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants(), "min-w-40")}
          >
            {c.viewInvitation}
          </a>
          <Link
            href={`/dashboard/undangan/${invitationId}/sebar`}
            className={buttonVariants({ variant: "outline" })}
          >
            {c.shareInvitation}
          </Link>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "ghost" })}
          >
            {c.toDashboard}
          </Link>
        </div>
      </StatusCard>
    );
  }

  if (view === "expired" || view === "none") {
    return (
      <StatusCard
        icon={<XCircle className="text-muted-foreground size-10" />}
        title={view === "expired" ? c.expiredTitle : c.noneTitle}
        body={view === "expired" ? c.expiredBody : c.noneBody}
      >
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href={`/dashboard/undangan/${invitationId}/aktifkan`}
            className={buttonVariants()}
          >
            {c.activateAgain}
          </Link>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "ghost" })}
          >
            {c.back}
          </Link>
        </div>
      </StatusCard>
    );
  }

  if (view === "review") {
    return (
      <StatusCard
        icon={<Clock className="size-10 text-amber-600" />}
        title={c.reviewTitle}
        body={c.reviewBody}
      >
        <OrderSummary
          packageName={packageName}
          amountIdr={amountIdr}
          orderCode={orderCode}
        />
        <SupportContact orderCode={orderCode} />
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline" })}
        >
          {c.back}
        </Link>
      </StatusCard>
    );
  }

  if (view === "error") {
    return (
      <StatusCard
        icon={<XCircle className="text-destructive size-10" />}
        title={c.errorTitle}
        body={c.errorBody}
      >
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={recheck}
            className={buttonVariants({ variant: "outline" })}
          >
            {c.retry}
          </button>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "ghost" })}
          >
            {c.back}
          </Link>
        </div>
        {/* State `error` sengaja TIDAK merender OrderSummary, jadi kode order
            tak ada di layar — `SupportContact` membawanya sendiri ke mailto. */}
        <SupportContact orderCode={orderCode} />
      </StatusCard>
    );
  }

  if (view === "timeout") {
    return (
      <StatusCard
        icon={<Clock className="text-muted-foreground size-10" />}
        title={c.timeoutTitle}
        body={c.timeoutBody}
      >
        <OrderSummary
          packageName={packageName}
          amountIdr={amountIdr}
          orderCode={orderCode}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={recheck}
            className={buttonVariants({ variant: "outline" })}
          >
            {c.checkNow}
          </button>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "ghost" })}
          >
            {c.back}
          </Link>
        </div>
        <SupportContact orderCode={orderCode} />
      </StatusCard>
    );
  }

  // pending → menunggu; poll berjalan (indikator "Memeriksa…" saat cek in-flight).
  return (
    <StatusCard
      icon={<Loader2 className="text-primary size-10 animate-spin" />}
      title={c.waitingTitle}
      body={c.waitingBody}
    >
      <OrderSummary
        packageName={packageName}
        amountIdr={amountIdr}
        orderCode={orderCode}
      />
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={recheck}
          disabled={checking}
          className={buttonVariants({ variant: "outline" })}
        >
          {checking ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {c.checking}
            </>
          ) : (
            c.checkNow
          )}
        </button>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "ghost" })}
        >
          {c.back}
        </Link>
      </div>
    </StatusCard>
  );
}

function StatusCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        {icon}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            {body}
          </p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function OrderSummary({
  packageName,
  amountIdr,
  orderCode,
}: {
  packageName: string;
  amountIdr: number;
  orderCode: string;
}) {
  if (!orderCode) return null;
  return (
    <dl className="bg-muted/40 w-full max-w-xs space-y-1.5 rounded-lg px-4 py-3 text-sm">
      {packageName ? (
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{c.package}</dt>
          <dd className="font-medium">{packageName}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{c.amount}</dt>
        <dd className="font-medium">{formatIdr(amountIdr)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{c.order}</dt>
        <dd className="font-mono text-xs">{orderCode}</dd>
      </div>
    </dl>
  );
}
