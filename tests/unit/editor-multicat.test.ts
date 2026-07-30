import { describe, expect, it } from "vitest";

import { parseContentForRender } from "@/lib/invitation-content";
import {
  corporateDraftSchema,
  DEFAULT_SETTINGS,
  invitationContentSchema,
} from "@/lib/validation/content";
import { saveDraftSchema } from "@/lib/validation/invitation";

/**
 * Regresi editor multi-kategori (corporate/family).
 *
 * Bug: react-hook-form menulis "" untuk input opsional yang di-mount kosong,
 * dan `z.email().optional()` menolak "" → autosave corporate GAGAL begitu step
 * "Detail acara" dibuka. Juga: preview draft corporate/family sempat kosong
 * karena `parseContentForRender` hanya memetakan kategori wedding.
 */

describe("autosave corporate: email PIC tidak memblokir draft", () => {
  it("corporateDraftSchema menerima email PIC kosong & parsial (draft tak validasi format)", () => {
    // "" = input kosong RHF (blocker awal); "budi@" = mid-typing.
    for (const email of ["", "budi@"]) {
      const r = corporateDraftSchema.safeParse({
        category: "corporate",
        eventName: "Annual Summit 2026",
        pic: { name: "Budi", phone: "", email },
        agenda: [],
      });
      expect(r.success).toBe(true);
    }
  });

  it("saveDraftSchema (payload autosave penuh) menerima PIC serba-kosong", () => {
    const r = saveDraftSchema.safeParse({
      content: {
        category: "corporate",
        eventName: "",
        pic: { name: "", phone: "", email: "" },
        agenda: [],
      },
      settings: DEFAULT_SETTINGS,
      events: [],
    });
    expect(r.success).toBe(true);
  });
});

describe("aktivasi: field opsional berformat kosong diterima", () => {
  it("invitationContentSchema menerima email/URL '' sebagai tidak diisi", () => {
    const r = invitationContentSchema.safeParse({
      category: "corporate",
      eventName: "Annual Summit 2026",
      pic: { name: "Budi", phone: "", email: "" },
      agenda: [],
      youtubeUrl: "",
      livestreamUrl: "",
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.category === "corporate") {
      expect(r.data.pic?.email).toBeUndefined();
      expect(r.data.youtubeUrl).toBeUndefined();
      expect(r.data.livestreamUrl).toBeUndefined();
    }
  });

  it("email PIC tidak valid tetap ditolak", () => {
    const r = invitationContentSchema.safeParse({
      category: "corporate",
      eventName: "X",
      pic: { name: "Budi", email: "bukan-email" },
      agenda: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("parseContentForRender: draft corporate/family tidak lagi kosong", () => {
  it("memetakan draft corporate walau strict gagal (agenda belum lengkap)", () => {
    // Agenda tanpa narasi → gagal strict, lolos draft → jalur fallback.
    const out = parseContentForRender(
      {
        category: "corporate",
        eventName: "Rapat Tahunan",
        organizer: "PT Merriva",
        agenda: [{ title: "Sesi 1" }],
      },
      "corporate",
    );
    expect(out.category).toBe("corporate");
    if (out.category === "corporate") {
      expect(out.eventName).toBe("Rapat Tahunan");
      expect(out.organizer).toBe("PT Merriva");
      // entri agenda tanpa narasi di-drop, bukan mengosongkan seluruh konten
      expect(out.agenda).toHaveLength(0);
    }
  });

  it("memetakan draft family walau strict gagal (wishes belum lengkap)", () => {
    const out = parseContentForRender(
      {
        category: "family",
        eventName: "Khitanan Rafa",
        celebrant: "Rafa",
        parents: "Bpk. & Ibu Ahmad",
        wishes: [{ title: "Doa" }],
      },
      "family",
    );
    expect(out.category).toBe("family");
    if (out.category === "family") {
      expect(out.eventName).toBe("Khitanan Rafa");
      expect(out.celebrant).toBe("Rafa");
      expect(out.parents).toBe("Bpk. & Ibu Ahmad");
    }
  });
});
