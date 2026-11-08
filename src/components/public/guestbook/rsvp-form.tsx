"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";

import { GuestPrivacyNote } from "@/components/public/guest-privacy-note";
import { copy } from "@/lib/copy";
import { RSVP_PAX_TANPA_TOKEN } from "@/lib/rsvp-limits";
import { submitRsvpAction } from "@/server/actions/guestbook";

import { TurnstileWidget } from "./turnstile-widget";

/**
 * Form RSVP + ucapan (SPEC §4.6). State ringan (tanpa react-hook-form) demi
 * bundle halaman undangan tetap kecil. Honeypot `website` tersembunyi, token
 * Turnstile via widget (bila site key ada). Server yang menegakkan validasi,
 * anti-spam, dan batas pax — di sini hanya UX.
 */
/**
 * Token Turnstile hanya HANGUS bila server sempat memverifikasinya. Urutan
 * aksi tamu: Zod → honeypot → rate limit → Turnstile → DB. Jadi penolakan
 * `invalid` dan `rate` terjadi SEBELUM verifikasi dan tokennya masih sah —
 * me-reset di situ membuang tantangan yang baik, dan kiriman perbaikan
 * berikutnya justru ditolak "Verifikasi anti-bot gagal" karena token barunya
 * belum tiba (DECISIONS #46 — koreksi review).
 */
function tokenTerpakai(reason?: string): boolean {
  return reason !== "invalid" && reason !== "rate";
}

export function RsvpForm({
  slug,
  guestToken,
  prefillName,
  onSubmitted,
}: {
  slug: string;
  guestToken?: string;
  prefillName?: string;
  onSubmitted?: () => void;
}) {
  const t = copy.guestbook.form;
  // Nilai awal dari personalisasi (`?g=`/`?to=`); komponen di-remount lewat `key`
  // saat nama tiba (lihat GuestbookSection) → tak perlu efek sinkronisasi.
  const [name, setName] = useState(prefillName ?? "");
  const [attendance, setAttendance] = useState<"yes" | "no">("yes");
  // TEKS saat diketik, angka saat dikirim. Dulu `Number(v) || 1` di onChange
  // membuat kolom tak bisa dikosongkan: menghapus "1" mengembalikannya ke "1",
  // jadi tamu yang mengetik 4 mendapat "14" (DECISIONS #120).
  const [paxText, setPaxText] = useState("1");
  const pax = Math.max(1, Math.trunc(Number(paxText)) || 1);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const honeypotRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [feedback, setFeedback] = useState("");
  const [tsReset, setTsReset] = useState(0);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const onToken = useCallback((tk: string) => setToken(tk), []);

  /**
   * Kiriman ditolak → minta tantangan Turnstile baru (DECISIONS #46). Token
   * lama sudah dipakai server sebelum bacaan DB gagal; tanpa reset, "silakan
   * coba lagi" selalu berakhir "verifikasi gagal" dan RSVP tamu hilang.
   * Penolakan yang terjadi SEBELUM verifikasi tak menghanguskan token apa pun,
   * jadi tantangannya dibiarkan (lihat `tokenTerpakai`).
   */
  const failSubmit = useCallback((msg: string, reason?: string) => {
    setStatus("error");
    setFeedback(msg);
    if (!tokenTerpakai(reason)) return;
    setToken("");
    setTsReset((n) => n + 1);
  }, []);

  /** Ganti kehadiran → pesan galat jumlah tamu yang tertinggal ikut hilang. */
  function pilihKehadiran(v: "yes" | "no") {
    setAttendance(v);
    if (status === "error") {
      setStatus("idle");
      setFeedback("");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    // Link umum: form ber-`noValidate` dan atribut `max` tak mencegah angka
    // yang DIKETIK, sementara server memotong diam-diam ke batasnya. Tolak di
    // sini dengan pesan jelas — tanpa memanggil server, token Turnstile utuh.
    // Angka yang TAMPIL harus sama dengan yang terkirim: "2.5"/"abc"/"0"
    // dulu diam-diam menjadi 2/1/1.
    if (attendance === "yes" && !/^[1-9]\d*$/.test(paxText.trim())) {
      setStatus("error");
      setFeedback(t.paxInvalid);
      return;
    }
    if (attendance === "yes" && !guestToken && pax > RSVP_PAX_TANPA_TOKEN) {
      setStatus("error");
      setFeedback(t.paxMax(RSVP_PAX_TANPA_TOKEN));
      return;
    }
    setStatus("sending");
    setFeedback("");
    try {
      const res = await submitRsvpAction({
        slug,
        guestName: name,
        attendance,
        pax,
        message,
        guestToken,
        turnstileToken: token,
        website: honeypotRef.current?.value ?? "",
      });
      if (res.status === "success") {
        setStatus("done");
        setFeedback(res.moderated ? t.successModerated : t.success);
        onSubmitted?.();
        return;
      }
      failSubmit(res.message ?? t.invalid, res.reason);
    } catch {
      // Aksi MELEMPAR (jaringan venue putus, id aksi basi sesudah deploy):
      // tanpa ini `status` tersangkut "sending" selamanya — tombol mati, tanpa
      // pesan, dan tamu tak bisa mengirim ulang.
      failSubmit(copy.common.error);
    }
  }

  if (status === "done") {
    return (
      <p className="gb-done" role="status">
        {feedback}
      </p>
    );
  }

  return (
    <form className="gb-form" onSubmit={handleSubmit} noValidate>
      {/* Honeypot: tersembunyi dari manusia; bot mengisinya → ditolak diam-diam. */}
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="gb-hp"
        defaultValue=""
      />

      <label className="gb-field">
        <span>{t.name}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          placeholder={t.namePlaceholder}
        />
      </label>

      <fieldset className="gb-attend">
        <legend>{t.attendanceLabel}</legend>
        <label className="gb-radio">
          <input
            type="radio"
            name="attendance"
            checked={attendance === "yes"}
            onChange={() => pilihKehadiran("yes")}
          />
          <span>{t.attending}</span>
        </label>
        <label className="gb-radio">
          <input
            type="radio"
            name="attendance"
            checked={attendance === "no"}
            onChange={() => pilihKehadiran("no")}
          />
          <span>{t.notAttending}</span>
        </label>
      </fieldset>

      {attendance === "yes" ? (
        <label className="gb-field gb-field--pax">
          <span>{t.pax}</span>
          <input
            type="number"
            min={1}
            // Link umum (tanpa token): batas yang sama dengan server untuk
            // panah/spinner; angka yang diketik di atasnya ditolak saat kirim
            // (handleSubmit) — DECISIONS #120. Bertoken: server memakai alokasi
            // tamu yang tak diketahui form.
            max={guestToken ? 20 : RSVP_PAX_TANPA_TOKEN}
            value={paxText}
            onChange={(e) => setPaxText(e.target.value)}
          />
        </label>
      ) : null}

      <label className="gb-field">
        <span>{t.message}</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={t.messagePlaceholder}
        />
      </label>

      {siteKey ? (
        <TurnstileWidget
          siteKey={siteKey}
          onToken={onToken}
          resetKey={tsReset}
        />
      ) : null}

      {status === "error" ? (
        <p className="gb-error" role="alert">
          {feedback}
        </p>
      ) : null}

      <button
        type="submit"
        className="gb-submit"
        disabled={status === "sending"}
      >
        {status === "sending" ? t.submitting : t.submit}
      </button>

      <GuestPrivacyNote className="gb-privacy" />
    </form>
  );
}
