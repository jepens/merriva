"use client";

import { Check, Eye, Lock, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/confirm-dialog";
import { ThemeCard } from "@/components/dashboard/theme-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { changeInvitationThemeAction } from "@/server/actions/theme";

export interface SwitchThemeOption {
  slug: string;
  name: string;
  tier: string;
  hasThumb: boolean;
  /** Tema yang sedang dipakai undangan ini. */
  current: boolean;
  /** Tema premium yang paket undangan ini tak mencakupnya. */
  locked: boolean;
}

/**
 * Pemilih tema untuk undangan yang SUDAH ada (SPEC §4.4 "Ganti tema").
 * "Pratinjau" membuka undangan pemilik dalam tema itu tanpa menyimpan
 * (`/preview/{id}?tema=`); "Pakai Tema Ini" meminta konfirmasi lalu memanggil
 * aksi server, dan sukses kembali ke editor. Semua aturan ditegakkan ulang di
 * server — `locked` di sini hanya tampilan.
 */
export function ThemeSwitcher({
  invitationId,
  themes,
  live,
  upgradeHref,
}: {
  invitationId: string;
  themes: SwitchThemeOption[];
  /** Undangan aktif: konfirmasi menyebut tamu langsung melihat tema baru. */
  live: boolean;
  /** Tautan upgrade bila undangan ini bisa di-upgrade; `null` = tidak ada. */
  upgradeHref: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  async function pakai(t: SwitchThemeOption) {
    if (busy) return;
    const ok = await confirm({
      title: copy.themeSwitch.confirmTitle(t.name),
      description: copy.themeSwitch.confirmBody(live),
      confirmLabel: copy.themeSwitch.confirmCta,
    });
    if (!ok) return;
    setBusy(t.slug);
    // Galat percobaan sebelumnya (menetap) jangan ikut tampil di samping hasil
    // percobaan ini.
    toast.dismiss();
    const res = await changeInvitationThemeAction(invitationId, t.slug);
    if (res.status === "success") {
      // Toast hidup di layout → tetap tampil sesudah pindah ke editor. Tombol
      // tetap nonaktif sampai editor termuat — cegah klik ganda.
      toast.success(copy.themeSwitch.savedTo(t.name));
      router.push(`/dashboard/undangan/${invitationId}/edit`);
      return;
    }
    // Toast, bukan Alert di atas kisi: kartu yang ditekan bisa jauh di bawah
    // (12 tema bertumpuk di ponsel) — toast selalu terlihat. MENETAP sampai
    // ditutup: sebagian pesan berisi instruksi (mis. tagihan Basic menunggu),
    // dan di ponsel tak ada hover yang menjeda hitungan mundur 5 detik.
    toast.error(
      (res.status === "error" ? res.message : undefined) ??
        copy.themeSwitch.error,
      { duration: Infinity },
    );
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {themes.map((t) => (
          <ThemeCard
            key={t.slug}
            slug={t.slug}
            name={t.name}
            tier={t.tier}
            hasThumb={t.hasThumb}
            selected={t.current}
          >
            <div className="flex gap-2">
              <Link
                // Tema sekarang: pratinjau biasa (dengan kustomisasinya);
                // kandidat: `?tema=` (kustomisasi kembali ke bawaan).
                href={
                  t.current
                    ? `/preview/${invitationId}`
                    : `/preview/${invitationId}?tema=${t.slug}`
                }
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "flex-1",
                )}
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                {copy.themeSwitch.preview}
              </Link>
              {t.current ? (
                <span
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "sm" }),
                    "pointer-events-none flex-1",
                  )}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {copy.themeSwitch.current}
                </span>
              ) : t.locked ? (
                upgradeHref ? (
                  <Link
                    href={upgradeHref}
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "flex-1",
                    )}
                  >
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    {copy.themeSwitch.upgrade}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "pointer-events-none flex-1 opacity-70",
                    )}
                  >
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    {copy.themeSwitch.locked}
                  </span>
                )
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={busy !== null}
                  onClick={() => pakai(t)}
                  aria-label={`${copy.themeSwitch.use}: ${t.name}`}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {busy === t.slug
                    ? copy.themeSwitch.applying
                    : copy.themeSwitch.use}
                </Button>
              )}
            </div>
          </ThemeCard>
        ))}
      </div>
    </div>
  );
}
