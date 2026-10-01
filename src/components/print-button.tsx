"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Cetak halaman lewat browser. Dipakai kartu QR Album Momen dan kuitansi
 * pesanan; label disuntik sebagai prop (string, serializable) agar satu
 * komponen melayani keduanya tanpa mengimpor `copy` ke pohon klien.
 *
 * Chrome Android dan Safari iOS sama-sama menawarkan "Simpan sebagai PDF" dari
 * lembar cetak, jadi `window.print()` cukup — nol dependency baru.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
