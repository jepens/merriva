"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";
import { RSVP_PAX_TANPA_TOKEN } from "@/lib/rsvp-limits";
import {
  matchesFilter,
  matchesSearch,
  sebarCounts,
  sebarStatus,
  type SebarFilter,
  type SebarStatus,
} from "@/lib/sebar-status";
import {
  fillTemplate,
  generalLink,
  personalLink,
  SHARE_TEMPLATE_MAX,
  waShareUrl,
} from "@/lib/share-message";
import {
  markWaClickedAction,
  unmarkWaClickedAction,
} from "@/server/actions/guests";
import { saveShareTemplatesAction } from "@/server/actions/sebar";

export interface SebarGuest {
  id: string;
  name: string;
  phone: string | null;
  token: string;
  groupLabel: string | null;
  sent: boolean;
  opened: boolean;
  rsvp: "yes" | "no" | null;
}

const BADGE: Record<SebarStatus, string> = {
  unsent: "bg-muted text-muted-foreground",
  sent: "bg-sky-100 text-sky-800",
  opened: "bg-emerald-100 text-emerald-800",
  attending: "bg-emerald-600 text-white",
  notAttending: "bg-stone-200 text-stone-700",
};

const FILTERS: SebarFilter[] = ["unsent", "sent", "opened", "rsvp", "all"];

type Seq = {
  queue: string[];
  index: number;
  phase: "ready" | "awaiting" | "done";
  /** Dipulihkan dari sessionStorage sesudah tab dibuang: satu konfirmasi saja. */
  pulih?: boolean;
};

/**
 * Sebar Undangan (SPEC §4.7, DECISIONS #120).
 *
 * - "Kirim via WA" untuk SEMUA tamu: bernomor → chat tamu; tanpa nomor →
 *   `wa.me/?text=` membuka pemilih kontak WhatsApp dengan pesan terisi.
 * - Tanda "terkirim" dipasang saat tombol kirim diketuk (aksinya dipanggil
 *   sebelum WhatsApp dibuka — tab di HP bisa dibuang tanpa event) dan saat
 *   pesan disalin; selalu bisa dibatalkan, kegagalannya diberitahukan. WhatsApp
 *   tak memberi sinyal terkirim lewat tautan resmi, jadi konfirmasi pemilik
 *   satu-satunya yang jujur. Konfirmasi yang tertinggal saat tab dibuang
 *   dipulihkan dari sessionStorage.
 * - Status Dibuka/RSVP diturunkan dari data tamu (objektif).
 * - Mode "Kirim satu per satu" mengantre SEMUA tamu belum dikirim yang cocok
 *   dengan pencarian (filter status diabaikan).
 * - Template personal & umum tersimpan per undangan.
 *
 * Link & pesan dirakit di klien saat dipakai (butuh `window.location.origin`).
 */
