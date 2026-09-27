"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { copy } from "@/lib/copy";
import { encodeCanvas, type EncodedFormat } from "@/lib/image/encode";
import {
  countdownParts,
  msUntilReveal,
  resolveAlbumPhase,
  type AlbumPhase,
} from "@/lib/momen/album-phase";
import { getDefaultFilmBaker } from "@/lib/momen/film-bake";
import { FILM_PRESETS, getFilmPreset } from "@/lib/momen/film-presets";
import { cn } from "@/lib/utils";
import {
  loadMomenPhotosAction,
  startMomenSessionAction,
  uploadMomenPhotoAction,
} from "@/server/actions/momen-guest";
import { TurnstileWidget } from "@/components/public/guestbook/turnstile-widget";

import "./momen.css";

const c = copy.momen;
const DISPLAY_MAX = 1600;
const THUMB_MAX = 400;
const NAME_KEY = "momen-nama";
const DEVICE_KEY = "momen-device";

export interface MomenPhotoView {
  id: string;
  guestName: string;
  filterId: string;
  url: string;
  thumbUrl: string;
}

export interface MomenCameraProps {
  slug: string;
  quotaPerGuest: number;
  defaultFilter: string;
  allowLibraryUpload: boolean;
  revealAtIso: string | null;
  heroTitle: string;
  dateLabel: string | null;
  turnstileSiteKey: string | null;
  initialPhotos: MomenPhotoView[];
  /** Kursor halaman berikutnya (PER-4); null = album sudah termuat semua. */
  initialCursor: string | null;
  /** Jumlah foto & fotografer dari AGREGAT DB — bukan dari daftar yang termuat. */
  totalPhotos: number;
  photographers: number;
}

type Screen = "masuk" | "kamera" | "habis" | "galeri";

const lsGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* mode privat / storage penuh → abaikan */
  }
};

/** Jepretan yang gagal terkirim dan masih bisa dikirim ulang (DECISIONS #46). */
interface PendingShot {
  v: Variants;
  source: "camera" | "library";
  /**
   * Filter yang sudah DIPANGGANG ke piksel. Wajib disimpan: strip filter tetap
   * hidup di balik panel galat, dan mengirim ulang dengan `selectedFilter` yang
   * sedang aktif akan mencatat nama film yang salah pada foto itu (kapsi galeri
   * & lightbox ikut salah).
   */
  filterId: string;
  /** Pesan penolakannya — untuk membedakannya dari galat lain di layar. */
  message: string;
}

interface Variants {
  /**
   * Identitas jepretan ini, dibuat SEKALI saat dipanggang dan dikirim ulang apa
   * adanya di tiap percobaan → server bisa mengenali kiriman yang sama dan tak
   * menggandakan foto/jatah (DECISIONS #46).
   */
  shotId: string;
  displayBlob: Blob;
  thumbBlob: Blob;
  format: EncodedFormat;
  width: number;
  height: number;
  displayUrl: string;
}

/**
 * Bake filter (pixel pipeline, BUKAN ctx.filter) lalu encode 2 varian.
 * Matematika piksel berjalan di Web Worker bila tersedia (AUDIT PER-6); API
 * kanvas (getImageData/putImageData/encode) tetap di main thread.
 */
