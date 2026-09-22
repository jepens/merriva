import { describe, expect, it } from "vitest";

import {
  activationReadiness,
  fetchReadinessEvents,
  type ReadinessEventRow,
} from "@/lib/activation-readiness";
import { editorHref, stepKeyFromParam } from "@/lib/editor-links";

/**
 * Syarat sebelum bayar (SPEC §4.8 langkah 0, DECISIONS #44) — satu fungsi dan
 * satu query untuk halaman aktivasi dan createCheckoutAction.
 */

const row = (r: Partial<ReadinessEventRow>): ReadinessEventRow => ({
  name: "",
  start_at: null,
  end_at: null,
  venue_name: null,
  address: null,
  maps_url: null,
  ...r,
});

const SLUG = { slug: "andi-sinta" };
const BERJAM = row({ name: "Akad", start_at: "2026-08-15T01:00:00Z" });
const TANPA_JAM = row({ name: "Resepsi" });

describe("activationReadiness", () => {
  it("alamat sudah diatur + ada sesi berjam → siap, tanpa syarat tersisa", () => {
    expect(activationReadiness(SLUG, [BERJAM])).toEqual({
      blockers: [],
      unscheduled: [],
    });
  });

  it("tanpa sesi sama sekali → syarat jadwal", () => {
    expect(activationReadiness(SLUG, []).blockers).toEqual(["schedule"]);
  });

  it("hanya sesi TANPA jam → tetap syarat jadwal (sesi itu tak tampil ke tamu)", () => {
    expect(activationReadiness(SLUG, [TANPA_JAM]).blockers).toEqual([
      "schedule",
    ]);
  });

  it.each(["", "bukan-waktu"])(
    "start_at tak sah (%j) tidak dihitung berjam — predikat sama dengan halaman publik",
    (start_at) => {
      expect(
        activationReadiness(SLUG, [row({ name: "Akad", start_at })]).blockers,
      ).toEqual(["schedule"]);
    },
  );

  it("SEMUA syarat dilaporkan sekaligus, urut alamat lalu jadwal", () => {
    expect(activationReadiness({ slug: "draft-a1b2c3" }, []).blockers).toEqual([
      "slug",
      "schedule",
    ]);
  });

  it("slug placeholder saja → hanya syarat alamat", () => {
    expect(
      activationReadiness({ slug: "draft-a1b2c3" }, [BERJAM]).blockers,
    ).toEqual(["slug"]);
  });

  it("minimal SATU sesi berjam cukup: sesi lain yang belum berjam tak menahan bayar, tetapi disebut", () => {
    const r = activationReadiness(SLUG, [BERJAM, TANPA_JAM]);
    expect(r.blockers).toEqual([]);
    expect(r.unscheduled).toEqual(["Resepsi"]);
  });

  it("sesi tanpa nama disebut dengan nomor kartunya di editor (urutan sort_order)", () => {
    const r = activationReadiness(SLUG, [
      BERJAM,
      row({ name: "  ", venue_name: "Gedung" }),
      row({ name: "Ngunduh" }),
    ]);
    expect(r.unscheduled).toEqual(["Sesi 2", "Ngunduh"]);
  });

  it("baris KOSONG total (sisa lama) tak disebut — editor menampilkannya tanpa catatan apa pun", () => {
    const r = activationReadiness(SLUG, [
      BERJAM,
      row({}),
      row({ name: "", end_at: "2026-08-15T03:00:00Z" }),
    ]);
    // Nomor tetap posisi di daftar: kartu ke-3 di editor = "Sesi 3".
    expect(r.unscheduled).toEqual(["Sesi 3"]);
  });

  it("baris kosong total tak memenuhi syarat jadwal", () => {
    expect(activationReadiness(SLUG, [row({})]).blockers).toEqual(["schedule"]);
  });
});

describe("fetchReadinessEvents — satu query untuk halaman & aksi", () => {
  it("membaca sesi undangan INI saja, urut sort_order menaik", async () => {
    const calls: { op: string; args: unknown[] }[] = [];
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    for (const op of ["from", "select", "eq", "order"]) {
      chain[op] = (...args: unknown[]) => {
        calls.push({ op, args });
        return chain;
      };
    }
    fetchReadinessEvents(
      chain as unknown as Parameters<typeof fetchReadinessEvents>[0],
      "inv-1",
    );

    expect(calls).toEqual([
      { op: "from", args: ["invitation_events"] },
      {
        op: "select",
        args: ["name, start_at, end_at, venue_name, address, maps_url"],
      },
      { op: "eq", args: ["invitation_id", "inv-1"] },
      { op: "order", args: ["sort_order", { ascending: true }] },
    ]);
  });
});

describe("tautan editor per langkah", () => {
  it("?langkah=jadwal membuka langkah Jadwal", () => {
    expect(editorHref("inv-1", "jadwal")).toBe(
      "/dashboard/undangan/inv-1/edit?langkah=jadwal",
    );
    expect(stepKeyFromParam("jadwal")).toBe("schedule");
  });

  it("tanpa langkah → editor biasa", () => {
    expect(editorHref("inv-1")).toBe("/dashboard/undangan/inv-1/edit");
  });

  it.each([undefined, "", "Jadwal", "schedule", "toString", ["jadwal"]])(
    "nilai tak dikenal (%j) → langkah pertama, bukan galat",
    (value) => {
      expect(stepKeyFromParam(value)).toBeUndefined();
    },
  );
});
