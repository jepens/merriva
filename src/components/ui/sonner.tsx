"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { copy } from "@/lib/copy";

/**
 * Wadah toast (sonner) — dipasang SEKALI di layout dashboard & admin, BUKAN di
 * halaman undangan tamu (bundel tamu tetap ringan). Panggil `toast.success()` /
 * `toast.error()` dari komponen klien mana pun di bawahnya; toast tetap tampil
 * melewati navigasi klien (`router.push`) karena layout tak di-mount ulang.
 *
 * Varian shadcn memakai `next-themes`; proyek ini tak punya mode gelap di
 * dashboard, jadi tema terang tetap. Atas-tengah: terlihat di ponsel tanpa
 * menutupi tombol aksi bawah editor ("Sebelumnya/Berikutnya").
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      richColors
      closeButton
      containerAriaLabel={copy.common.toast.region}
      toastOptions={{
        duration: 5000,
        closeButtonAriaLabel: copy.common.toast.close,
      }}
      {...props}
    />
  );
}
