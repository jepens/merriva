"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { saveInvitationDraftAction } from "@/server/actions/invitation";
import type { FieldErrors } from "@/server/actions/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Hasil `flush()`. Dua bentuk kegagalan sengaja DIBEDAKAN karena obatnya
 * berbeda: `failed` (transport) sembuh dengan mengirim ulang payload yang sama,
 * sedangkan `rejected` (server menolak isi — mis. teks melebihi batas skema)
 * TIDAK akan pernah sembuh dengan pengiriman ulang. Menyuruh pemilik "periksa
 * koneksi" pada kasus kedua membuatnya mengejar masalah yang tidak ada.
 */
export type FlushResult = "ok" | "rejected" | "failed";

export interface DraftAutosave {
  status: SaveStatus;
  /**
   * Kirim SEGERA perubahan yang masih tertunda, lalu tunggu hasilnya.
   * `"ok"` = seluruh perubahan sudah sampai di server (aman berpindah halaman);
   * selain itu pemanggil WAJIB tetap di halaman.
   */
  flush: () => Promise<FlushResult>;
  /**
   * Galat per isian dari penolakan TERAKHIR (kunci = path lengkap, sama
   * dengan `name` isian); `null` begitu ada simpanan yang diterima.
   */
  rejected: FieldErrors | null;
}

/**
 * Autosave draft berbasis perubahan form (SPEC §4.4). Meng-subscribe perubahan
 * RHF, debounce, lalu memanggil `saveInvitationDraftAction`. Nilai form
 * (`{ content, settings, eventDate }`) langsung menjadi payload — server
 * memvalidasi ulang dengan skema draft.
 *
 * Dua jaminan anti-kehilangan-data (DECISIONS #40):
 *  - **`flush()`** dipakai tombol "Selesai" sebelum berpindah halaman, karena
 *    navigasi meng-unmount editor di tengah jendela debounce 800 ms.
 *  - **Simpan saat unmount**: timer yang tertunda tidak dibuang begitu saja;
 *    bila masih ada perubahan, simpanannya tetap dikirim (best-effort) supaya
 *    keluar lewat tautan lain (mis. "Kustomisasi Tampilan") tidak menelan
 *    ketikan terakhir.
 */
export function useDraftAutosave<T extends FieldValues>(
  form: UseFormReturn<T>,
  invitationId: string,
  delay = 800,
): DraftAutosave {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [rejected, setRejected] = useState<FieldErrors | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ekor rantai: simpan berjalan SATU per satu (request lama tak menimpa baru). */
  const chain = useRef<Promise<void>>(Promise.resolve());
  /** Ada perubahan yang belum diterima server. */
  const dirty = useRef(false);
  /** Bentuk kegagalan simpan terakhir; `null` = simpan terakhir berhasil. */
  const failure = useRef<Exclude<FlushResult, "ok"> | null>(null);
  const mounted = useRef(true);

  const mark = useCallback((next: SaveStatus) => {
    if (mounted.current) setStatus(next);
  }, []);

  /**
   * Antre di belakang simpan yang sedang berjalan dan ambil snapshot nilai form
   * SAAT GILIRANNYA TIBA — dengan begitu dua request tak pernah tumpang tindih
   * dan yang terkirim selalu nilai terbaru (payload = seluruh form, jadi urutan
   * menentukan kebenaran). Promise-nya sengaja tak pernah ditolak agar satu
   * kegagalan tidak memutus rantai untuk simpan berikutnya.
   */
  const save = useCallback((): Promise<void> => {
    const run = chain.current.then(async () => {
      if (!dirty.current) return;
      dirty.current = false;
      mark("saving");
      try {
        const res = await saveInvitationDraftAction(
          invitationId,
          form.getValues(),
        );
        // `fieldErrors` hanya ada bila skema server menolak isinya — payload
        // yang sama persis pasti ditolak lagi, jadi JANGAN antre ulang: biarkan
        // bersih sampai pemilik mengubah isian (perubahan itu menandai kotor
        // lagi dan mengirim payload baru). Tanpa pemisahan ini satu penolakan
        // membuat setiap simpanan berikutnya ikut gagal selamanya.
        failure.current =
          res.status !== "error"
            ? null
            : res.fieldErrors
              ? "rejected"
              : "failed";
        // Tandai isian yang ditolak; simpanan sukses menghapus tandanya.
        // Gangguan transport tak mengubah tanda: isinya belum dinilai ulang.
        if (mounted.current) {
          if (res.status !== "error") setRejected(null);
          else if (res.fieldErrors) setRejected(res.fieldErrors);
        }
      } catch {
        failure.current = "failed";
      }
      if (failure.current === "failed") dirty.current = true;
      // "Tersimpan" hanya bila benar-benar tak ada lagi yang tertunda — ketikan
      // yang masuk selama request berjalan membuat indikator tetap "Menyimpan…".
      mark(failure.current ? "error" : dirty.current ? "saving" : "saved");
    });
    chain.current = run;
    return run;
  }, [form, invitationId, mark]);

  const flush = useCallback(async (): Promise<FlushResult> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // Pemilik bisa terus mengetik selama simpan berjalan, jadi kuras sampai
    // benar-benar bersih — dibatasi supaya tombol tak pernah menggantung.
    for (let putaran = 0; putaran < 5; putaran += 1) {
      await save();
      if (failure.current || !dirty.current) break;
    }
    return failure.current ?? (dirty.current ? "failed" : "ok");
  }, [save]);

  useEffect(() => {
    mounted.current = true;
    const subscription = form.watch(() => {
      dirty.current = true;
      mark("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, delay);
    });

    return () => {
      subscription.unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (dirty.current) void save();
      mounted.current = false;
    };
  }, [form, delay, mark, save]);

  return { status, flush, rejected };
}
