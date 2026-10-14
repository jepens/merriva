import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalStorageDriver } from "@/lib/storage/local-driver";

/**
 * Driver `local` memegang filesystem VPS sendiri — tak ada vendor yang menahan
 * kesalahan di belakangnya. Yang diuji di sini adalah tiga janji yang membuatnya
 * setara dengan driver lain: berkas benar-benar mendarat, penghapusan idempoten,
 * dan URL yang dipancarkan tetap domain sendiri.
 *
 * Satu sifat driver ini TIDAK terjaga di sini, dan itu disengaja daripada
 * dijaga seolah-olah: penulisan atomik (tulis ke `*.tmp` lalu `rename`).
 * Hasil akhirnya identik dengan penulisan langsung, jadi satu-satunya cara
 * mengamatinya adalah memata-matai `node:fs/promises` — dan di Vitest v4 mock
 * builtin Node tidak menjangkau import statis milik modul `src` (sudah
 * dicoba: mock terpakai dari test sendiri, tidak dari driver). Test yang
 * ditulis begitu akan HIJAU tanpa pernah menjalankan mock-nya.
 * Yang dijaga di bawah adalah jejaknya yang memang terlihat: tak ada sisa
 * `*.tmp` setelah sukses maupun setelah gagal.
 */

let root: string;
let driver: LocalStorageDriver;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "merriva-media-"));
  vi.stubEnv("MEDIA_ROOT", root);
  vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://merriva.id/media");
  vi.stubEnv("NODE_ENV", "test");
  driver = new LocalStorageDriver();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

const PATH = "inv/85d261d6/abc/1600.webp";

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("upload", () => {
  it("menulis berkas di dalam akar dan mengembalikan path yang disimpan ke DB", async () => {
    const hasil = await driver.upload({
      path: PATH,
      body: bytes("foto"),
      contentType: "image/webp",
    });

    expect(hasil).toBe(PATH);
    const isi = await readFile(
      join(root, "inv", "85d261d6", "abc", "1600.webp"),
    );
    expect(isi.toString()).toBe("foto");
  });

  it("menerima Blob dan ArrayBuffer, bukan hanya Uint8Array", async () => {
    await driver.upload({
      path: "songs/a.mp3",
      body: new Blob(["lagu"]),
      contentType: "audio/mpeg",
    });
    await driver.upload({
      path: "songs/b.mp3",
      body: bytes("lagu2").buffer as ArrayBuffer,
      contentType: "audio/mpeg",
    });

    expect((await readFile(join(root, "songs", "a.mp3"))).toString()).toBe(
      "lagu",
    );
    expect((await readFile(join(root, "songs", "b.mp3"))).toString()).toBe(
      "lagu2",
    );
  });

  it("tidak meninggalkan berkas sementara setelah berhasil", async () => {
    await driver.upload({
      path: "songs/a.mp3",
      body: bytes("lagu"),
      contentType: "audio/mpeg",
    });
    const isi = await readdir(join(root, "songs"));
    expect(isi).toEqual(["a.mp3"]);
  });

  it("menimpa objek di path yang sama (setara upsert)", async () => {
    const tulis = (isi: string) =>
      driver.upload({
        path: PATH,
        body: bytes(isi),
        contentType: "image/webp",
      });
    await tulis("lama");
    await tulis("baru");
    const isi = await readFile(
      join(root, "inv", "85d261d6", "abc", "1600.webp"),
    );
    expect(isi.toString()).toBe("baru");
  });

  it("menolak path traversal sebelum menyentuh disk", async () => {
    await expect(
      driver.upload({
        path: "../../.env",
        body: bytes("x"),
        contentType: "image/webp",
      }),
    ).rejects.toThrow(/tidak sah/i);
  });

  it("tidak meninggalkan berkas sementara saat unggah GAGAL", async () => {
    // Direktori di path tujuan membuat `rename` gagal. Tanpa pembersihan,
    // setiap unggah gagal menumpuk sampah permanen di volume.
    await mkdir(join(root, "inv", "85d261d6", "abc", "1600.webp"), {
      recursive: true,
    });

    await expect(
      driver.upload({
        path: PATH,
        body: bytes("foto"),
        contentType: "image/webp",
      }),
    ).rejects.toThrow(/gagal unggah/i);

    const sisa = await readdir(join(root, "inv", "85d261d6", "abc"));
    expect(sisa).toEqual(["1600.webp"]);
  });
});

describe("getPublicUrl", () => {
  it("memakai domain sendiri, bukan path disk", () => {
    expect(driver.getPublicUrl(PATH)).toBe(`https://merriva.id/media/${PATH}`);
  });

  it("tidak menghasilkan garis miring ganda", () => {
    expect(driver.getPublicUrl(`/${PATH}`)).toBe(
      `https://merriva.id/media/${PATH}`,
    );
  });
});

describe("delete", () => {
  it("menghapus berkas", async () => {
    await driver.upload({
      path: PATH,
      body: bytes("foto"),
      contentType: "image/webp",
    });
    await driver.delete(PATH);
    await expect(
      stat(join(root, "inv", "85d261d6", "abc", "1600.webp")),
    ).rejects.toThrow();
  });

  it("idempoten — objek yang sudah tiada bukan kegagalan", async () => {
    // Cron purge & cleanup unggah memanggil ini best-effort; melempar di sini
    // akan membuat purge retensi berhenti di tengah daftar.
    await expect(driver.delete(PATH)).resolves.toBeUndefined();
  });

  it("merapikan direktori prefix yang jadi kosong", async () => {
    await driver.upload({
      path: PATH,
      body: bytes("foto"),
      contentType: "image/webp",
    });
    await driver.delete(PATH);
    await expect(stat(join(root, "inv", "85d261d6", "abc"))).rejects.toThrow();
  });

  it("TIDAK menghapus direktori yang masih berisi varian lain", async () => {
    await driver.upload({
      path: PATH,
      body: bytes("display"),
      contentType: "image/webp",
    });
    await driver.upload({
      path: "inv/85d261d6/abc/400.webp",
      body: bytes("thumb"),
      contentType: "image/webp",
    });
    await driver.delete(PATH);
    expect(await readdir(join(root, "inv", "85d261d6", "abc"))).toEqual([
      "400.webp",
    ]);
  });

  it("TIDAK pernah menghapus akar media (titik mount volume)", async () => {
    // Path satu segmen: `dirname` adalah AKAR. Menghapusnya di produksi berarti
    // membuang titik mount volume — unggah berikutnya diam-diam menulis ke
    // lapisan container lagi.
    await writeFile(join(root, "x.webp"), "x");
    await driver.delete("x.webp");
    await expect(stat(root)).resolves.toBeTruthy();
  });

  it("menolak path traversal", async () => {
    await expect(driver.delete("../../.env")).rejects.toThrow(/tidak sah/i);
  });
});
