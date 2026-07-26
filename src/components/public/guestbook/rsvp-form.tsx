"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";

import { copy } from "@/lib/copy";
import { submitRsvpAction } from "@/server/actions/guestbook";

import { TurnstileWidget } from "./turnstile-widget";

/**
 * Form RSVP + ucapan (SPEC §4.6). State ringan (tanpa react-hook-form) demi
 * bundle halaman undangan tetap kecil. Honeypot `website` tersembunyi, token
 * Turnstile via widget (bila site key ada). Server yang menegakkan validasi,
 * anti-spam, dan batas pax — di sini hanya UX.
 */
export function RsvpForm({
  slug,
  guestToken,
  onSubmitted,
}: {
  slug: string;
  guestToken?: string;
  onSubmitted?: () => void;
}) {
  const t = copy.guestbook.form;
  const [name, setName] = useState("");
  const [attendance, setAttendance] = useState<"yes" | "no">("yes");
  const [pax, setPax] = useState(1);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const honeypotRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [feedback, setFeedback] = useState("");

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const onToken = useCallback((tk: string) => setToken(tk), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setFeedback("");
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
    } else {
      setStatus("error");
      setFeedback(res.message ?? t.invalid);
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

      {siteKey ? <TurnstileWidget siteKey={siteKey} onToken={onToken} /> : null}

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
    </form>
  );
}
