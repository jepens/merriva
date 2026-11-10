"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";

export interface ConfirmOptions {
  /** Pertanyaan singkat, mis. "Pakai tema Warta?". */
  title: string;
  /** Akibatnya, bila perlu dijelaskan. */
  description?: string;
  /** Label tombol setuju yang menyebut aksinya, mis. "Ya, hapus". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Aksi permanen: tombol merah dan fokus awal di "Batal". */
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Pengganti `window.confirm` untuk dashboard & admin. Dialog bawaan peramban
 * berjudul "merriva.id says" dengan tombol OK/Cancel berbahasa Inggris, tak
 * bisa diberi gaya, dan bisa dibisukan pengguna ("cegah dialog tambahan") —
 * sesudah itu `confirm()` langsung bernilai false tanpa tampil, sehingga
 * tombolnya terasa mati.
 *
 * SATU `<dialog>` HTML bersama per layout: `showModal()` memberi lapisan atas,
 * latar, penjebakan fokus, dan Esc dari peramban sendiri — tanpa dependency.
 * Jaring pengaman: peramban tanpa `showModal` (di luar baseline Next 16) jatuh ke
 * `window.confirm`.
 */

/**
 * Klik pointer sesingkat ini sesudah dialog terbuka diabaikan: dialog terbuka
 * 1–3 ms sesudah klik pertama, jadi klik KEDUA dari klik/ketuk-ganda pada
 * tombol pemicu mendarat di dialog — menyetujui tanpa dibaca bila jatuh di
 * tombol "Ya", atau langsung menutupnya bila jatuh di latar. `window.confirm`
 * menelan klik itu; ini menirunya. 500 ms = bawaan waktu klik-ganda Windows.
 * Aktivasi keyboard (`detail === 0`) tak terpengaruh.
 */
const JEDA_KLIK_GANDA_MS = 500;
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const dibukaPada = useRef(0);
  const tekanDiLatar = useRef(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const pathname = usePathname();
  const titleId = useId();
  const descId = useId();

  const selesai = useCallback((ok: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
    setOptions(null);
    resolve?.(ok);
  }, []);

  const confirm = useCallback<Confirm>((next) => {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== "function") {
      return Promise.resolve(
        window.confirm(
          next.description
            ? `${next.title}\n\n${next.description}`
            : next.title,
        ),
      );
    }
    // Permintaan baru selagi dialog terbuka: yang lama dianggap batal.
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(next);
    });
  }, []);

  // Buka SESUDAH isinya dirender, lalu fokuskan tombol yang tepat: aksi
  // permanen → "Batal" (Enter tak langsung menghapus), lainnya → setuju.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!options || !dialog) return;
    if (!dialog.open) {
      dialog.showModal();
      dibukaPada.current = performance.now();
    }
    (options.destructive ? cancelRef : confirmRef).current?.focus();
  }, [options]);

  // Pindah halaman (Back / swipe-back / tautan) → batal. Provider ada di
  // LAYOUT, jadi tak dilepas saat navigasi klien; tanpa ini dialog basi
  // tertinggal di atas halaman lain dan "Ya" menjalankan aksi halaman lama.
  // Bersyarat: no-op saat mount, dan lolos react-hooks/set-state-in-effect.
  useEffect(() => {
    if (resolverRef.current) selesai(false);
  }, [pathname, selesai]);

  // Provider benar-benar dilepas (keluar dari layout) — janji tak menggantung.
  useEffect(() => () => resolverRef.current?.(false), []);

  /** Klik pointer sisa klik-ganda pemicu? (lihat JEDA_KLIK_GANDA_MS) */
  const klikTerlaluCepat = (e: MouseEvent) =>
    e.detail > 0 && performance.now() - dibukaPada.current < JEDA_KLIK_GANDA_MS;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={options?.description ? descId : undefined}
        // Esc → batal (peramban menutup dialog; janjinya diselesaikan di sini).
        onCancel={(e) => {
          e.preventDefault();
          selesai(false);
        }}
        // Klik latar (di luar kartu) → batal — hanya bila tekanannya JUGA
        // dimulai di latar: memblok teks dari dalam kartu lalu melepas di luar
        // mengirim `click` ke <dialog> juga, dan itu bukan niat menutup.
        onPointerDown={(e) => {
          tekanDiLatar.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget || klikTerlaluCepat(e)) return;
          if (e.detail > 0 && !tekanDiLatar.current) return;
          selesai(false);
        }}
        // Latar literal, bukan `bg-black/50`: utilitas Tailwind v4 memakai
        // var(--color-black) yang baru diwarisi ::backdrop sejak Chrome 122 /
        // Safari 17.4 — di baseline Next 16 (Chrome 111 / Safari 16.4) latarnya
        // jadi transparan.
        className="bg-background text-foreground m-auto w-[min(100%-2rem,28rem)] rounded-xl border p-0 shadow-xl backdrop:bg-[rgb(0_0_0/0.5)]"
      >
        {options ? (
          <div className="space-y-4 p-5">
            <div className="space-y-2">
              <h2 id={titleId} className="text-base font-semibold">
                {options.title}
              </h2>
              {options.description ? (
                <p id={descId} className="text-muted-foreground text-sm">
                  {options.description}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                className={buttonVariants({ variant: "outline" })}
                onClick={(e) => {
                  if (!klikTerlaluCepat(e)) selesai(false);
                }}
              >
                {options.cancelLabel ?? copy.common.cancel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className={buttonVariants({
                  variant: options.destructive ? "destructive" : "default",
                })}
                onClick={(e) => {
                  if (!klikTerlaluCepat(e)) selesai(true);
                }}
              >
                {options.confirmLabel}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </ConfirmContext.Provider>
  );
}

/**
 * `const confirm = useConfirm(); if (!(await confirm({...}))) return;`
 * Hanya di bawah `ConfirmProvider` (layout dashboard & admin).
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error(
      "useConfirm hanya boleh dipakai di dalam <ConfirmProvider>",
    );
  }
  return confirm;
}