async function bakeAndEncode(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  sourceW: number,
  sourceH: number,
  filterId: string,
  seed: number,
): Promise<Variants> {
  const scale = Math.min(1, DISPLAY_MAX / Math.max(sourceW, sourceH));
  const dw = Math.max(2, Math.round(sourceW * scale));
  const dh = Math.max(2, Math.round(sourceH * scale));

  const display = document.createElement("canvas");
  display.width = dw;
  display.height = dh;
  const dctx = display.getContext("2d", { willReadFrequently: true });
  if (!dctx) throw new Error("canvas 2d tak tersedia");
  draw(dctx, dw, dh);
  // Bake 1600×1200 = 60–95 juta operasi float; dulu satu task sinkron di main
  // thread → tombol rana membeku saat tamu memotret. Kini di worker. `read`
  // boleh dipanggil ulang untuk fallback main thread: kanvas belum diubah
  // sampai `putImageData` di bawah, jadi foto tak berganti ke frame berikutnya.
  const baked = await getDefaultFilmBaker().bake({
    read: () => dctx.getImageData(0, 0, dw, dh).data,
    width: dw,
    height: dh,
    filterId,
    seed,
  });
  const img = dctx.createImageData(dw, dh);
  img.data.set(baked.data);
  dctx.putImageData(img, 0, 0);

  const tscale = Math.min(1, THUMB_MAX / Math.max(dw, dh));
  const tw = Math.max(2, Math.round(dw * tscale));
  const th = Math.max(2, Math.round(dh * tscale));
  const thumb = document.createElement("canvas");
  thumb.width = tw;
  thumb.height = th;
  const tctx = thumb.getContext("2d");
  if (!tctx) throw new Error("canvas 2d tak tersedia");
  tctx.drawImage(display, 0, 0, tw, th);

  const { blob: displayBlob, format } = await encodeCanvas(display, 0.82);
  const { blob: thumbBlob } = await encodeCanvas(thumb, 0.75);
  return {
    shotId: crypto.randomUUID(),
    displayBlob,
    thumbBlob,
    format,
    width: dw,
    height: dh,
    displayUrl: URL.createObjectURL(displayBlob),
  };
}

