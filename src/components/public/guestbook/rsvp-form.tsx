"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";

import { GuestPrivacyNote } from "@/components/public/guest-privacy-note";
import { copy } from "@/lib/copy";
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
  const [pax, setPax] = useState(1);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
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
            onChange={() => setAttendance("yes")}
          />
          <span>{t.attending}</span>
        </label>
        <label className="gb-radio">
          <input
            type="radio"
            name="attendance"
            checked={attendance === "no"}
            onChange={() => setAttendance("no")}
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
            max={20}
            value={pax}
            onChange={(e) => setPax(Number(e.target.value) || 1)}
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
