import type { Json } from "@/types/database";

/**
 * Cast objek yang sudah tervalidasi Zod ke tipe kolom JSONB Supabase (`Json`).
 * Aman karena hasil parse Zod pasti serializable; `Json` tak punya index
 * signature sehingga objek berstruktur perlu cast eksplisit di satu tempat ini.
 */
export function toDbJson<T>(value: T): Json {
  return value as unknown as Json;
}
