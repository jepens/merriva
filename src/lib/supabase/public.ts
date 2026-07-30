import { createClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client anon TANPA cookie — untuk membaca katalog publik (packages &
 * themes) di halaman marketing yang dirender STATIS (ISR). Client SSR berbasis
 * cookie (`createSupabaseServerClient`) meng-opt-in route ke rendering dinamis;
 * client ini menjaga landing/tema/harga tetap statis + di-revalidate on-demand
 * saat admin mengubah harga/tema (`revalidatePath` di admin-catalog).
 *
 * RLS tetap berlaku: anon hanya bisa SELECT baris `is_active` pada `packages` &
 * `themes` (migrasi v1 §6b). Tidak menyentuh service_role.
 */
export function createSupabasePublicClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
