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

describe("cache musik unggahan (DECISIONS #121)", () => {
  // Objek `audio/` bisa DIHAPUS admin karena laporan hak cipta. Cache
  // `immutable` setahun di Cloudflare berarti lagu yang di-takedown tetap
  // diputar ke tamu sampai purge manual — maka maks. 1 jam, di SEMUA jawaban.
  const AUDIO = [
    "audio",
    "85d261d6-1c2b-4e3a-9f00-0a1b2c3d4e5f",
    "0f1e2d3c-4b5a-4968-8776-655443322110.mp3",
  ];
  const SEJAM = "public, max-age=3600";

  it("200, 206, dan 304 memakai max-age 1 jam, bukan immutable", async () => {
    await taruh(AUDIO);
    const utuh = await panggil(AUDIO);
    expect(utuh.status).toBe(200);
    expect(utuh.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(utuh.headers.get("Cache-Control")).toBe(SEJAM);

    const potong = await panggil(AUDIO, { range: "bytes=2-5" });
    expect(potong.status).toBe(206);
    expect(potong.headers.get("Cache-Control")).toBe(SEJAM);

    const etag = utuh.headers.get("ETag") as string;
    const sama = await panggil(AUDIO, { "if-none-match": etag });
    expect(sama.status).toBe(304);
    expect(sama.headers.get("Cache-Control")).toBe(SEJAM);
  });

  it("segmen kosong di depan tak bisa memulihkan cache setahun", async () => {
    // Keputusan dibuat dari segmen yang dinormalkan — sama dengan pembaca
    // berkas — bukan dari teks URL.
    await taruh(AUDIO);
    const res = await panggil(["", ...AUDIO]);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(SEJAM);
  });

  it("lagu pustaka `songs/` tetap immutable setahun", async () => {
    await taruh(["songs", "abc.mp3"]);
    const res = await panggil(["songs", "abc.mp3"]);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
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

  it("video undangan: tipe video (webm bukan audio) dan potongan yang di-stream", async () => {
    // FASE J — `.webm` juga ada di peta audio; video harus menang supaya
    // `<video>` tak diberi tipe audio. Isi dibaca sebatas rentang, bukan utuh.
    const dir = ["video", "85d261d6", "abc"];
    await taruh([...dir, "video.mp4"]);
    await taruh([...dir, "video.webm"]);
    const mp4 = await panggil([...dir, "video.mp4"], { range: "bytes=7-" });
    expect(mp4.status).toBe(206);
    expect(mp4.headers.get("Content-Type")).toBe("video/mp4");
    expect(mp4.headers.get("Content-Range")).toBe(`bytes 7-9/${ISI.length}`);
    expect(await mp4.text()).toBe("789");
    const webm = await panggil([...dir, "video.webm"]);
    expect(webm.headers.get("Content-Type")).toBe("video/webm");
  });

  it("berkas kosong tetap 200 dengan isi kosong", async () => {
    await taruh(SEGMEN, "");
    const res = await panggil(SEGMEN);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Length")).toBe("0");
    expect(await res.text()).toBe("");
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
