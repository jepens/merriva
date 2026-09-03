"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

/** Tombol cetak halaman QR (client — memanggil window.print). */
export function PrintButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer className="size-4" />
      {copy.momen.qr.print}
    </Button>
  );
}