export function MomenCamera(props: MomenCameraProps) {
  const {
    slug,
    quotaPerGuest,
    defaultFilter,
    allowLibraryUpload,
    revealAtIso,
    heroTitle,
    dateLabel,
    turnstileSiteKey,
    initialPhotos,
    initialCursor,
  } = props;

  const [screen, setScreen] = useState<Screen>("masuk");
  const [name, setName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [tsToken, setTsToken] = useState("");
  const [remaining, setRemaining] = useState(quotaPerGuest);
  const [taken, setTaken] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState(defaultFilter);
  const [photos, setPhotos] = useState<MomenPhotoView[]>(initialPhotos);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  /**
   * Galat "muat lebih" punya state SENDIRI: panel galat & toast hanya hidup di
   * layar kamera, sedangkan tombol ini ada di layar galeri — memakai `error`
   * berarti tamu tak melihat apa pun saat halaman berikutnya gagal.
   */
  const [galleryError, setGalleryError] = useState<string | null>(null);
  // Angka ringkasan berasal dari agregat server; hitungan lokal hanya menambah
  // foto yang BARU saja diunggah tamu ini (galeri tak lagi memuat album penuh).
  const [totalPhotos, setTotalPhotos] = useState(props.totalPhotos);
  const [busy, setBusy] = useState(false);
  /**
   * Jepretan yang GAGAL diunggah, disimpan untuk dikirim ulang (DECISIONS
   * #46). Dulu blob-nya langsung dibuang saat aksi menolak — termasuk saat
   * penolakan itu hanya gangguan DB sesaat — dan momen di acara tak bisa
   * diulang.
   */
  const [pending, setPending] = useState<PendingShot | null>(null);
  const [starting, setStarting] = useState(false);
  const [tsReset, setTsReset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [camError, setCamError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lightbox, setLightbox] = useState<MomenPhotoView | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<"environment" | "user">("environment");
  const flashRef = useRef<HTMLDivElement>(null);

  const phase: AlbumPhase = resolveAlbumPhase(now, revealAtIso);
  // Saat reveal tiba sambil di layar "habis", tampilkan galeri lewat DERIVASI
  // (bukan setState dalam efek → hindari set-state-in-effect).
  const shownScreen: Screen =
    screen === "habis" && phase === "revealed" ? "galeri" : screen;
  const preset = getFilmPreset(selectedFilter);

  // Init identitas perangkat + nama tersimpan (localStorage). setState di callback
  // timer, bukan sinkron di badan efek → tak memicu `set-state-in-effect`; juga
  // menghindari hydration-mismatch (server render selalu kosong dulu).
  useEffect(() => {
    const id = setTimeout(() => {
      setName(lsGet(NAME_KEY) ?? "");
      let dev = lsGet(DEVICE_KEY);
      if (!dev) {
        dev = crypto.randomUUID();
        lsSet(DEVICE_KEY, dev);
      }
      setDeviceId(dev);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Detak untuk countdown + flip fase saat reveal terlampaui. BERHENTI setelah
  // reveal: tanpa ini React mendiff seluruh grid foto tiap detik selamanya —
  // termasuk saat tamu sedang membidik (AUDIT PER-7).
  useEffect(() => {
    if (revealAtIso === null) return;
    if (resolveAlbumPhase(Date.now(), revealAtIso) === "revealed") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [revealAtIso]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingRef.current,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCamError(false);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCamError(true);
    }
  }, []);

  // Buka/tutup kamera mengikuti layar. `startCamera` dipanggil dari callback
  // timer (bukan sinkron di badan efek) → tak memicu `set-state-in-effect`.
  useEffect(() => {
    if (screen !== "kamera") {
      stopStream();
      return;
    }
    const kick = setTimeout(() => void startCamera(), 0);
    return () => {
      clearTimeout(kick);
      stopStream();
    };
  }, [screen, startCamera, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  // Lepas object URL jepretan tertunda saat halaman ditinggalkan. Ref dipakai
  // agar pelepasan HANYA terjadi saat unmount: `pending` yang berubah menjadi
  // null pada jalur sukses masih memakai URL itu untuk pratinjau galeri.
  const pendingRef = useRef<PendingShot | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(
    () => () => {
      const p = pendingRef.current;
      if (p) URL.revokeObjectURL(p.v.displayUrl);
    },
    [],
  );

  const flash = () => {
    const el = flashRef.current;
    if (!el) return;
    el.classList.remove("mn-zap");
    void el.offsetWidth;
    el.classList.add("mn-zap");
  };
  const popToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2100);
  };
  /**
   * Kegagalan yang HARUS terlihat tamu: pesan persisten (dirender di layar masuk
   * DAN layar kamera) + toast. Sebelumnya banyak jalur hanya `setError`, yang di
   * layar kamera tak dirender sama sekali → gagal senyap (AUDIT KUA/UXA-2).
   */
  const fail = (msg: string) => {
    setError(msg);
    popToast(msg);
  };

  /**
   * Pengiriman MELEMPAR (bukan menolak): WiFi venue putus di tengah unggah
   * ~1,5 MB, atau id Server Action basi sesudah deploy. `sendPhoto` keluar
   * sebelum sempat menandai apa pun, jadi jepretan yang sudah dipanggang harus
   * diselamatkan di sini — kalau tidak, pesan "Coba lagi" muncul tanpa satu pun
   * cara mematuhinya dan momennya hilang (koreksi review #46).
   */
  const keepThrownShot = (
    v: Variants | null,
    source: "camera" | "library",
    filterId: string,
  ) => {
    if (v) setPending({ v, source, filterId, message: c.error.generic });
    fail(c.error.generic);
  };

  /** Lepas jepretan tertunda (jepretan baru menggantikannya). */
  const discardPending = () => {
    setPending((p) => {
      if (p) URL.revokeObjectURL(p.v.displayUrl);
      return null;
    });
  };

  async function beginSession(goGallery: boolean) {
    const trimmed = name.trim();
    if (!trimmed || !deviceId || starting) return;
    setError(null);
    setStarting(true);
    try {
      const fd = new FormData();
      fd.set("guestName", trimmed);
      fd.set("deviceId", deviceId);
      fd.set("turnstileToken", tsToken);
      const res = await startMomenSessionAction(slug, fd);
      if (res.status !== "ok") {
        setError(res.message ?? c.error.generic);
        // Token Turnstile sekali pakai & sudah hangus di server; tanpa reset,
        // "coba lagi" selalu gagal verifikasi (DECISIONS #46).
        setTsToken("");
        setTsReset((n) => n + 1);
        return;
      }
      lsSet(NAME_KEY, trimmed);
      setRemaining(res.remaining);
      setTaken(res.deviceCount);
      if (goGallery || (phase === "revealed" && res.remaining === 0)) {
        setScreen("galeri");
      } else {
        // Jatah sudah habis pada album TERJADWAL (tamu membuka link lagi) →
        // layar "habis" + countdown, bukan kamera dengan shutter mati senyap.
        setScreen(res.remaining <= 0 ? "habis" : "kamera");
      }
    } catch {
      // Aksi MELEMPAR (jaringan venue putus) — tanpa ini tamu hanya melihat
      // tombol kembali aktif tanpa satu pun penjelasan. Pesannya BUKAN "gagal
      // menyimpan foto": di layar masuk belum ada satu pun jepretan.
      setError(c.error.temporary);
      setTsToken("");
      setTsReset((n) => n + 1);
    } finally {
      setStarting(false);
    }
  }

  async function sendPhoto(
    v: Variants,
    source: "camera" | "library",
    filterId: string,
  ) {
    const ext = v.format === "webp" ? "webp" : "jpg";
    const fd = new FormData();
    // Filter dari JEPRETANNYA (bukan `selectedFilter` saat ini): tamu bisa
    // menyentuh strip filter sambil panel galat terbuka.
    fd.set("shotId", v.shotId);
    fd.set("filterId", filterId);
    fd.set("format", v.format);
    // Asal foto dideklarasikan agar server bisa menegakkan `allow_library_upload`.
    fd.set("source", source);
    fd.set("width", String(v.width));
    fd.set("height", String(v.height));
    fd.set("displayBytes", String(v.displayBlob.size));
    fd.set("thumbBytes", String(v.thumbBlob.size));
    fd.set("display", v.displayBlob, `display.${ext}`);
    fd.set("thumb", v.thumbBlob, `thumb.${ext}`);

    const res = await uploadMomenPhotoAction(slug, fd);
    if (res.status !== "ok") {
      // Penolakan SESAAT (DB/storage/rate-limit) → jepretan DIPERTAHANKAN agar
      // tombol "Kirim ulang" mengirim foto yang SAMA: momen di acara tak bisa
      // diulang. Penolakan permanen (jatah habis, album nonaktif, format
      // ditolak) tetap membuang blob — tombol di sana hanya harapan palsu.
      if (res.retryable) {
        setPending({
          v,
          source,
          filterId,
          message: res.message ?? c.error.generic,
        });
      } else {
        // Termasuk saat percobaan ULANG ditolak permanen (mis. jatah baru saja
        // habis): tombolnya harus hilang, bukan menunjuk blob yang sudah lepas.
        setPending(null);
        URL.revokeObjectURL(v.displayUrl);
      }
      fail(res.message ?? c.error.generic);
      return;
    }
    setPending(null);
    setError(null);
    setRemaining(res.remaining);
    setTaken((t) => t + 1);
    flash();
    popToast(
      phase === "revealed" ? c.camera.savedInstant : c.camera.savedHidden,
    );
    if (phase === "revealed") {
      setTotalPhotos((n) => n + 1);
      setPhotos((prev) => [
        {
          id: `local-${Date.now()}`,
          guestName: name.trim() || "Tamu",
          filterId,
          url: v.displayUrl,
          thumbUrl: v.displayUrl,
        },
        ...prev,
      ]);
    } else {
      URL.revokeObjectURL(v.displayUrl);
    }
    if (res.remaining <= 0) {
      window.setTimeout(
        () => setScreen(phase === "revealed" ? "galeri" : "habis"),
        900,
      );
    }
  }

  /** Kirim ulang jepretan yang gagal (foto yang sama, bukan jepretan baru). */
  async function retryPending() {
    if (!pending || busy) return;
    setError(null);
    setBusy(true);
    try {
      await sendPhoto(pending.v, pending.source, pending.filterId);
    } catch {
      fail(c.error.generic);
    } finally {
      setBusy(false);
    }
  }

  async function shoot() {
    const video = videoRef.current;
    if (busy || remaining <= 0 || !video || video.videoWidth === 0) return;
    setError(null);
    setBusy(true);
    let shot: Variants | null = null;
    try {
      shot = await bakeAndEncode(
        (ctx, w, h) => ctx.drawImage(video, 0, 0, w, h),
        video.videoWidth,
        video.videoHeight,
        selectedFilter,
        taken + 1,
      );
      // Baru DI SINI jepretan lama dilepas: `bakeAndEncode` bisa gagal (kanvas
      // kehabisan memori di HP murah), dan membuangnya lebih dulu berarti
      // jepretan yang masih bisa dikirim ikut musnah tanpa pengganti.
      discardPending();
      await sendPhoto(shot, "camera", selectedFilter);
    } catch {
      keepThrownShot(shot, "camera", selectedFilter);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined, source: "camera" | "library") {
    if (!file || busy || remaining <= 0) return;
    // HEIC/HEIF = bawaan kamera iPhone → sering terpilih dari galeri. Pesan harus
    // spesifik & menawarkan jalan keluar, bukan "Data foto tidak valid".
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      fail(c.error.formatUnsupported);
      return;
    }
    setError(null);
    setBusy(true);
    let shot: Variants | null = null;
    try {
      let bmp: ImageBitmap;
      try {
        bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        bmp = await createImageBitmap(file);
      }
      shot = await bakeAndEncode(
        (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
        bmp.width,
        bmp.height,
        selectedFilter,
        taken + 1,
      );
      bmp.close?.();
      // Lihat `shoot()`: pengganti dulu jadi, baru yang lama dilepas.
      discardPending();
      await sendPhoto(shot, source, selectedFilter);
    } catch {
      keepThrownShot(shot, source, selectedFilter);
    } finally {
      setBusy(false);
    }
  }

  async function flip() {
    facingRef.current =
      facingRef.current === "environment" ? "user" : "environment";
    stopStream();
    await startCamera();
  }

  /**
   * Halaman berikutnya galeri (PER-4). Dedup by id: feed hidup + foto lokal yang
   * baru diunggah bisa tumpang-tindih dengan halaman berikutnya.
   */
  async function loadMore() {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    setGalleryError(null);
    try {
      const res = await loadMomenPhotosAction(slug, cursor);
      if (res.status !== "ok") {
        // Kursor & tombol dipertahankan (#46); tamu diberi tahu, tak dibiarkan
        // mengira album memang habis sampai di situ.
        setGalleryError(c.error.temporary);
        return;
      }
      setPhotos((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.photos.filter((p) => !seen.has(p.id))];
      });
      setCursor(res.nextCursor);
    } catch {
      setGalleryError(c.error.temporary);
    } finally {
      setLoadingMore(false);
    }
  }

  function closeCamera() {
    if (phase === "revealed") setScreen("galeri");
    else if (taken > 0) setScreen("habis");
    else setScreen("masuk");
  }

  /**
   * Jepretan tertunda harus terjangkau dari layar mana pun: menutup kamera
   * (✕) memindahkan tamu ke "habis"/"masuk", dan dulu tombol kirim ulang hanya
   * hidup di layar kamera — fotonya ikut terkubur di sana (koreksi review #46).
   */
  /**
   * Pesan galat untuk layar TERANG (masuk/habis/galeri). Panel merah & toast
   * hanya hidup di layar kamera, jadi tanpa baris ini penolakan PERMANEN atas
   * kirim ulang — jatah habis, album diarsipkan host, sesi kedaluwarsa —
   * membuat baris jepretan lenyap tanpa satu pun penjelasan, persis seperti
   * kiriman yang berhasil, padahal blob-nya baru saja dilepas (review #46).
   */
  const errorLine =
    error && error !== pending?.message ? (
      <div className="mn-err" role="alert">
        {error}
      </div>
    ) : null;

  const pendingRow = pending ? (
    <div className="mn-pending" role="status">
      {/* Pesan kegagalan TERAKHIR jepretan ini. Panel galat & toast hanya hidup
          di layar kamera, jadi kirim ulang yang gagal dari layar masuk/habis/
          galeri dulu tak memberi tanda apa pun. `pending.message` diperbarui
          setiap percobaan, termasuk saat pengirimannya melempar. */}
      <span>{pending.message}</span>
      <span className="mn-pending__note">{c.camera.pendingShot}</span>
      <button
        type="button"
        className="mn-ghost"
        onClick={() => void retryPending()}
        disabled={busy}
      >
        {busy ? c.camera.uploading : c.camera.retryPhoto}
      </button>
    </div>
  ) : null;

  const previewFilter = preset.css === "none" ? undefined : preset.css;
  const cd = countdownParts(msUntilReveal(now, revealAtIso));
  const cols: MomenPhotoView[][] = [[], []];
  photos.forEach((p, i) => cols[i % 2]!.push(p));

  return (
    <div className="mn-app">
      {/* ===== MASUK =====
          Kelas kondisional WAJIB lewat `cn()`, JANGAN template literal
          `${on ? " mn-on" : ""}`: prettier-plugin-tailwindcss membuang spasi di
          awal string kondisional → class menyatu ("mn-masukmn-on") sehingga
          `.mn-screen.mn-on` tak pernah cocok dan SEMUA layar tetap
          `display:none`. Lihat AUDIT-2026-09-04 KUA-1. */}
      <section
        className={cn("mn-screen mn-masuk", shownScreen === "masuk" && "mn-on")}
      >
        <div className="mn-brand">{c.brand}</div>
        <div className="mn-hero">
          {dateLabel ? <div className="mn-kicker">{dateLabel}</div> : null}
          <h1>{heroTitle}</h1>
          <p>
            {revealAtIso === null
              ? c.masuk.introInstant(c.masuk.quota(quotaPerGuest))
              : c.masuk.introReveal(
                  c.masuk.quota(quotaPerGuest),
                  revealLabel(revealAtIso),
                )}
          </p>
          <div className="mn-pills">
            {c.masuk.pills.map((p) => (
              <span key={p} className="mn-pill">
                ✦ {p}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="mn-card">
            <label htmlFor="mn-name">{c.masuk.nameLabel}</label>
            <input
              id="mn-name"
              className="mn-input"
              type="text"
              maxLength={40}
              autoComplete="off"
              placeholder={c.masuk.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {turnstileSiteKey ? (
              <div className="mn-turnstile">
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onToken={setTsToken}
                  resetKey={tsReset}
                />
              </div>
            ) : null}
            <button
              type="button"
              className="mn-cta"
              disabled={name.trim().length === 0 || starting}
              onClick={() => void beginSession(false)}
            >
              {starting ? c.masuk.starting : c.masuk.start} <span>→</span>
            </button>
            {phase === "revealed" ? (
              <button
                type="button"
                className="mn-ghost"
                style={{ width: "100%", marginTop: 10 }}
                disabled={name.trim().length === 0 || starting}
                onClick={() => void beginSession(true)}
              >
                {c.habis.toGallery}
              </button>
            ) : null}
            {errorLine}
            {pendingRow}
            <div className="mn-note">
              <span className="mn-dot" /> {c.masuk.turnstileNote}
            </div>
          </div>
        </div>
      </section>

      {/* ===== KAMERA ===== */}
      <section
        className={cn(
          "mn-screen mn-kamera",
          shownScreen === "kamera" && "mn-on",
        )}
      >
        <div className="mn-stage">
          <video
            ref={videoRef}
            className="mn-video"
            autoPlay
            playsInline
            muted
            style={previewFilter ? { filter: previewFilter } : undefined}
          />
          <div
            className="mn-overlay"
            style={{ background: preset.overlay || undefined }}
          />
          <div className="mn-flash" ref={flashRef} />
          {camError ? (
            <div className="mn-hint">{c.camera.permissionHint}</div>
          ) : null}
          {toast ? <div className="mn-toast mn-show">{toast}</div> : null}
          {/* Antara jepret → tersimpan ada bake piksel + encode 2 varian + 2
              unggah. Tanpa indikator, tamu mengira aplikasi hang lalu menutup
              halaman (foto batal). */}
          {busy ? (
            <div className="mn-busy" role="status">
              <span className="mn-spin" aria-hidden="true" />
              {c.camera.uploading}
            </div>
          ) : null}
          {/* Saat kirim ulang sedang berjalan, `error` sudah dibersihkan tetapi
              jepretannya masih tertunda: tanpa teks cadangan ini panelnya
              menjadi kotak merah kosong berisi tombol saja. */}
          {(error ?? pending?.message) ? (
            <div className="mn-camerr" role="alert">
              {error ?? pending?.message}
              {pending ? (
                <>
                  {error && error !== pending.message ? (
                    <div className="mn-camerr__note">
                      {c.camera.pendingShot}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="mn-camerr__retry"
                    onClick={() => void retryPending()}
                    disabled={busy}
                  >
                    {c.camera.retryPhoto}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="mn-camtop">
            <div className="mn-camtitle">
              {c.camera.title}
              <b>{name || "—"}</b>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                className="mn-pips"
                aria-label={c.camera.remaining(remaining)}
              >
                {Array.from({ length: quotaPerGuest }).map((_, i) => (
                  <i key={i} className={cn("mn-pip", i < taken && "mn-used")} />
                ))}
              </div>
              <button
                type="button"
                className="mn-iconbtn"
                aria-label={c.camera.close}
                onClick={closeCamera}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="mn-cambottom">
            <div className="mn-filterrow">
              {FILM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cn("mn-fchip", p.id === selectedFilter && "mn-on")}
                  aria-label={`filter ${p.name}`}
                  onClick={() => setSelectedFilter(p.id)}
                >
                  <span
                    className="mn-fswatch"
                    style={p.css === "none" ? undefined : { filter: p.css }}
                  />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
            <div className="mn-camactions">
              {/* `|| camError` DIBUANG: sebelumnya izin kamera yang ditolak
                  diam-diam membuka unggah galeri meski host memilih "hanya
                  jepretan langsung". Jalur cadangan saat kamera gagal tetap ada
                  di shutter `capture="environment"` di bawah. */}
              {allowLibraryUpload ? (
                <label className="mn-round" aria-label={c.camera.fromGallery}>
                  🖼️
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => {
                      void onFile(e.target.files?.[0], "library");
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : (
                <span className="mn-round mn-invisible" />
              )}

              {camError ? (
                <label className="mn-shutter" aria-label={c.camera.shutter}>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => {
                      void onFile(e.target.files?.[0], "camera");
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : (
                <button
                  type="button"
                  className="mn-shutter"
                  aria-label={c.camera.shutter}
                  aria-busy={busy}
                  disabled={busy || remaining <= 0}
                  onClick={() => void shoot()}
                />
              )}

              <button
                type="button"
                className="mn-round"
                aria-label={c.camera.flip}
                onClick={() => void flip()}
              >
                ⟳
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HABIS ===== */}
      <section
        className={cn("mn-screen mn-habis", shownScreen === "habis" && "mn-on")}
      >
        <div className="mn-emoji">🎞️</div>
        <h2>{c.habis.title}</h2>
        {errorLine}
        {pendingRow}
        {phase === "revealed" ? (
          <>
            <p>{c.habis.revealed}</p>
            <button
              type="button"
              className="mn-ghost"
              onClick={() => setScreen("galeri")}
            >
              {c.habis.toGallery}
            </button>
          </>
        ) : (
          <>
            <p>{c.habis.body(taken)}</p>
            <div className="mn-countwrap">
              <Cell v={cd.d * 24 + cd.h} label={c.habis.h} />
              <Cell v={cd.m} label={c.habis.m} />
              <Cell v={cd.s} label={c.habis.s} />
            </div>
          </>
        )}
      </section>

      {/* ===== GALERI ===== */}
      <section
        className={cn(
          "mn-screen mn-galeri",
          shownScreen === "galeri" && "mn-on",
        )}
      >
        <div className="mn-galhead">
          <div className="mn-kicker">{c.gallery.kickerRevealed}</div>
          <h2>{heroTitle}</h2>
          <p>{c.gallery.sub(totalPhotos, props.photographers)}</p>
          {/* Album reveal-instan: ✕ dari kamera mendarat DI SINI, jadi jepretan
              tertunda harus bisa dikirim ulang dari layar ini juga. */}
          {errorLine}
          {pendingRow}
        </div>
        {photos.length === 0 ? (
          <div className="mn-empty">{c.gallery.empty}</div>
        ) : (
          <div className="mn-grid">
            {cols.map((col, ci) => (
              <div key={ci} className="mn-col">
                {col.map((p) => (
                  <figure
                    key={p.id}
                    className="mn-ph"
                    onClick={() => setLightbox(p)}
                  >
                    {/* Foto momen = URL storage dinamis (blob lokal / domain
                        sendiri); next/image tak cocok. Bukan halaman LCP-kritis. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbUrl}
                      alt={c.gallery.by(p.guestName)}
                      loading="lazy"
                    />
                    <figcaption className="mn-who">
                      <b>{p.guestName}</b>
                      <i>{getFilmPreset(p.filterId).name}</i>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ))}
          </div>
        )}
        {cursor ? (
          <div className="mn-more">
            {galleryError ? (
              <div className="mn-err" role="alert">
                {galleryError}
              </div>
            ) : null}
            <button
              type="button"
              className="mn-ghost"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? c.gallery.loading : c.gallery.loadMore}
            </button>
          </div>
        ) : null}
        <div className="mn-bottombar">
          <button
            type="button"
            className="mn-barbtn mn-ghostbtn"
            onClick={() => setScreen(remaining > 0 ? "kamera" : "habis")}
          >
            {c.gallery.cameraAgain}
          </button>
        </div>
      </section>

      {/* ===== LIGHTBOX ===== */}
      <div className={cn("mn-lightbox", lightbox && "mn-on")}>
        {lightbox ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={c.gallery.by(lightbox.guestName)} />
            <div className="mn-lbcap">
              {c.gallery.by(lightbox.guestName)} ·{" "}
              {getFilmPreset(lightbox.filterId).name}
            </div>
            <div className="mn-lbrow">
              <a
                className="mn-lbbtn"
                href={lightbox.url}
                target="_blank"
                rel="noreferrer"
                download
              >
                {c.gallery.downloadPhoto}
              </a>
              <button
                type="button"
                className="mn-lbbtn"
                onClick={() => setLightbox(null)}
              >
                {c.gallery.close}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Cell({ v, label }: { v: number; label: string }) {
  return (
    <div className="mn-cell">
      <b>{String(v).padStart(2, "0")}</b>
      <span>{label}</span>
    </div>
  );
}

/** Label jam reveal (WIB). */
function revealLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(d);
}
