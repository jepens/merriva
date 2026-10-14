import { afterEach, describe, expect, it, vi } from "vitest";

import { getMediaRoot, getStorageDriver } from "@/lib/env";
import { LocalStorageDriver } from "@/lib/storage/local-driver";
import { R2StorageDriver } from "@/lib/storage/r2-driver";
import { SupabaseStorageDriver } from "@/lib/storage/supabase-driver";

/**
 * Pemilihan driver storage dulu memakai pola `name === "r2" ? R2 : Supabase`,
 * sehingga `STORAGE_DRIVER=lokal` (atau `Local`, atau sisa spasi) diam-diam
 * berarti Supabase. Dengan tiga driver, kesalahan itu berhenti bersifat
 * kosmetik: foto ditulis ke satu tempat sementara `NEXT_PUBLIC_MEDIA_URL`
 * menunjuk tempat lain, dan yang terlihat hanyalah foto 404 tanpa sebab.
 *
 * Jadi yang dijaga di sini adalah kebalikannya: ejaan asing harus BERISIK.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getStorageDriver", () => {
  it.each(["supabase", "r2", "local"])("menerima %s", (nama) => {
    vi.stubEnv("STORAGE_DRIVER", nama);
    expect(getStorageDriver()).toBe(nama);
  });

  it("kosong atau tak di-set berarti supabase", () => {
    vi.stubEnv("STORAGE_DRIVER", "");
    expect(getStorageDriver()).toBe("supabase");
  });

  it("mengabaikan spasi di tepi", () => {
    vi.stubEnv("STORAGE_DRIVER", "  local  ");
    expect(getStorageDriver()).toBe("local");
  });

  it.each(["lokal", "Local", "R2", "s3", "supabse"])(
    "melempar untuk ejaan %j",
    (nama) => {
      vi.stubEnv("STORAGE_DRIVER", nama);
      expect(() => getStorageDriver()).toThrow(/tidak dikenali/i);
    },
  );

  it("menyebut nilai yang salah di pesannya", () => {
    // Tanpa nilainya, pemilik harus menebak variabel mana yang salah ketik.
    vi.stubEnv("STORAGE_DRIVER", "lokal");
    expect(() => getStorageDriver()).toThrow(/lokal/);
  });
});

describe("getStorage — pemetaan nama ke driver", () => {
  // Pabriknya meng-cache instance, jadi setiap kasus butuh modul yang segar.
  async function pabrik(nama: string) {
    vi.resetModules();
    vi.stubEnv("STORAGE_DRIVER", nama);
    const { getStorage } = await import("@/lib/storage");
    return getStorage();
  }

  it.each([
    ["local", LocalStorageDriver.name],
    ["r2", R2StorageDriver.name],
    ["supabase", SupabaseStorageDriver.name],
    ["", SupabaseStorageDriver.name],
  ])("%j → driver yang benar", async (nama, kelas) => {
    // Dibandingkan lewat NAMA kelas, bukan `instanceof`: `vi.resetModules()`
    // membuat salinan modul baru, jadi kelas hasil impor dinamis bukan kelas
    // yang sama dengan yang diimpor di atas meski identik isinya.
    //
    // Salah petakan di sini = foto ditulis ke tempat yang berbeda dari tempat
    // yang disajikan, tanpa satu pun galat.
    expect((await pabrik(nama)).constructor.name).toBe(kelas);
  });
});

describe("getMediaRoot", () => {
  it("default relatif ke cwd → /app/data/media di container", () => {
    vi.stubEnv("MEDIA_ROOT", "");
    expect(getMediaRoot()).toBe("data/media");
  });

  it("memakai nilai yang di-set", () => {
    vi.stubEnv("MEDIA_ROOT", "/mnt/media");
    expect(getMediaRoot()).toBe("/mnt/media");
  });
});
