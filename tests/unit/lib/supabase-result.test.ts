import { describe, expect, it } from "vitest";

import { SupabaseReadError, dataOrThrow } from "@/lib/supabase/result";

/**
 * `dataOrThrow` (DECISIONS #45). postgrest-js tanpa `.throwOnError()`
 * mengembalikan `error` sebagai OBJEK POLOS — bentuk yang dipakai di sini,
 * bukan `new Error(...)` (mock seperti itu dulu menutupi bahwa yang dilempar
 * bukan Error sehingga Sentry tak bisa membedakan bacaan mana yang gagal).
 */

const POSTGREST = {
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
  code: "57014",
};

describe("dataOrThrow", () => {
  it("tanpa galat → data apa adanya, termasuk null (data memang tak ada)", () => {
    expect(dataOrThrow({ data: [1, 2], error: null }, "media")).toEqual([1, 2]);
    expect(dataOrThrow({ data: null, error: null }, "themes")).toBeNull();
  });

  it("galat objek polos → Error SUNGGUHAN berlabel bacaan, kode & galat asli terjaga", () => {
    let thrown: unknown;
    try {
      dataOrThrow({ data: null, error: POSTGREST }, "invitation_events");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toBeInstanceOf(SupabaseReadError);
    const e = thrown as SupabaseReadError;
    expect(e.name).toBe("SupabaseReadError");
    expect(e.message).toBe(
      "invitation_events: canceling statement due to statement timeout",
    );
    expect(e.code).toBe("57014");
    expect(e.cause).toBe(POSTGREST);
    // Tumpukan dibuat di titik panggil (bukan di dalam Next).
    expect(e.stack).toContain("supabase-result.test");
  });

  it("galat fetch putus (kode kosong, pesan 'TypeError: fetch failed') tetap terbaca", () => {
    expect(() =>
      dataOrThrow(
        {
          data: null,
          error: {
            message: "TypeError: fetch failed",
            details: "",
            hint: "",
            code: "",
          },
        },
        "songs",
      ),
    ).toThrow("songs: TypeError: fetch failed");
  });

  it("galat berbentuk aneh (string) tak membuat pelemparan itu sendiri gagal", () => {
    expect(() =>
      dataOrThrow({ data: null, error: "boom" }, "packages"),
    ).toThrow("packages: boom");
  });
});