export function SebarUndangan({
  invitationId,
  slug,
  acara,
  tanggal,
  templates,
  initial,
}: {
  invitationId: string;
  slug: string;
  acara: string;
  tanggal: string | null;
  templates: { personal: string | null; general: string | null };
  initial: SebarGuest[];
}) {
  const t = copy.dashboard.sebar;

  // --- Template -----------------------------------------------------------
  const awalPersonal = templates.personal ?? t.defaultTemplate;
  const awalUmum = templates.general ?? t.defaultTemplateGeneral;
  const [personal, setPersonal] = useState(awalPersonal);
  const [umum, setUmum] = useState(awalUmum);
  const [tersimpan, setTersimpan] = useState({
    personal: awalPersonal,
    umum: awalUmum,
  });
  const [tab, setTab] = useState<"personal" | "umum">("personal");
  const [simpan, setSimpan] = useState<
    | { s: "idle" }
    | { s: "saving" }
    | { s: "saved" }
    | { s: "error"; message: string }
  >({ s: "idle" });
  const personalKotor = personal !== tersimpan.personal;
  const umumKotor = umum !== tersimpan.umum;
  const kotor = personalKotor || umumKotor;
  // Pesan tanpa {link} tak mengundang apa pun: kunci kirim/salin template itu.
  const personalOk = personal.includes("{link}");
  const umumOk = umum.includes("{link}");
  const tanpaLink = !personalOk || !umumOk;
  // Kirim HANYA dari template yang tersimpan: suntingan yang belum disimpan
  // hilang saat tab dibuang/dimuat ulang, dan pesan berikutnya diam-diam
  // kembali ke teks lama. Dikunci PER template — template umum yang sedang
  // disunting tak ikut mengunci kiriman personal, dan sebaliknya.
  const personalSiap = personalOk && !personalKotor;
  const umumSiap = umumOk && !umumKotor;

  async function simpanTemplate() {
    setSimpan({ s: "saving" });
    const res = await saveShareTemplatesAction(invitationId, {
      personal,
      general: umum,
    }).catch(() => ({ status: "error" as const, message: copy.common.error }));
    if (res.status === "success") {
      setTersimpan({ personal, umum });
      setSimpan({ s: "saved" });
    } else {
      setSimpan({ s: "error", message: res.message });
    }
  }

  // --- Tamu & status ------------------------------------------------------
  const [guests, setGuests] = useState<SebarGuest[]>(initial);
  const counts = useMemo(() => sebarCounts(guests), [guests]);
  const [filter, setFilter] = useState<SebarFilter>(() =>
    sebarCounts(initial).unsent > 0 ? "unsent" : "all",
  );
  const [query, setQuery] = useState("");
  // Tamu yang baru ditandai lewat tombol BARIS tetap menempel di tampilan ini
  // sampai filter/cari berubah. Tanpa ini, di filter "Belum dikirim" barisnya
  // lenyap seketika: "Tersalin" & "Batalkan" tak pernah terlihat, dan ketukan
  // kedua (WhatsApp lambat terbuka) jatuh ke tombol tamu berikutnya yang naik
  // ke bawah jari — menandainya tanpa sengaja.
  const [nempel, setNempel] = useState<ReadonlySet<string>>(() => new Set());
  const gantiFilter = (f: SebarFilter) => {
    setFilter(f);
    setNempel(new Set());
  };
  const gantiQuery = (q: string) => {
    setQuery(q);
    setNempel(new Set());
  };
  const visible = useMemo(
    () =>
      guests.filter(
        (g) =>
          (matchesFilter(g, filter) || nempel.has(g.id)) &&
          matchesSearch(g, query),
      ),
    [guests, filter, query, nempel],
  );
  const [disalin, setDisalin] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  // Per tamu: percobaan ulang yang berhasil menghapus peringatan tamu itu saja.
  const [peringatan, setPeringatan] = useState<{
    id: string;
    teks: string;
  } | null>(null);
  const hapusPeringatan = (id: string) =>
    setPeringatan((p) => (p?.id === id ? null : p));
  // "Salin pesan di daftar ini" memakai filter MURNI — baris yang menempel
  // (sudah ditandai) tak ikut, dan tombolnya mati bila daftar murninya kosong.
  const daftarSalin = useMemo(
    () =>
      guests.filter((g) => matchesFilter(g, filter) && matchesSearch(g, query)),
    [guests, filter, query],
  );

  const tgl = tanggal ?? t.dateFallback;
  const origin = () => window.location.origin;

  function messageFor(g: SebarGuest): string {
    return fillTemplate(personal, {
      nama: g.name,
      link: personalLink(origin(), slug, g.token),
      acara,
      tanggal: tgl,
    });
  }

  function setSent(id: string, sent: boolean) {
    setGuests((prev) => prev.map((x) => (x.id === id ? { ...x, sent } : x)));
  }

  /**
   * Optimistis. Dua jenis kegagalan dibedakan:
   * - server MENOLAK (`status: "error"`) → dibalik + diberi tahu: tanda pasti
   *   tak tersimpan;
   * - TRANSPORT putus (aksi melempar, mis. Safari dilatarbelakangkan saat
   *   respons masih di jalan) → tanda lokal DIPERTAHANKAN tetapi diberi tahu:
   *   UPDATE-nya bisa saja sudah commit, dan membaliknya diam-diam membuat
   *   pemilik mengirim undangan dua kali.
   */
  function tandai(g: SebarGuest) {
    if (g.sent) return;
    setSent(g.id, true);
    void markWaClickedAction(invitationId, g.id)
      .then((r) => {
        if (r.status === "success") return hapusPeringatan(g.id);
        setSent(g.id, false);
        setPeringatan({ id: g.id, teks: t.markFailed(g.name) });
      })
      .catch(() => setPeringatan({ id: g.id, teks: t.markUncertain(g.name) }));
  }

  function batalkan(g: SebarGuest) {
    setSent(g.id, false);
    void unmarkWaClickedAction(invitationId, g.id)
      .then((r) => {
        if (r.status === "success") return hapusPeringatan(g.id);
        setSent(g.id, true);
        setPeringatan({ id: g.id, teks: t.unmarkFailed(g.name) });
      })
      .catch(() =>
        setPeringatan({ id: g.id, teks: t.unmarkUncertain(g.name) }),
      );
  }

  function kirim(g: SebarGuest) {
    // Tandai dulu, lalu buka WhatsApp — masih di dalam gestur klik, jadi tak
    // diblokir popup blocker. (Server Action Next diantre serial: bila aksi
    // lain masih berjalan, tanda berangkat sesudahnya.)
    tandai(g);
    window.open(waShareUrl(g.phone, messageFor(g)), "_blank", "noopener");
  }

  /** Aksi dari tombol BARIS: tamunya menempel di tampilan (lihat `nempel`). */
  function tempel(g: SebarGuest) {
    setNempel((s) => new Set(s).add(g.id));
  }

  async function salin(key: string, teks: string, g?: SebarGuest) {
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      return; // clipboard tak tersedia — jangan menandai apa pun
    }
    if (g) {
      tempel(g);
      tandai(g);
    }
    setDisalin(key);
    setTimeout(() => setDisalin((c) => (c === key ? null : c)), 1500);
  }

  async function copyAll() {
    const all = daftarSalin.map(messageFor).join("\n\n———\n\n");
    try {
      await navigator.clipboard.writeText(all);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      // abaikan
    }
  }

  // --- Undangan umum --------------------------------------------------------
  const [namaUmum, setNamaUmum] = useState("");
  function pesanUmum(): string {
    return fillTemplate(umum, {
      nama: namaUmum.trim() || t.generalNameFallback,
      link: generalLink(origin(), slug, namaUmum),
      acara,
      tanggal: tgl,
    });
  }

  // --- Mode kirim satu per satu ---------------------------------------------
  const [seq, setSeq] = useState<Seq | null>(null);
  const [lihatPesan, setLihatPesan] = useState(false);
  const pemicuRef = useRef<HTMLElement | null>(null);
  const current =
    seq && seq.phase !== "done"
      ? (guests.find((g) => g.id === seq.queue[seq.index]) ?? null)
      : null;
  // Antrean: tamu belum dikirim yang cocok dengan PENCARIAN (filter status
  // diabaikan — filter "Terkirim"/"Dibuka" tak pernah memuat yang belum).
  const antrean = useMemo(
    () =>
      guests
        .filter((g) => matchesFilter(g, "unsent") && matchesSearch(g, query))
        .map((g) => g.id),
    [guests, query],
  );

  /**
   * Tamu yang SEDANG menunggu konfirmasi diingat di sessionStorage: bila
   * Android membuang tab saat pemilik di WhatsApp (mis. kontaknya tak
   * ditemukan), pertanyaan "Sudah terkirim?" muncul lagi sesudah muat ulang —
   * tanpa itu tamu tetap bertanda "Terkirim" dan hilang dari antrean selamanya.
   */
  const kunciMenunggu = `sebar-menunggu:${invitationId}`;
  function ingatMenunggu(id: string | null) {
    try {
      if (id) sessionStorage.setItem(kunciMenunggu, id);
      else sessionStorage.removeItem(kunciMenunggu);
    } catch {
      // penyimpanan tak tersedia (mode privat) — fitur pemulihan saja yang hilang
    }
  }

  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(kunciMenunggu);
    } catch {
      return;
    }
    if (!id) return;
    const tamuMenunggu = initial.find((g) => g.id === id && g.sent);
    if (!tamuMenunggu) {
      ingatMenunggu(null);
      return;
    }
    // setState di callback timer, bukan sinkron di badan efek (pola repo).
    const timer = setTimeout(
      () =>
        setSeq({
          queue: [tamuMenunggu.id],
          index: 0,
          phase: "awaiting",
          pulih: true,
        }),
      0,
    );
    return () => clearTimeout(timer);
    // Hanya saat mount: memulihkan satu konfirmasi yang tertinggal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mulaiSeq() {
    pemicuRef.current = document.activeElement as HTMLElement | null;
    setNempel(new Set());
    setLihatPesan(false);
    setSeq({
      queue: antrean,
      index: 0,
      phase: antrean.length ? "ready" : "done",
    });
  }

  function tutupSeq() {
    ingatMenunggu(null);
    setSeq(null);
    // Kembalikan fokus ke pemicu; bila ia kini mati (antrean habis) atau tak
    // ada (dialog pulihan), ke judul daftar — bukan hilang ke <body>.
    const pemicu = pemicuRef.current as HTMLButtonElement | null;
    const tujuan =
      pemicu && !pemicu.disabled
        ? pemicu
        : document.getElementById("judul-tamu");
    setTimeout(() => tujuan?.focus(), 0);
  }

  function maju() {
    ingatMenunggu(null);
    setLihatPesan(false);
    if (seq?.pulih) {
      tutupSeq();
      return;
    }
    setSeq((s) => {
      if (!s) return s;
      const next = s.index + 1;
      return next >= s.queue.length
        ? { ...s, index: next, phase: "done" }
        : { ...s, index: next, phase: "ready" };
    });
  }

  useEffect(() => {
    if (!seq) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutupSeq();
    };
    window.addEventListener("keydown", onKey);
    // Latar tak ikut tergulir selama dialog terbuka.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq !== null]);

  const persen = counts.total
    ? Math.round((counts.sent / counts.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Template --------------------------------------------------------- */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap gap-2" role="group">
            {(["personal", "umum"] as const).map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={tab === k ? "default" : "outline"}
                aria-pressed={tab === k}
                onClick={() => setTab(k)}
              >
                {k === "personal" ? t.templateLabel : t.templateGeneralLabel}
              </Button>
            ))}
          </div>
          <label htmlFor="tpl" className="sr-only">
            {tab === "personal" ? t.templateLabel : t.templateGeneralLabel}
          </label>
          <Textarea
            id="tpl"
            value={tab === "personal" ? personal : umum}
            onChange={(e) =>
              tab === "personal"
                ? setPersonal(e.target.value)
                : setUmum(e.target.value)
            }
            maxLength={SHARE_TEMPLATE_MAX}
            rows={9}
          />
          <p className="text-muted-foreground text-xs">
            {tab === "personal" ? t.templateHint : t.templateGeneralHint}
          </p>
          {/* Per template, apa pun tab aktifnya — sebut MANA yang salah. */}
          {!personalOk ? (
            <p className="text-destructive text-xs" role="alert">
              {t.templateNeedsLinkPersonal}
            </p>
          ) : null}
          {!umumOk ? (
            <p className="text-destructive text-xs" role="alert">
              {t.templateNeedsLinkGeneral}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={simpanTemplate}
              disabled={!kotor || tanpaLink || simpan.s === "saving"}
            >
              {simpan.s === "saving" ? t.savingTemplate : t.saveTemplate}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                tab === "personal"
                  ? setPersonal(t.defaultTemplate)
                  : setUmum(t.defaultTemplateGeneral)
              }
            >
              {t.resetTemplate}
            </Button>
            <span className="text-muted-foreground text-xs" aria-live="polite">
              {kotor
                ? t.unsavedTemplate
                : simpan.s === "saved"
                  ? t.savedTemplate
                  : ""}
            </span>
            {simpan.s === "error" ? (
              <span className="text-destructive text-xs" role="alert">
                {simpan.message}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Undangan umum ------------------------------------------------------ */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="space-y-1">
            <h2 className="text-base font-medium">{t.generalTitle}</h2>
            <p className="text-muted-foreground text-sm">{t.generalDesc}</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="nama-umum" className="text-sm font-medium">
              {t.generalNameLabel}
            </label>
            <Input
              id="nama-umum"
              value={namaUmum}
              onChange={(e) => setNamaUmum(e.target.value)}
              placeholder={t.generalNamePlaceholder}
              maxLength={60}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!umumSiap}
              onClick={() =>
                window.open(waShareUrl(null, pesanUmum()), "_blank", "noopener")
              }
            >
              {t.sendGeneral}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!umumSiap}
              onClick={() => salin("umum", pesanUmum())}
            >
              {disalin === "umum" ? t.copied : t.copyGeneral}
            </Button>
          </div>
          {umumKotor ? (
            <p className="text-muted-foreground text-xs">{t.saveFirst}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {t.generalRsvpNote(RSVP_PAX_TANPA_TOKEN)}
          </p>
        </CardContent>
      </Card>

      {/* Daftar tamu -------------------------------------------------------- */}
      <section className="space-y-4" aria-labelledby="judul-tamu">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="judul-tamu"
              tabIndex={-1}
              className="text-base font-medium outline-none"
            >
              {t.guestListTitle}
            </h2>
            <Button
              type="button"
              size="sm"
              onClick={mulaiSeq}
              disabled={antrean.length === 0 || !personalSiap}
            >
              {t.seq.start}
            </Button>
          </div>
          {personalKotor ? (
            <p className="text-muted-foreground text-xs">{t.saveFirst}</p>
          ) : null}
          <p className="text-sm tabular-nums" aria-live="polite">
            {t.progress(counts.sent, counts.total, counts.opened, counts.rsvp)}
          </p>
          {peringatan && !seq ? (
            <p className="text-destructive text-xs" role="status">
              {peringatan.teks}
            </p>
          ) : null}
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={persen}
            aria-label={t.filter.sent}
          >
            <div
              className="h-full bg-sky-600 transition-[width]"
              style={{ width: `${persen}%` }}
            />
          </div>
        </div>

        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
          <li>{t.previewTip}</li>
          <li>{t.etiquetteTip}</li>
          <li>{t.desktopTip}</li>
          <li>{t.testWarning}</li>
        </ul>

        <div className="flex flex-wrap gap-2" role="group">
          {FILTERS.map((f) => {
            const n =
              f === "all"
                ? counts.total
                : f === "unsent"
                  ? counts.unsent
                  : counts[f];
            return (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={filter === f ? "default" : "outline"}
                aria-pressed={filter === f}
                onClick={() => gantiFilter(f)}
              >
                {t.filter[f]} <span className="tabular-nums">({n})</span>
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="cari-tamu" className="sr-only">
            {t.searchPlaceholder}
          </label>
          <Input
            id="cari-tamu"
            type="search"
            value={query}
            onChange={(e) => gantiQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="max-w-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={copyAll}
            disabled={daftarSalin.length === 0 || !personalSiap}
          >
            {copiedAll ? t.copiedAll : t.copyAll}
          </Button>
        </div>

        {guests.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.empty}</p>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.noMatch}</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((g) => {
              const st = sebarStatus(g);
              return (
                <li key={g.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{g.name}</span>
                          {g.groupLabel ? (
                            <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                              {g.groupLabel}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${BADGE[st]}`}
                          >
                            {t.status[st]}
                          </span>
                          {st === "sent" ? (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground -my-1 px-2 py-1 text-xs underline underline-offset-2"
                              onClick={() => batalkan(g)}
                              aria-label={t.undoLabel(g.name)}
                            >
                              {t.undo}
                            </button>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {g.phone ?? t.noPhone}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={!personalSiap}
                          onClick={() => {
                            tempel(g);
                            kirim(g);
                          }}
                        >
                          {t.waSend}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!personalSiap}
                          onClick={() => salin(g.id, messageFor(g), g)}
                        >
                          {disalin === g.id ? t.copied : t.copyMsg}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Mode kirim satu per satu ----------------------------------------- */}
      {seq ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="seq-judul"
        >
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 py-5">
              <div className="flex items-center justify-between gap-3">
                <h2 id="seq-judul" className="text-base font-medium">
                  {t.seq.title}
                </h2>
                {seq.phase !== "done" ? (
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {t.seq.counter(seq.index + 1, seq.queue.length)}
                  </span>
                ) : null}
              </div>

              {seq.phase === "done" || !current ? (
                <p className="text-sm">
                  {seq.queue.length ? t.seq.done : t.seq.empty}
                </p>
              ) : (
                <>
                  <div id="seq-tamu" className="space-y-1">
                    <p className="text-xl font-semibold wrap-break-word">
                      {current.name}
                    </p>
                    {current.groupLabel ? (
                      <p className="text-muted-foreground text-sm">
                        {current.groupLabel}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-sm">
                      {current.phone ?? t.seq.noPhoneHint}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-muted-foreground text-xs underline underline-offset-2"
                    onClick={() => setLihatPesan((v) => !v)}
                    aria-expanded={lihatPesan}
                  >
                    {t.seq.showMessage}
                  </button>
                  {lihatPesan ? (
                    <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                      {messageFor(current)}
                    </pre>
                  ) : null}

                  {seq.phase === "ready" ? (
                    // autoFocus: tombol ini dipasang ulang tiap kembali ke fase
                    // "ready" — fokus mengikuti langkah berikutnya, satu ketuk.
                    <Button
                      autoFocus
                      type="button"
                      className="w-full"
                      // Pembaca layar mengumumkan nama/grup tamu, bukan cuma label.
                      aria-describedby="seq-tamu"
                      disabled={!personalSiap}
                      onClick={() => {
                        ingatMenunggu(current.id);
                        kirim(current);
                        setSeq((s) => (s ? { ...s, phase: "awaiting" } : s));
                      }}
                    >
                      {t.seq.send}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-xs">
                        {t.seq.waitHint}
                      </p>
                      <p className="font-medium" aria-live="polite">
                        {t.seq.confirm(current.name)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {/* autoFocus: kembali dari WhatsApp → satu ketuk "Ya". */}
                        <Button autoFocus type="button" onClick={maju}>
                          {t.seq.yes}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            ingatMenunggu(null);
                            batalkan(current);
                            setSeq((s) => (s ? { ...s, phase: "ready" } : s));
                          }}
                        >
                          {t.seq.no}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Kegagalan tanda HARUS terlihat di sini: dialog menutupi daftar,
                  dan dialog adalah jalur utama menandai. */}
              {peringatan ? (
                <p className="text-destructive text-xs" role="status">
                  {peringatan.teks}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-between gap-2">
                {seq.phase !== "done" && current ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (seq.phase === "awaiting") batalkan(current);
                      maju();
                    }}
                  >
                    {t.seq.skip}
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  // `key` berganti → tombol dipasang ulang saat antrean
                  // selesai, sehingga autoFocus benar-benar berlaku (React
                  // hanya menerapkannya saat mount) — fokus tak jatuh ke body.
                  key={seq.phase === "done" || !current ? "akhir" : "tengah"}
                  autoFocus={seq.phase === "done" || !current}
                  type="button"
                  variant="outline"
                  onClick={tutupSeq}
                >
                  {t.seq.exit}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
