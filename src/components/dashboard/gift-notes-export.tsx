"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

/**
 * Unduh buku amplop sebagai Excel (AUDIT-2026-10-01, gelombang C).
 *
 * Buku amplop adalah SATU-SATUNYA daftar di produk ini yang berisi uang, dan
 * sampai sekarang ia hanya bisa dibaca di layar: tak bisa diserahkan ke
 * bendahara keluarga, tak bisa direkap, dan tak bisa disimpan sebelum cron
 * retensi menghapusnya PERMANEN enam bulan setelah undangan kedaluwarsa.
 *
 * Datanya datang sebagai props dari Server Component halaman ucapan — baris
 * yang SAMA dengan yang sudah dirender di sana (RLS pemilik). Tak ada Server
 * Action baru: menambahkannya hanya akan menduplikasi query yang sudah jalan
 * dan menambah satu permukaan yang harus dijaga kepemilikannya.
 *
 * `write-excel-file` di-`import()` dinamis → code-split, tak membebani bundle
 * awal dashboard (pola yang sama dengan ekspor daftar tamu).
 */

export interface GiftNoteRow {
  guestName: string;
  type: "transfer" | "gift";
  /** Integer IDR; `null` = tamu tak menyebut nominal. */
  amountIdr: number | null;
  note: string | null;
  createdAtLabel: string;
}

const t = copy.dashboard.guestbook;

export function GiftNotesExport({ rows }: { rows: readonly GiftNoteRow[] }) {
  const [sibuk, setSibuk] = useState(false);

  async function unduh() {
    setSibuk(true);
    try {
      const { default: writeXlsxFile } =
        await import("write-excel-file/browser");
      const c = t.giftCol;
      const header = [c.name, c.type, c.amount, c.note, c.date].map((v) => ({
        value: v,
        fontWeight: "bold" as const,
      }));
      const body = rows.map((r) => [
        { value: r.guestName },
        { value: r.type === "transfer" ? t.giftTransfer : t.giftGift },
        // Sel KOSONG (`null`), bukan `{ value: "" }`, saat nominal tak disebut:
        // teks di kolom uang membuat SUM Excel berhenti bekerja. `null` adalah
        // `Cell` yang sah dan menghasilkan sel benar-benar kosong.
        r.amountIdr != null ? { value: r.amountIdr, type: Number } : null,
        { value: r.note ?? "" },
        { value: r.createdAtLabel },
      ]);
      await writeXlsxFile([header, ...body]).toFile("konfirmasi-amplop.xlsx");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={unduh}
      disabled={sibuk || rows.length === 0}
    >
      {sibuk ? t.giftExporting : t.giftExportCta}
    </Button>
  );
}
