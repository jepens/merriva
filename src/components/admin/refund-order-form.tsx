"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { adminRefundOrderAction } from "@/server/actions/admin";

const r = copy.admin.refund;

/**
 * Tandai order sebagai refund (AUDIT-2026-10-01 A3).
 *
 * Form dibuka lewat tombol agar alasan WAJIB diketik — ia masuk `admin_logs`
 * dan menjadi satu-satunya penjelasan kenapa uang bergerak di luar sistem.
 * Konfirmasi `window.confirm` dipakai karena tindakan ini mencabut layanan yang
 * sudah berjalan dan tak ada jalur membatalkannya kembali.
 */
export function RefundOrderForm({ orderCode }: { orderCode: string }) {
  const [buka, setBuka] = useState(false);

  if (!buka) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setBuka(true)}
      >
        {r.cta}
      </Button>
    );
  }

  return (
    <form
      action={adminRefundOrderAction.bind(null, orderCode)}
      onSubmit={(e) => {
        if (!window.confirm(r.confirm)) e.preventDefault();
      }}
      className="flex min-w-56 flex-col gap-2"
    >
      <Input
        name="reason"
        required
        maxLength={500}
        placeholder={r.reasonPlaceholder}
        aria-label={r.reasonLabel}
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive">
          {r.cta}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setBuka(false)}
        >
          {copy.common.cancel}
        </Button>
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">{r.note}</p>
    </form>
  );
}
