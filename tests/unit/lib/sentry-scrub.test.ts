import { describe, expect, it } from "vitest";

import { redactGuestToken, scrubSentryEvent } from "@/lib/sentry-scrub";

/**
 * `guests.token` tak boleh sampai ke Sentry (SPEC §11). Menjauhkannya dari
 * `extra` saja tidak cukup: Server Action tamu di-POST ke URL halaman yang
 * memuat `?g={token}`, dan Sentry melampirkan data request ke setiap event.
 * Berkas ini mengunci penyaringnya (DECISIONS #46 — koreksi temuan review).
 */

const TOKEN = "V1StGXR8Z5jdHi6BmyT";

describe("redactGuestToken", () => {
  it("menyensor ?g= di URL penuh, membiarkan sisanya terbaca", () => {
    expect(
      redactGuestToken(`https://merriva.id/andi-sinta?g=${TOKEN}&utm=wa`),
    ).toBe("https://merriva.id/andi-sinta?g=[redacted]&utm=wa");
  });

  it("menyensor query string telanjang, termasuk parameter pertama", () => {
    expect(redactGuestToken(`g=${TOKEN}`)).toBe("g=[redacted]");
    expect(redactGuestToken(`utm=wa&g=${TOKEN}`)).toBe("utm=wa&g=[redacted]");
  });

  it("menyensor varian penamaan token tamu", () => {
    expect(redactGuestToken(`?token=${TOKEN}`)).toBe("?token=[redacted]");
    expect(redactGuestToken(`?guest_token=${TOKEN}`)).toBe(
      "?guest_token=[redacted]",
    );
    expect(redactGuestToken(`?guestToken=${TOKEN}`)).toBe(
      "?guestToken=[redacted]",
    );
  });

  it("tak menyentuh parameter lain — `g` harus parameter utuh, bukan akhiran", () => {
    const url = "https://merriva.id/a?slug=budi&lang=id&tag=g";
    expect(redactGuestToken(url)).toBe(url);
    // `?e=` (kalender) & `?to=` (sapaan manual) bukan identitas tamu.
    expect(redactGuestToken("?to=Sasa&e=abc")).toBe("?to=Sasa&e=abc");
  });
});

describe("scrubSentryEvent", () => {
  it("membersihkan URL, query string, dan MEMBUANG badan request", () => {
    const event = scrubSentryEvent({
      request: {
        url: `https://merriva.id/andi-sinta?g=${TOKEN}`,
        query_string: `g=${TOKEN}`,
        // Payload Server Action RSVP membawa guestToken di dalamnya.
        data: { guestToken: TOKEN, pax: 6 },
      },
    });

    expect(event.request!.url).toBe(
      "https://merriva.id/andi-sinta?g=[redacted]",
    );
    expect(event.request!.query_string).toBe("g=[redacted]");
    expect(event.request!.data).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain(TOKEN);
  });

  it("query string berbentuk objek maupun pasangan ikut disensor", () => {
    const asObject = scrubSentryEvent({
      request: { query_string: { g: TOKEN, utm: "wa" } },
    });
    expect(asObject.request!.query_string).toEqual({
      g: "[redacted]",
      utm: "wa",
    });

    const asPairs = scrubSentryEvent({
      request: {
        query_string: [
          ["g", TOKEN],
          ["utm", "wa"],
        ] as [string, string][],
      },
    });
    expect(asPairs.request!.query_string).toEqual([
      ["g", "[redacted]"],
      ["utm", "wa"],
    ]);
  });

  it("atribut span, breadcrumb, dan pesan exception ikut dibersihkan", () => {
    const event = scrubSentryEvent({
      contexts: {
        trace: { data: { "url.full": `https://merriva.id/a?g=${TOKEN}` } },
      },
      spans: [
        { data: { "http.target": `/a?g=${TOKEN}`, "http.method": "POST" } },
      ],
      breadcrumbs: [{ data: { url: `/a?g=${TOKEN}` } }],
      exception: { values: [{ value: `fetch failed: /a?g=${TOKEN}` }] },
    });

    expect(JSON.stringify(event)).not.toContain(TOKEN);
    expect(event.spans![0].data!["http.method"]).toBe("POST");
  });

  it("event tanpa data request tetap aman (tak melempar)", () => {
    expect(() => scrubSentryEvent({})).not.toThrow();
  });
});
