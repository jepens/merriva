import { describe, expect, it } from "vitest";

import {
  MOMEN_SESSION_TTL_MS,
  signMomenSession,
  verifyMomenSession,
  type MomenSession,
} from "@/lib/momen/session";

const SECRET = "test-secret-abc";
const OTHER = "different-secret";
const NOW = 1_700_000_000_000;

const session: MomenSession = {
  albumId: "album-1",
  deviceId: "device-1",
  guestName: "Sasa",
  iat: NOW,
};

describe("momen session HMAC", () => {
  it("sign → verify round-trip mengembalikan sesi identik", () => {
    const token = signMomenSession(session, SECRET);
    expect(verifyMomenSession(token, NOW, SECRET)).toEqual(session);
  });

  it("tanda tangan dengan rahasia lain ditolak", () => {
    const token = signMomenSession(session, SECRET);
    expect(verifyMomenSession(token, NOW, OTHER)).toBeNull();
  });

  it("payload di-tamper (ganti nama) tanpa tanda tangan ulang → null", () => {
    const token = signMomenSession(session, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...session, guestName: "Peretas" }),
    ).toString("base64url");
    expect(verifyMomenSession(`${forged}.${sig}`, NOW, SECRET)).toBeNull();
  });

  it("kedaluwarsa setelah TTL → null", () => {
    const token = signMomenSession(session, SECRET);
    const justOk = NOW + MOMEN_SESSION_TTL_MS;
    const expired = NOW + MOMEN_SESSION_TTL_MS + 1;
    expect(verifyMomenSession(token, justOk, SECRET)).toEqual(session);
    expect(verifyMomenSession(token, expired, SECRET)).toBeNull();
  });

  it("token cacat/kosong → null (fail-closed)", () => {
    expect(verifyMomenSession(undefined, NOW, SECRET)).toBeNull();
    expect(verifyMomenSession("", NOW, SECRET)).toBeNull();
    expect(verifyMomenSession("nodot", NOW, SECRET)).toBeNull();
    expect(verifyMomenSession(".abc", NOW, SECRET)).toBeNull();
    expect(verifyMomenSession("abc.", NOW, SECRET)).toBeNull();
  });

  it("payload bukan JSON valid → null", () => {
    const bad = Buffer.from("bukan-json").toString("base64url");
    // Tanda tangani payload rusak dengan rahasia yang benar → tetap ditolak
    // karena JSON.parse gagal (bukan hanya cek tanda tangan).
    const token = signMomenSession(session, SECRET).replace(/^[^.]+/, bad);
    expect(verifyMomenSession(token, NOW, SECRET)).toBeNull();
  });
});
