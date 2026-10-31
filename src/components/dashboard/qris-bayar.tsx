import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { QrisSiapBayar } from "@/server/payment/qris";

const q = copy.paymentStatus.qris;

/**
 * QR QRIS siap bayar (BinderPay tak punya halaman bayar hosted — DECISIONS
 * #99). Dirender ketiga poller selama order menunggu pembayaran: undangan,
 * upgrade, dan Album Momen.
 */
export function QrisBayar({
  qr,
  orderCode,
}: {
  qr: QrisSiapBayar;
  orderCode: string;
}) {
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-3">
      <div className="space-y-1">
        <p className="font-medium">{q.title}</p>
        <p className="text-muted-foreground text-xs">{q.body}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG data URL buatan server, bukan aset yang bisa dioptimalkan next/image */}
      <img
        src={qr.png}
        alt={q.alt}
        width={256}
        height={256}
        className="rounded-lg border bg-white p-2"
      />
      <p className="text-muted-foreground text-xs">
        {q.validUntil(qr.berlakuSampai)}
      </p>
      <a
        href={qr.png}
        download={`qris-${orderCode}.png`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Download className="size-4" />
        {q.save}
      </a>
      <p className="text-muted-foreground text-xs">{q.mobileHint}</p>
    </div>
  );
}
