import type { ReactNode } from "react";

import { copy } from "@/lib/copy";

import { PreviewBanner } from "./preview-banner";

/**
 * Bingkai ponsel untuk pratinjau tema. Halaman undangan dibuka mayoritas di
 * WebView WhatsApp (CLAUDE.md) → pratinjau ditampilkan dalam layar ponsel.
 *
 * Tema dirender di dalam `<iframe>` agar memperoleh viewport BERSARANG: `100dvh`,
 * elemen `fixed` (tombol musik), media query, dan reveal (IntersectionObserver)
 * berperilaku persis seperti di ponsel — bukan meregang ke lebar desktop. Isi
 * iframe = halaman yang sama dengan `?embed=1` (render tema polos tanpa bingkai).
 * Di layar sempit (ponsel asli) bingkai mengempis jadi layar penuh.
 */
export function PreviewFrame({
  embedSrc,
  demo = false,
  editHref,
  footer,
}: {
  embedSrc: string;
  demo?: boolean;
  editHref?: string;
  /** Baris di bawah bingkai (mis. atribusi Pexels) — disembunyikan saat layar penuh ponsel. */
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-200 px-4 pt-14 pb-8 max-[430px]:p-0 max-[430px]:pt-9">
      <PreviewBanner demo={demo} editHref={editHref} />
      <div className="relative flex h-[min(880px,calc(100dvh-6.5rem))] w-[392px] max-w-full flex-col rounded-[2.75rem] bg-neutral-900 p-[11px] shadow-[0_35px_70px_-20px_rgba(0,0,0,0.4)] ring-1 ring-black/10 max-[430px]:h-[calc(100dvh-2.25rem)] max-[430px]:w-full max-[430px]:rounded-none max-[430px]:p-0 max-[430px]:shadow-none max-[430px]:ring-0">
        {/* Speaker — di dalam bezel atas (tak menutup konten); sembunyi saat layar penuh */}
        <span
          aria-hidden
          className="absolute top-[4px] left-1/2 z-10 h-[4px] w-16 -translate-x-1/2 rounded-full bg-white/25 max-[430px]:hidden"
        />
        <iframe
          src={embedSrc}
          title={copy.preview.frameTitle}
          className="h-full w-full rounded-[2.15rem] border-0 bg-white max-[430px]:rounded-none"
        />
      </div>
      {footer ? (
        <div className="mt-3 w-[392px] max-w-full px-2 max-[430px]:hidden">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sembunyikan scrollbar dokumen di dalam iframe pratinjau (`?embed=1`) agar
 * bingkai ponsel tak menampilkan scrollbar desktop yang mengganggu — di ponsel
 * asli scrollbar memang overlay/auto-hilang. Scroll tetap berfungsi (roda/
 * sentuh/seret/keyboard); petunjuk "Gulir" tetap ada. Hanya berlaku di dokumen
 * embed, tak menyentuh halaman undangan publik.
 */
export function PreviewEmbedStyle() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html:
          "html{scrollbar-width:none}html::-webkit-scrollbar{width:0;height:0;display:none}",
      }}
    />
  );
}
