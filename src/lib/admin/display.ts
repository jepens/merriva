import { formatEventDateTime } from "@/lib/datetime";

/** Tanggal WIB ringkas untuk tabel admin (mis. "15 Agustus 2026"). */
export function wibDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatEventDateTime(iso, "Asia/Jakarta")?.date ?? "—";
}

/** Tanggal + waktu WIB (mis. "Sabtu, 15 Agustus 2026 · 10.00 WIB"). */
export function wibDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatEventDateTime(iso, "Asia/Jakarta")?.full ?? "—";
}
