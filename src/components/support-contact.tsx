import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const s = copy.support;

/**
 * Kontak dukungan pelanggan (AUDIT-2026-10-01 A5).
 *
 * Sebelum ini satu-satunya alamat kontak produk hanya dirender di /faq,
 * /privasi, dan /refund — sementara kartu pembayaran yang tertahan justru
 * menyuruh "hubungi kami" tanpa memberi alamat apa pun, tepat pada layar yang
 * muncul ketika uang pelanggan sudah keluar tetapi undangannya belum aktif.
 *
 * Dua keputusan yang disengaja:
 *  - `orderCode` diisikan ke SUBJECT dan BODY mailto. Kebijakan refund
 *    mewajibkan pelanggan menyebut kode order, dan state `error` pada poller
 *    tidak merender ringkasan order sama sekali — jadi teks kontak tak boleh
 *    mengandalkan kodenya sudah ada di layar.
 *  - Alamat dirender sebagai TEKS yang bisa dipilih di samping tombol. Halaman
 *    ini banyak dibuka dari WebView WhatsApp, tempat `mailto:` kerap tidak
 *    membuka aplikasi apa pun; tanpa fallback teks, pelanggan yang panik
 *    menekan tombol yang tak melakukan apa-apa.
 *
 * Tanpa `"use client"` dan tanpa hook, jadi sah dipakai dari Server Component
 * maupun dari dalam pohon klien. JANGAN dipakai di `src/app/global-error.tsx`
 * (berkas itu melarang impor apa pun karena masuk graf klien setiap route)
 * maupun di pohon `src/app/[slug]/**` — tamu bukan pelanggan Merriva.
 */
export function SupportContact({
  orderCode,
  variant = "block",
  className,
}: {
  orderCode?: string | null;
  variant?: "block" | "line";
  className?: string;
}) {
  // `bayar/page.tsx` mengirim `order?.order_code ?? ""` → string kosong harus
  // diperlakukan sama dengan tanpa kode, bukan menghasilkan subject menggantung.
  const code = orderCode && orderCode.trim() ? orderCode.trim() : null;
  const subject = code ? s.mailSubjectOrder(code) : s.mailSubject;
  const body = code ? s.mailBodyOrder(code) : s.mailBody;
  const href = `mailto:${s.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (variant === "line") {
    return (
      <p className={cn("text-muted-foreground text-xs", className)}>
        {s.footerLine}{" "}
        <a href={href} className="underline underline-offset-4">
          {s.email}
        </a>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "bg-muted/40 w-full rounded-lg px-4 py-3 text-left",
        className,
      )}
    >
      <p className="text-sm font-medium">{s.title}</p>
      <p className="text-muted-foreground mt-1 text-xs">
        {code ? s.bodyWithOrder : s.body}
      </p>
      <a
        href={href}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-3",
        )}
      >
        {s.cta}
      </a>
      <p className="text-muted-foreground mt-2 text-xs">
        {s.emailLabel} <span className="font-mono select-all">{s.email}</span>
      </p>
    </div>
  );
}
