"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";

import { copy } from "@/lib/copy";
import { submitGiftNoteAction } from "@/server/actions/guestbook";

import { TurnstileWidget } from "./turnstile-widget";
import "./guestbook.css";

/**
 * Konfirmasi amplop/kado (SPEC §4.6) — dirender di dalam section amplop tema.
 * Terlipat (tombol pemicu) agar tak mengganggu tampilan; saat dibuka menampilkan
 * form ringan. Data terkirim via `submitGiftNoteAction` (privat, service-role +
 * anti-spam). State ringan tanpa react-hook-form demi bundle halaman tetap kecil.
 */
export function GiftConfirm({
  slug,
  guestToken,
}: {
  slug: string;
  guestToken?: string;
}) {
  const t = copy.guestbook.gift;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"transfer" | "gift">("transfer");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
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
    const res = await submitGiftNoteAction({
      slug,
      guestName: name,
      type,
      amount,
      note,
      guestToken,
      turnstileToken: token,
      website: honeypotRef.current?.value ?? "",
    });
    if (res.status === "success") {
      setStatus("done");
      setFeedback(t.success);
    } else {
      setStatus("error");
      setFeedback(res.message ?? t.invalid);
    }
  }

  if (status === "done") {
    return (
      <p className="gb-done gb-gift-done" role="status">
        {feedback}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="gb-gift-trigger"
        onClick={() => setOpen(true)}
      >
        {t.trigger}
      </button>
    );
  }

  return (
    <form className="gb-form gb-gift-form" onSubmit={handleSubmit} noValidate>
      <p className="gb-gift-intro">{t.intro}</p>

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
        <legend>{t.typeLabel}</legend>
        <label className="gb-radio">
          <input
            type="radio"
            name="gift-type"
            checked={type === "transfer"}
            onChange={() => setType("transfer")}
          />
          <span>{t.typeTransfer}</span>
        </label>
        <label className="gb-radio">
          <input
            type="radio"
            name="gift-type"
            checked={type === "gift"}
            onChange={() => setType("gift")}
          />
          <span>{t.typeGift}</span>
        </label>
      </fieldset>

      {type === "transfer" ? (
        <label className="gb-field">
          <span>{t.amount}</span>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            maxLength={15}
            placeholder={t.amountPlaceholder}
          />
        </label>
      ) : null}

      <label className="gb-field">
        <span>{t.note}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder={t.notePlaceholder}
        />
      </label>

      {siteKey ? <TurnstileWidget siteKey={siteKey} onToken={onToken} /> : null}

      {status === "error" ? (
        <p className="gb-error" role="alert">
          {feedback}
        </p>
      ) : null}

      <div className="gb-gift-actions">
        <button
          type="submit"
          className="gb-submit"
          disabled={status === "sending"}
        >
          {status === "sending" ? t.submitting : t.submit}
        </button>
        <button
          type="button"
          className="gb-gift-cancel"
          onClick={() => setOpen(false)}
          disabled={status === "sending"}
        >
          {t.close}
        </button>
      </div>
    </form>
  );
}
