"use client";

import { useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { copy } from "@/lib/copy";
import {
  CUSTOM_MUSIC_ACCEPT_ATTR,
  CUSTOM_MUSIC_ATTEST_HEADER,
  CUSTOM_MUSIC_ATTEST_VERSION,
  parseMp3,
  validateCustomMusicDuration,
  validateCustomMusicFile,
  type CustomMusicUploadError,
  type CustomMusicUploadResult,
} from "@/lib/custom-music";
import { cn } from "@/lib/utils";
import type { CustomMusic } from "@/lib/validation/content";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

const M = copy.editor.customMusic;

type MusicError = keyof typeof M.errors;
type Busy = "reading" | "working" | null;

/**
 * URL lagu yang diunggah dalam SESI HALAMAN INI, per path objek. Tingkat
 * modul, bukan state: berpindah langkah editor meng-unmount komponen ini, dan
 * state lokal ikut hilang — dulu lagu yang baru diunggah lenyap dari tampilan
 * (beserta tombol Hapus-nya), atau pemutar memutar lagu LAMA dari server di
 * bawah nama BARU. Path memuat id undangan dan UUID baru per unggahan, jadi
 * kuncinya tak pernah bertabrakan.
 */
const urlUnggahan = new Map<string, string>();

/**
 * Nama berkas asli untuk ditampilkan di editor (tak pernah dirender ke tamu).
 * Dipangkas ke batas skema; surrogate tunggal di ujung potongan dibuang karena
 * jsonb Postgres menolaknya — dan penolakan itu menggagalkan SELURUH autosave.
 */
function namaLagu(nama: string): string | undefined {
  let n = nama.trim();
  if (n.length > L.common.customMusicName) {
    n = n.slice(0, L.common.customMusicName);
    if (/[\uD800-\uDBFF]$/.test(n)) n = n.slice(0, -1);
    n = n.trimEnd();
  }
  return n || undefined;
}

/**
 * Alasan penolakan → kunci pesan. Jawaban bukan-JSON (proksi, batas body Next,
 * jaringan) tak membawa `reason`, jadi status HTTP-nya yang dibaca.
 */
function alasanGagal(
  res: Response,
  hasil: CustomMusicUploadResult | null,
): MusicError {
  const reason: CustomMusicUploadError | undefined =
    hasil?.status === "error" ? hasil.reason : undefined;
  // Penolakan pernyataan DARI SERVER berarti versinya usang (halaman dimuat
  // sebelum teksnya diperbarui) — kotaknya sudah tercentang, jadi pesan
  // "centang dulu" (`attest`, penjaga klien) keliru di sini.
  if (reason === "attest") return "attestStale";
  if (reason && Object.hasOwn(M.errors, reason)) return reason;
  if (res.status === 401) return "auth";
  if (res.status === 413) return "size";
  if (res.status === 429) return "rate";
  return "server";
}

/**
 * Blok "Lagu sendiri (MP3)" di langkah Pengaturan, di bawah picker pustaka
 * (DECISIONS #121). Lagu sendiri menggantikan lagu pustaka saat diputar;
 * `settings.songId` tak disentuh, jadi menghapus lagu sendiri mengembalikan
 * undangan ke pilihan pustakanya.
 *
 * Alur: tipe & ukuran → isi dibaca sebagai rantai frame MP3 (`parseMp3`, aturan
 * yang SAMA dengan route) → durasi → `POST /api/invitations/{id}/music` dengan
 * versi pernyataan hak yang dicentang. Pemeriksaan di sini hanya pesan cepat
 * tanpa jaringan; route yang menegakkan semuanya. Yang masuk ke form hanya
 * `{ path, name }` — AUTOSAVE yang menyimpannya (pola video).
 *
 * Pernyataan hak berlaku PER UNGGAHAN: centangnya dikosongkan sesudah sukses.
 * Tak ada aksi hapus dari klien — objek yang tak lagi dirujuk `content` disapu
 * cron sesudah 24 jam, jadi menekan "Hapus lagu" lalu memuat ulang sebelum
 * autosave tak pernah meninggalkan rujukan ke objek yang sudah hilang.
 *
 * Yang tampil ditentukan NILAI FORM (`value`), bukan state lokal: nama + tombol
 * Hapus selalu ada selama form merujuk sebuah lagu; pemutar hanya bila URL
 * untuk path ITU diketahui (unggahan sesi ini, atau `initialPath` dari server
 * yang sudah dipastikan masih hidup).
 *
 * `allowed` dan `lockedAt` di sini hanya tampilan; route menolak sendiri.
 */
export function MusicField({
  invitationId,
  allowed,
  lockedAt,
  value,
  initialPath,
  initialUrl,
  onChange,
  onBusyChange,
}: {
  invitationId: string;
  /** Undangan Premium (`!limits.watermark`, dari server). */
  allowed: boolean;
  /** `invitations.music_locked_at` — dikunci admin sesudah takedown. */
  lockedAt: string | null;
  value: CustomMusic | undefined;
  /** Path lagu tersimpan yang masih hidup (server) — pemilik `initialUrl`. */
  initialPath: string | null;
  /** URL untuk `initialPath`, dirakit di server saat halaman dimuat. */
  initialUrl: string | null;
  onChange: (music: CustomMusic | undefined) => void;
  /**
   * Unggahan mulai (`true`) / selesai (`false`) — kerangka editor menahan
   * "Selesai" selama ini `true`, karena berpindah ke pratinjau sebelum hasil
   * unggahan masuk form membuangnya diam-diam. Dilaporkan oleh alur unggah
   * itu sendiri, jadi tetap berpasangan walau komponen ini ter-unmount di
   * tengah unggahan (pindah langkah): `false` menyusul saat unggahan benar-benar
   * selesai, bukan saat komponennya hilang.
   */
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const attestRef = useRef<HTMLInputElement>(null);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const unggahBerjalan = useRef(false);
  const hintId = useId();
  const [attested, setAttested] = useState(false);
  const [busy, setBusyState] = useState<Busy>(null);
  const [error, setError] = useState<MusicError | null>(null);
  const [pengumuman, setPengumuman] = useState<"uploaded" | "removed" | null>(
    null,
  );

  const url = value
    ? (urlUnggahan.get(value.path) ??
      (value.path === initialPath ? initialUrl : null))
    : null;
  const punyaLagu = value !== undefined;
  const namaTampil = value?.name ?? M.unnamed;

  function setBusy(next: Busy) {
    setBusyState(next);
    const aktif = next !== null;
    if (unggahBerjalan.current === aktif) return;
    unggahBerjalan.current = aktif;
    onBusyChange?.(aktif);
  }

  function bersihkanInput() {
    // Supaya memilih BERKAS YANG SAMA lagi tetap memicu `change`.
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setPengumuman(null);
    // Tombol sudah mati tanpa centang; ini penjaga bila input dipicu langsung.
    if (!attested) {
      setError("attest");
      bersihkanInput();
      return;
    }
    const masalahBerkas = validateCustomMusicFile(file);
    if (masalahBerkas) {
      setError(masalahBerkas);
      bersihkanInput();
      return;
    }
    try {
      setBusy("reading");
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await file.arrayBuffer());
      } catch {
        setError("unreadable");
        return;
      }
      const mp3 = parseMp3(bytes);
      if (!mp3.ok) {
        setError(mp3.reason);
        return;
      }
      const masalahDurasi = validateCustomMusicDuration(mp3.durationSec);
      if (masalahDurasi) {
        setError(masalahDurasi);
        return;
      }

      setBusy("working");
      const res = await fetch(`/api/invitations/${invitationId}/music`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": "audio/mpeg",
          [CUSTOM_MUSIC_ATTEST_HEADER]: String(CUSTOM_MUSIC_ATTEST_VERSION),
        },
      });
      const hasil = (await res
        .json()
        .catch(() => null)) as CustomMusicUploadResult | null;
      if (!hasil || hasil.status !== "success") {
        setError(alasanGagal(res, hasil));
        return;
      }

      // URL dicatat SEBELUM form berubah: render yang dipicu `onChange` sudah
      // harus menemukannya.
      urlUnggahan.set(hasil.path, hasil.url);
      onChange({ path: hasil.path, name: namaLagu(file.name) });
      setAttested(false);
      setPengumuman("uploaded");
    } catch {
      setError("server");
    } finally {
      setBusy(null);
      bersihkanInput();
    }
  }

  function onRemove() {
    setError(null);
    onChange(undefined);
    setPengumuman("removed");
    // Tombol Hapus lenyap bersama lagunya; tanpa ini fokus jatuh ke <body> dan
    // pengguna keyboard/pembaca layar kehilangan tempatnya. Langkah berikut
    // yang wajar adalah pernyataan hak (syarat unggah lagu pengganti); di
    // undangan non-Premium tak ada isian lagi, jadi fokus ke kelompoknya.
    (allowed ? attestRef.current : fieldsetRef.current)?.focus();
  }

  const tombolHapus = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy !== null}
      onClick={onRemove}
    >
      {M.remove}
    </Button>
  );

  let isi: ReactNode;
  if (lockedAt) {
    // Dikunci admin lebih dulu: pesan "khusus Premium" menyesatkan bila
    // undangan itu tetap tak bisa mengunggah sesudah naik paket.
    isi = (
      <p className="text-muted-foreground text-xs">
        {M.lockedByAdmin(copy.support.email)}
      </p>
    );
  } else if (!allowed) {
    // Turun paket: lagu tersimpan tak diputar (perakit render) tetapi tetap
    // milik pemilik — ia boleh menghapusnya. Unggah tidak ditawarkan.
    isi = punyaLagu ? (
      <div className="space-y-2">
        <p className="text-sm">
          <span className="text-muted-foreground">{M.current}: </span>
          <span className="font-medium break-all">{namaTampil}</span>
        </p>
        <p className="text-muted-foreground text-xs">{M.lockedHasSong}</p>
        {tombolHapus}
      </div>
    ) : (
      <p className="text-muted-foreground text-xs">{M.locked}</p>
    );
  } else {
    isi = (
      <>
        <p className="text-muted-foreground text-xs">{M.priority}</p>

        {punyaLagu ? (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">{M.current}: </span>
              <span className="font-medium break-all">{namaTampil}</span>
            </p>
            {url ? (
              <audio
                key={url}
                controls
                preload="none"
                src={url}
                aria-label={M.preview}
                className="w-full"
              />
            ) : (
              // Rujukan tanpa objek hidup (dihapus admin, atau disapu cron
              // karena tak tersimpan tepat waktu) — perakit render sudah
              // memutar lagu pustaka sebagai gantinya; jelaskan itu di sini.
              <p className="text-muted-foreground text-xs">{M.notPlayed}</p>
            )}
            {tombolHapus}
          </div>
        ) : null}

        <label className="flex items-start gap-2 text-xs leading-relaxed">
          <Checkbox
            ref={attestRef}
            className="mt-0.5"
            checked={attested}
            disabled={busy !== null}
            onChange={(e) => setAttested(e.target.checked)}
          />
          <span>{M.attest}</span>
        </label>

        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!attested || busy !== null}
            aria-describedby={attested ? undefined : hintId}
            onClick={() => inputRef.current?.click()}
          >
            {busy === "reading"
              ? M.reading
              : busy === "working"
                ? M.working
                : punyaLagu
                  ? M.replace
                  : M.add}
          </Button>
          {attested ? null : (
            <p id={hintId} className="text-muted-foreground text-xs">
              {M.attestNeeded}
            </p>
          )}
        </div>

        <p className="text-muted-foreground text-xs">{M.limits}</p>

        <input
          ref={inputRef}
          type="file"
          accept={CUSTOM_MUSIC_ACCEPT_ATTR}
          hidden
          aria-label={punyaLagu ? M.replace : M.add}
          onChange={(e) => onFile(e.target.files)}
        />
      </>
    );
  }

  const siaran =
    busy === "reading"
      ? M.reading
      : busy === "working"
        ? M.working
        : pengumuman === "uploaded"
          ? M.uploaded
          : pengumuman === "removed"
            ? M.removed
            : "";

  return (
    <fieldset
      ref={fieldsetRef}
      // Target fokus sesudah "Hapus lagu" di undangan non-Premium (tak ada
      // isian lain di sana). Tidak masuk urutan Tab.
      tabIndex={!lockedAt && !allowed ? -1 : undefined}
      className={cn(
        "rounded-lg border p-3 outline-none",
        lockedAt || !allowed ? "space-y-2" : "space-y-3",
      )}
    >
      <legend className="px-1 text-sm font-medium">{M.legend}</legend>
      {/* Selalu ada (WCAG 4.1.3): region yang baru muncul bersama isinya
          sering tak diumumkan. */}
      <p role="status" aria-live="polite" className="sr-only">
        {siaran}
      </p>
      {isi}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {M.errors[error]}
        </p>
      ) : null}
    </fieldset>
  );
}
