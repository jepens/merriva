import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/sitemap.xml` + `replyTo` email transaksional (AUDIT-2026-10-12, DECISIONS #69).
 *
 * Dua perubahan kecil yang digabung di sini karena keduanya dijaga oleh satu
 * properti yang sama: **apa yang TIDAK boleh ada di dalamnya**.
 *
 *  * Sitemap: halaman undangan `/[slug]` mengirim `robots: { index: false }`
 *    sendiri, tetapi mendaftarkannya di sitemap akan membatalkan maksud itu dan
 *    membocorkan daftar klien beserta nama mempelainya ke indeks publik. Test ini
 *    yang menahan "ayo tambahkan undangan aktif supaya SEO-nya bagus".
 *  * `replyTo`: sebelumnya tak ada sama sekali, sehingga balasan pelanggan atas
 *    kuitansi dan peringatan pra-purge tidak menuju ke mana pun.
 */

const { send } = vi.hoisted(() => ({
  send: vi.fn(async () => ({ data: { id: "em_1" }, error: null })),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { copy } from "@/lib/copy";
import { sendTransactionalEmail } from "@/lib/email/send";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const urls = () => sitemap().map((e) => e.url);

  it("memuat ketujuh halaman marketing publik", () => {
    const paths = urls().map((u) => new URL(u).pathname);
    expect([...paths].sort()).toEqual(
      ["/", "/faq", "/harga", "/privasi", "/refund", "/syarat", "/tema"].sort(),
    );
  });

  it("TIDAK memuat satu pun halaman undangan, dashboard, admin, atau auth", () => {
    // Properti terpenting berkas ini. Undangan sengaja `noindex`; mendaftarkannya
    // di sitemap membocorkan nama klien & mempelai ke indeks publik.
    const paths = urls().map((u) => new URL(u).pathname);
    for (const p of paths) {
      expect(p).not.toMatch(
        /^\/(dashboard|admin|auth|preview)\b|\/momen$|^\/[a-z0-9-]+-[a-z0-9-]+$/,
      );
    }
    expect(
      paths.filter((p) => p.split("/").filter(Boolean).length > 1),
    ).toEqual([]);
  });

  it("semua URL absolut dan tanpa garis miring ganda", () => {
    for (const u of urls()) {
      expect(() => new URL(u)).not.toThrow();
      expect(u.replace(/^https?:\/\//, "")).not.toContain("//");
    }
  });

  it("beranda berprioritas tertinggi", () => {
    const beranda = sitemap().find((e) => new URL(e.url).pathname === "/");
    expect(beranda?.priority).toBe(1);
  });

  it("tanpa `lastModified` — tanggal apa pun saat build akan jadi klaim salah", () => {
    // Isi `/harga` & `/tema` datang dari DB dan berubah tanpa deploy; `new Date()`
    // lebih buruk lagi karena berubah tiap build tanpa ada yang berubah.
    for (const e of sitemap()) expect(e.lastModified).toBeUndefined();
  });
});

describe("replyTo email transaksional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_dummy_for_test"; // gitleaks:allow
  });

  const kirim = () =>
    sendTransactionalEmail({
      to: "pembeli@contoh.test",
      subject: "Subjek",
      html: "<p>x</p>",
      text: "x",
      idempotencyKey: "uji/1",
    });

  it("setiap kiriman memasang alamat balasan dukungan", async () => {
    await kirim();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      replyTo: copy.support.email,
    });
  });

  it("alamat balasan BUKAN `noreply@` pengirimnya", async () => {
    // Inti perbaikannya: `EMAIL_FROM` default `noreply@`, dan untuk email
    // pra-purge ("data Anda akan dihapus") serta email penangguhan yang
    // menawarkan banding, ketidakmampuan membalas adalah soal kepatuhan.
    await kirim();
    const arg = send.mock.calls[0]?.[0] as { from: string; replyTo: string };
    expect(arg.replyTo).not.toContain("noreply@");
    expect(arg.replyTo).not.toBe(arg.from);
  });

  it("satu sumber dengan alamat yang tercetak di halaman hukum", async () => {
    // Bila kelak dipisah menjadi env sendiri, pelanggan bisa membaca satu alamat
    // di /syarat dan membalas ke alamat yang lain.
    await kirim();
    expect((send.mock.calls[0]?.[0] as { replyTo: string }).replyTo).toBe(
      copy.marketing.legal.contactEmail,
    );
  });

  it("tanpa RESEND_API_KEY tetap `skipped` — tak ada panggilan SDK", async () => {
    delete process.env.RESEND_API_KEY;
    expect(await kirim()).toEqual({ status: "skipped" });
    expect(send).not.toHaveBeenCalled();
  });
});
