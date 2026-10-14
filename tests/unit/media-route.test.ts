import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/media/[...path]/route";

/**
 * `/media/[...path]` adalah satu-satunya route di produk ini yang membaca
 * filesystem server dan sengaja TANPA autentikasi — tamu undangan harus bisa
 * melihat fotonya tanpa akun. Karena itu setiap pagar di sini diuji sebagai
 * pagar, bukan sebagai jalur bahagia: ekstensi di luar daftar, path traversal,
 * driver yang bukan `local`, dan berkas yang bukan berkas.
 *
 * Header cache-nya juga diuji. `immutable` setahun di depan Cloudflare berarti
 * jawaban yang salah tidak akan hilang sendiri — ia tersimpan sampai undangannya
 * kedaluwarsa.
 */

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "merriva-route-"));
  vi.stubEnv("MEDIA_ROOT", root);
  vi.stubEnv("STORAGE_DRIVER", "local");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

const SEGMEN = ["inv", "85d261d6", "abc", "1600.webp"];
const ISI = "0123456789";

async function taruh(segmen: string[], isi = ISI) {
  const berkas = join(root, ...segmen);
  await mkdir(join(berkas, ".."), { recursive: true });
  await writeFile(berkas, isi);
}

function panggil(segmen: string[], headers?: Record<string, string>) {
  const url = `http://localhost/media/${segmen.join("/")}`;
  return GET(new Request(url, { headers }), {
    params: Promise.resolve({ path: segmen }),
  });
}

describe("penyajian", () => {
  it("mengirim berkas dengan tipe isi dan cache immutable", async () => {
    await taruh(SEGMEN);
    const res = await panggil(SEGMEN);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Length")).toBe(String(ISI.length));
    expect(await res.text()).toBe(ISI);
  });

  it("memancarkan ETag dan menjawab 304 tanpa isi saat cocok", async () => {
    await taruh(SEGMEN);
    const pertama = await panggil(SEGMEN);
    const etag = pertama.headers.get("ETag");
    expect(etag).toBeTruthy();

    const kedua = await panggil(SEGMEN, { "if-none-match": etag as string });
    expect(kedua.status).toBe(304);
    expect(await kedua.text()).toBe("");
  });

  it("ETag yang berbeda tetap mengirim isi", async () => {
    await taruh(SEGMEN);
    const res = await panggil(SEGMEN, { "if-none-match": '"lain"' });
    expect(res.status).toBe(200);
  });

  it("melayani lagu dengan tipe audio", async () => {
    await taruh(["songs", "abc.mp3"]);
    const res = await panggil(["songs", "abc.mp3"]);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
  });
});

describe("Range — pemutar musik undangan", () => {
  it("menjawab 206 dengan potongan dan Content-Range", async () => {
    await taruh(["songs", "abc.mp3"]);
    const res = await panggil(["songs", "abc.mp3"], { range: "bytes=2-5" });

    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe(`bytes 2-5/${ISI.length}`);
    expect(res.headers.get("Content-Length")).toBe("4");
    expect(await res.text()).toBe("2345");
  });

  it("rentang di luar ukuran → 416 dengan ukuran sebenarnya", async () => {
    await taruh(["songs", "abc.mp3"]);
    const res = await panggil(["songs", "abc.mp3"], { range: "bytes=99-200" });

    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe(`bytes */${ISI.length}`);
  });

  it("Range yang tak dikenali dilayani utuh sebagai 200", async () => {
    await taruh(["songs", "abc.mp3"]);
    const res = await panggil(["songs", "abc.mp3"], { range: "items=0-2" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(ISI);
  });
});

describe("pagar", () => {
  it("404 bila berkasnya tak ada", async () => {
    expect((await panggil(SEGMEN)).status).toBe(404);
  });

  it("404 untuk direktori, bukan daftar isi", async () => {
    await taruh(SEGMEN);
    const res = await panggil(["inv", "85d261d6", "abc"]);
    expect(res.status).toBe(404);
  });

  it("404 untuk DIREKTORI yang bernama seperti berkas media", async () => {
    // Nama direktori di atas tak berekstensi, jadi ia tertolak oleh daftar-putih
    // tipe sebelum menyentuh disk — yang berarti penjaga `isFile()` tak pernah
    // terpanggil olehnya. Yang benar-benar mengujinya adalah direktori yang
    // LOLOS daftar-putih; tanpa penjaga itu, `readFile` melempar EISDIR dan
    // route menjawab 500, bukan 404.
    await mkdir(join(root, "inv", "x", "1600.webp"), { recursive: true });
    const res = await panggil(["inv", "x", "1600.webp"]);
    expect(res.status).toBe(404);
  });

  it("404 untuk ekstensi di luar daftar-putih WALAU berkasnya ada", async () => {
    await taruh(["rahasia.env"], "SUPABASE_SERVICE_ROLE_KEY=...");
    const res = await panggil(["rahasia.env"]);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("404 untuk sisa unggah `*.tmp`", async () => {
    await taruh(["inv", "x", "1600.webp.9f.tmp"], "separuh");
    const res = await panggil(["inv", "x", "1600.webp.9f.tmp"]);
    expect(res.status).toBe(404);
  });

  it("404 untuk path traversal", async () => {
    await writeFile(join(root, "..", "bocor.webp"), "rahasia");
    try {
      const res = await panggil(["..", "bocor.webp"]);
      expect(res.status).toBe(404);
    } finally {
      await rm(join(root, "..", "bocor.webp"), { force: true });
    }
  });

  it("404 saat driver aktif bukan `local`", async () => {
    // Dengan driver lain, URL media menunjuk host lain — route ini tak boleh
    // menganggur sebagai pembaca berkas di produksi.
    await taruh(SEGMEN);
    vi.stubEnv("STORAGE_DRIVER", "r2");
    expect((await panggil(SEGMEN)).status).toBe(404);
  });

  it("404 saat STORAGE_DRIVER kosong (default supabase)", async () => {
    await taruh(SEGMEN);
    vi.stubEnv("STORAGE_DRIVER", "");
    expect((await panggil(SEGMEN)).status).toBe(404);
  });
});
