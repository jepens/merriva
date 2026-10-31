"use client";

import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { QrisBayar } from "@/components/dashboard/qris-bayar";
import { SupportContact } from "@/components/support-contact";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatIdr } from "@/lib/format";
import {
  checkUpgradePaymentStatusAction,
  type UpgradePaymentState,
} from "@/server/actions/upgrade-payment-status";
import type { QrisSiapBayar } from "@/server/payment/qris";

/**
 * Poller status pembayaran UPGRADE paket (AUDIT-2026-10-01 B3).
 *
 * Sengaja mencerminkan `momen/momen-payment-poller.tsx` agar hanya ada SATU pola
 * poll pembayaran di produk ini. Ia juga jalur aktivasi otoritatif kedua:
 * `checkPaymentStatusAction` tak bisa dipakai karena ia berhenti di status
 * `active` — dan undangan pembeli upgrade selalu `active`.
 */

const POLL_INTERVAL_MS = 4000;
// Berhenti otomatis ~6 menit agar tak mem-poll tanpa henti bila tab ditinggalkan.
// Webhook & cron tetap mengaktifkan di latar.
const MAX_POLLS = 90;

type View = UpgradePaymentState["status"] | "timeout";

const c = copy.upgrade.payment;

export function UpgradePaymentPoller({
  invitationId,
  slug,
  orderCode,
  amountIdr,
  packageName,
  qr = null,
}: {
  invitationId: string;
  slug: string;
  orderCode: string;
  amountIdr: number;
  packageName: string | null;
  /** QRIS untuk dibayar di halaman ini (BinderPay) — lihat `PaymentStatusPoller`. */
  qr?: QrisSiapBayar | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("pending");
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);
  const polls = useRef(0);

  const isWaiting = view === "pending";

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      const res = await checkUpgradePaymentStatusAction(invitationId);
      // Poll yang telat selesai tak boleh menghidupkan ulang layar terminal.
      if (res.status === "pending" && polls.current >= MAX_POLLS) {
        setView("timeout");
      } else {
        setView(res.status);
      }
    } catch {
      setView(polls.current >= MAX_POLLS ? "timeout" : "pending");
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, [invitationId]);

  // `check()` dipanggil dari callback timer (bukan sinkron di badan efek) → tak
  // memicu `set-state-in-effect`. Jeda saat tab tak terlihat; batasi total poll.
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

  const summary = (
    <Summary
      packageName={packageName}
      amountIdr={amountIdr}
      orderCode={orderCode}
    />
  );

  if (view === "active") {
    return (
      <StatusCard
        icon={<CheckCircle2 className="size-10 text-emerald-600" />}
        title={c.activeTitle}
        body={c.activeBody}
      >
        {summary}
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants()}
          >
            {c.viewInvitation}
          </a>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline" })}
          >
            {c.back}
          </Link>
        </div>
      </StatusCard>
    );
  }

  if (view === "expired" || view === "none") {
    return (
      <StatusCard
        icon={<XCircle className="text-muted-foreground size-10" />}
        title={c.expiredTitle}
        body={c.expiredBody}
      >
        {/* Server Component halaman ini merender panel upgrade begitu tak ada
            order pending → `refresh()` cukup, tanpa navigasi penuh. */}
        <button
          type="button"
          onClick={() => router.refresh()}
          className={buttonVariants()}
        >
          {c.chooseAgain}
        </button>
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
        {summary}
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
        {/* State ini tak merender `Summary`, jadi kode pesanan tak ada di
            layar — `SupportContact` membawanya sendiri ke mailto. */}
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
        {qr ? <QrisBayar qr={qr} orderCode={orderCode} /> : null}
        {summary}
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

  // pending → menunggu; poll berjalan.
  return (
    <StatusCard
      icon={<Loader2 className="text-primary size-10 animate-spin" />}
      title={c.pendingTitle}
      body={c.pendingBody(orderCode)}
    >
      {qr ? <QrisBayar qr={qr} orderCode={orderCode} /> : null}
      {summary}
      <p className="text-muted-foreground mx-auto max-w-md text-xs">
        {c.pendingHint}
      </p>
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

function Summary({
  packageName,
  amountIdr,
  orderCode,
}: {
  packageName: string | null;
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
