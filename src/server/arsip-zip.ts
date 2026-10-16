import "server-only";

import { reportHandledError } from "@/lib/observability";

/**
 * Perakit arsip ZIP streaming untuk kedua route unduhan pemilik: foto galeri
 * (`/dashboard/undangan/[id]/galeri/zip`) dan Album Momen (`.../momen/zip`).
 *
 * KENAPA MODUL INI ADA. Kedua route merakit ZIP lewat generator: satu foto
 * ditarik, langsung dialirkan, lalu dilupakan — sehingga memori VPS tetap
 * ~1 foto berapa pun besar albumnya. Konsekuensinya status HTTP sudah TERKIRIM
 * sebelum satu byte foto pun diambil. Dan karena foto yang gagal diambil memang
 * SENGAJA dilewati (pemilik yang kehilangan satu foto jauh lebih baik daripada
 * pemilik yang tak bisa mengunduh apa pun menjelang purge), padamnya storage
 * secara TOTAL menghasilkan hal terburuk yang bisa dihasilkan jalur ini: berkas
 * ZIP yang sah, berstatus 200 OK, bernama `foto-galeri-andi-sinta.zip`, dan
 * kosong.
 *
 * Itu kegagalan yang tidak terlihat seperti kegagalan. Pemilik membukanya, tak
 * menemukan apa pun, dan pembacaan paling masuk akal baginya adalah "berarti
 * foto saya memang sudah hilang" — tepat pada momen yang dijanjikan email
 * peringatan pra-purge H-30/H-7 dan `/syarat` sebagai kesempatan terakhir
 * menyelamatkan datanya. Diamnya ganda: pemiliknya salah paham, dan kami tak
 * pernah tahu kejadiannya.
 *
 * YANG DIBETULKAN modul ini hanya satu pembedaan — SEBAGIAN gagal vs SEMUA
 * gagal:
 *
 *   - sebagian gagal → perilaku lama dipertahankan persis: 200, yang gagal
 *     dilewati, dan nomor urut tetap mengikuti posisi di daftar sehingga
 *     nomornya BERLUBANG, bukan bergeser (`foto-002` tanpa `foto-001` memberi
 *     tahu pemilik bahwa ada yang hilang; menggeser nomor justru menyembunyikan
 *     itu). Ditambah satu laporan ke Sentry berisi hitungannya;
 *   - semua gagal → sumber pertama yang berhasil dicari DULU, sebelum respons
 *     dikirim, sehingga 503 masih mungkin. Tak ada ZIP yang dibuat sama sekali.
 *
 * ONGKOSNYA satu fetch sebelum header terkirim. Pada arsip sehat itu fetch yang
 * memang akan dilakukan juga, hanya dimajukan, dan bodinya tetap belum dibaca
 * (masih stream) jadi memorinya tidak berubah. Pada storage yang benar-benar
 * padam seluruh daftar memang dicoba sebelum 503 — kerja yang sama persis
 * dengan yang dulu dilakukan generator di balik 200; bedanya jawabannya kini
 * benar.
 */

/** Satu entri ZIP. Bentuknya `InputWithMeta` milik `client-zip`. */
export type BerkasArsip = {
  name: string;
  input: Response;
  lastModified: Date;
};

/** Satu objek media yang hendak dimasukkan ke arsip. */
export type SumberArsip = {
  /** URL publik byte-nya (jalur penyajian yang sama untuk semua driver). */
  url: string;
  /** Nama di dalam ZIP — sudah ber-nomor urut posisi, sudah dibersihkan. */
  name: string;
  lastModified: Date;
};

export type HasilArsip =
  /** Storage tak memberi satu objek pun padahal daftarnya tidak kosong. */
  | { padam: true; dicoba: number }
  /** Siap dialirkan. Generator-nya baru berjalan saat `client-zip` menariknya. */
  | { padam: false; files: () => AsyncGenerator<BerkasArsip> };

/** Satu percakapan dengan storage. `null` = tak terpakai, apa pun sebabnya. */
async function ambil(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url);
    return res.ok && res.body ? res : null;
  } catch {
    // DNS mati, TLS ditolak, koneksi putus — sama saja bagi pemanggil.
    return null;
  }
}

/**
 * Siapkan arsip dari daftar sumber. `area` dipakai sebagai tag Sentry
 * (mis. `zip.galeri`), `extra` menempel pada laporannya.
 */
export async function siapkanArsip(
  sumber: SumberArsip[],
  area: string,
  extra: Record<string, unknown> = {},
): Promise<HasilArsip> {
  // Cari sumber pertama yang hidup. Selama belum ada yang ditemukan, respons
  // belum dikirim — dan hanya selama itulah 503 masih mungkin.
  let i = 0;
  let pertama: Response | null = null;
  while (i < sumber.length && pertama === null) {
    pertama = await ambil(sumber[i].url);
    i += 1;
  }

  // Daftar KOSONG bukan padam: album yang seluruh fotonya dimoderasi keluar
  // memang menghasilkan ZIP kosong, dan itu jawaban yang benar. Yang berarti
  // storage bermasalah hanyalah daftar BERISI yang tak memberi satu objek pun.
  if (pertama === null && sumber.length > 0) {
    reportHandledError(
      new Error(
        `Arsip ZIP batal: ${sumber.length} objek media, tak satu pun bisa diambil`,
      ),
      area,
      { ...extra, dicoba: sumber.length },
    );
    return { padam: true, dicoba: sumber.length };
  }

  const awal = pertama; // sudah di tangan — JANGAN di-fetch ulang
  const indeksAwal = i - 1; // −1 hanya saat daftarnya memang kosong
  const gagalSebelumnya = awal === null ? 0 : indeksAwal;
  const lanjutDari = i;

  async function* files() {
    let gagal = gagalSebelumnya;
    if (awal !== null) yield { ...sumber[indeksAwal], input: awal };

    for (let k = lanjutDari; k < sumber.length; k += 1) {
      const res = await ambil(sumber[k].url);
      if (res === null) {
        gagal += 1;
        continue;
      }
      yield { ...sumber[k], input: res };
    }

    // Dilaporkan SETELAH arsipnya utuh: pemilik tetap mendapat unduhannya, dan
    // kami tetap tahu bahwa storage menjatuhkan sebagian objek. Tanpa ini
    // satu-satunya saksi atas objek yang hilang adalah pemilik yang menghitung
    // sendiri isi ZIP-nya.
    if (gagal > 0) {
      reportHandledError(
        new Error(
          `Arsip ZIP tak lengkap: ${gagal} dari ${sumber.length} objek media gagal diambil`,
        ),
        area,
        { ...extra, gagal, total: sumber.length },
      );
    }
  }

  return { padam: false, files };
}

/**
 * Respons 503 untuk arsip yang batal. Teksnya dibaca pemilik di tab peramban —
 * unduhannya gagal, jadi badan respons inilah yang tampil — maka ia harus
 * menyebut apa yang terjadi DAN apa yang harus dilakukan, bukan sekadar kode.
 */
export function responsArsipPadam(pesan: string): Response {
  return new Response(pesan, {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Nomor urut posisi, ber-padding: `001`, `002`, … */
export function urutan(i: number): string {
  return String(i).padStart(3, "0");
}
