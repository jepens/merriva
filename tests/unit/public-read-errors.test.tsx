import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Galat bacaan di jalur publik DILEMPAR, bukan dirender sebagai data kosong
 * (DECISIONS #45).
 *
 * Halaman undangan `/{slug}` adalah ISR: `data ?? []` DI-CACHE sebagai isi
 * undangan bagi semua tamu (jadwal/galeri kosong, watermark di undangan
 * Premium, 404 karena tema null), sedangkan render yang melempar tak pernah
 * di-cache. Pratinjau & Album Momen dinamis, tetapi fallback-nya menyesatkan
 * (pemilik mengira isiannya hilang; tamu diberi "album belum aktif").
 *
 * Galat disuntik berbentuk OBJEK POLOS — seperti postgrest-js tanpa
 * `.throwOnError()` — dan yang dilempar harus `SupabaseReadError` berlabel.
 * Setiap bagian juga menguji "data memang TAK ADA tanpa galat" (perilaku lama
 * yang harus tetap sama) dan slug mustahil (404 tanpa query).
 */

type Res = { data: unknown; error: unknown };

const { refs } = vi.hoisted(() => ({
  refs: {
    tables: {} as Record<string, Res>,
    themeProps: null as unknown,
    queries: 0,
  },
}));

/** Klien palsu: tiap tabel menjawab `refs.tables[table]` (maybeSingle & then). */
function fakeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    from: (table: string) => {
      refs.queries += 1;
      const res = () => refs.tables[table] ?? { data: null, error: null };
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "eq", "order", "not", "limit", "lt"]) {
        chain[op] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve(res());
      chain.then = (
        ok: (v: unknown) => unknown,
        fail: (e: unknown) => unknown,
      ) => Promise.resolve(res()).then(ok, fail);
      return chain;
    },
  };
}

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => fakeClient(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => fakeClient(),
}));
vi.mock("@/server/guards/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1" })),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ getPublicUrl: (p: string) => `/media/${p}` }),
}));
vi.mock("@/themes/registry", () => ({
  getThemeLoader: () => async () => ({
    default: (props: unknown) => {
      refs.themeProps = props;
      return <div data-testid="tema" />;
    },
  }),
}));
vi.mock("@/themes/theme-styles", () => ({ ThemeStyles: () => null }));
vi.mock("@/components/public/guest-personalization", () => ({
  GuestPersonalizationProvider: ({ children }: { children: unknown }) =>
    children,
}));
vi.mock("@/components/public/momen/momen-fab", () => ({
  MomenFab: () => <div data-testid="momen-fab" />,
}));
vi.mock("@/components/public/momen/momen-camera", () => ({
  MomenCamera: () => <div data-testid="momen-camera" />,
}));
vi.mock("@/components/public/momen/momen.css", () => ({}));
vi.mock("@/components/preview/preview-frame", () => ({
  PreviewFrame: () => <div data-testid="bingkai" />,
  PreviewEmbedStyle: () => null,
}));
vi.mock("@/server/momen/photos", () => ({
  fetchMomenPhotos: async () => ({ photos: [], nextCursor: null }),
  fetchMomenAlbumStats: async () => ({
    visibleCount: 0,
    photographerCount: 0,
  }),
}));

import PublicInvitationPage, { generateMetadata } from "@/app/[slug]/page";
import MomenGuestPage from "@/app/[slug]/momen/page";
import PreviewPage from "@/app/preview/[id]/page";
import { SupabaseReadError } from "@/lib/supabase/result";
import type { InvitationData } from "@/types/invitation";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";
import { resolveMusic } from "@/server/invitation-data";
import { getEffectiveLimits } from "@/server/limits";

const INV_ID = "9a500f03-f12d-4d66-85fc-af8ebcedd350";
const PKG = "pkg-premium";
const SONG = "77777777-7777-4777-8777-777777777777"; // settingsSchema: UUID
/** Bentuk galat postgrest-js sungguhan (objek polos, bukan Error). */
const BOOM = {
  message: "TypeError: fetch failed",
  details: "",
  hint: "",
  code: "",
};
/** Slug yang pasti tak ada: di luar CHECK `^[a-z0-9-]{3,60}$`. */
const MUSTAHIL: [string, string][] = [
  ["61 karakter", "a".repeat(61)],
  ["2 karakter", "ab"],
  ["garis bawah", "andi_sinta"],
  ["9000 karakter", "a".repeat(9000)],
];

/** Yang dilempar = SupabaseReadError berlabel bacaan, dengan galat asli di `cause`. */
const galatBacaan = (label: string) => (e: unknown) =>
  e instanceof SupabaseReadError &&
  e.cause === BOOM &&
  e.message.startsWith(`${label}: `);

function tablesOk(): Record<string, Res> {
  return {
    invitations: {
      data: {
        id: INV_ID,
        slug: "andi-sinta",
        category: "wedding",
        content: emptyContent("wedding"),
        settings: { ...DEFAULT_SETTINGS, songId: SONG },
        event_date: null,
        package_id: PKG,
        theme_id: "theme-1",
        status: "active",
        purged_at: null,
        updated_at: "2026-09-20T00:00:00.000Z",
      },
      error: null,
    },
    themes: { data: { slug: "lumina" }, error: null },
    invitation_events: {
      data: [
        {
          id: "ev-1",
          name: "Akad",
          start_at: "2026-12-20T02:00:00Z",
          end_at: null,
          venue_name: "Masjid",
          address: null,
          maps_url: null,
        },
      ],
      error: null,
    },
    media: { data: [], error: null },
    momen_albums: { data: { id: "album-1" }, error: null },
    packages: {
      data: { limits: { watermark: false, max_photos: 20 } },
      error: null,
    },
    songs: {
      data: { title: "Lagu", storage_path: "songs/a.mp3", is_active: true },
      error: null,
    },
  };
}

const tema = () => refs.themeProps as { data: InvitationData };

afterEach(cleanup);
beforeEach(() => {
  refs.tables = tablesOk();
  refs.themeProps = null;
  refs.queries = 0;
});

describe("/{slug} (ISR) — setiap bacaan wajib berhasil", () => {
  const buka = (slug = "andi-sinta") =>
    PublicInvitationPage({ params: Promise.resolve({ slug }) });

  it("semua bacaan berhasil → tema menerima jadwal, galeri, musik, dan batas paket yang benar", async () => {
    render(await buka());
    expect(screen.getByTestId("tema")).toBeInTheDocument();
    expect(screen.getByTestId("momen-fab")).toBeInTheDocument();
    expect(tema().data.events.map((e) => e.name)).toEqual(["Akad"]);
    expect(tema().data.watermark).toBe(false);
    expect(tema().data.music?.url).toBe("/media/songs/a.mp3");
  });

  it.each([
    ["invitations", "undangan"],
    ["themes", "tema (dulu → notFound = 404 ter-cache)"],
    ["invitation_events", "jadwal (dulu → undangan tanpa jadwal)"],
    ["media", "galeri (dulu → galeri kosong)"],
    ["momen_albums", "Album Momen (dulu → tombol Momen hilang)"],
    ["packages", "batas paket (dulu → Premium ter-cache ber-watermark)"],
    ["songs", "musik (dulu → undangan tanpa musik)"],
  ])(
    "galat %s — %s → render MELEMPAR SupabaseReadError berlabel (tak pernah di-cache)",
    async (table) => {
      refs.tables[table] = { data: null, error: BOOM };
      await expect(buka()).rejects.toSatisfy(galatBacaan(table));
    },
  );

  it("TANPA galat, data yang memang tak ada tetap diperlakukan seperti dulu", async () => {
    refs.tables.invitation_events = { data: [], error: null };
    refs.tables.momen_albums = { data: null, error: null };
    refs.tables.packages = { data: null, error: null }; // paket tak terlihat → Basic
    refs.tables.songs = { data: null, error: null };
    render(await buka());
    expect(tema().data.events).toEqual([]);
    expect(tema().data.watermark).toBe(true);
    expect(tema().data.music).toBeNull();
    expect(screen.queryByTestId("momen-fab")).toBeNull();
  });

  it("tema yang memang tak ada (tanpa galat) → tetap notFound", async () => {
    refs.tables.themes = { data: null, error: null };
    await expect(buka()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each(MUSTAHIL)(
    "slug mustahil (%s) → 404 & metadata kosong TANPA query (dulu 414 gateway → galat + Sentry per hit)",
    async (_label, slug) => {
      await expect(buka(slug)).rejects.toThrow("NEXT_NOT_FOUND");
      expect(
        await generateMetadata({ params: Promise.resolve({ slug }) }),
      ).toEqual({});
      expect(refs.queries).toBe(0);
    },
  );

  it("slug huruf besar tetap dinormalkan dulu (bukan dianggap mustahil)", async () => {
    render(await buka("Andi-Sinta"));
    expect(screen.getByTestId("tema")).toBeInTheDocument();
  });
});

/**
 * Menumpang perkakas tiruan di berkas ini (bukan berkas baru) karena hanya di
 * sini `generateMetadata` sudah punya klien Supabase palsu yang lengkap.
 *
 * Judul inilah yang DILIHAT TAMU LEBIH DULU saat tautan ditempel di WhatsApp —
 * sebelum gambar OG termuat. Dulu setiap kategori selain pernikahan jatuh ke
 * nama brand, dan karena layout menambahkan "· Merriva", undangan khitanan
 * tersebar dengan judul "Merriva · Merriva" tanpa menyebut acaranya sama
 * sekali. Gambar OG-nya sendiri sudah benar, jadi tak ada yang terlihat salah
 * sampai seseorang membaca judulnya.
 */
describe("/{slug} — judul metadata (pratinjau tautan WhatsApp)", () => {
  const judul = async (slug = "andi-sinta") =>
    (await generateMetadata({ params: Promise.resolve({ slug }) })).title;

  // Kategori yang SAH hanya tiga: wedding, corporate, family. Khitanan/aqiqah/
  // ulang tahun semuanya `family` dengan `eventName` sebagai nama acaranya —
  // jadi satu kategori ini mewakili sebagian besar undangan non-pernikahan.
  /** Ganti isi undangan pada fixture, pertahankan sisanya. */
  function pakaiIsi(category: "wedding" | "family", isi: object) {
    const row = refs.tables.invitations.data as Record<string, unknown>;
    row.category = category;
    row.content = { ...emptyContent(category), ...isi };
  }

  it("pernikahan: nama kedua mempelai", async () => {
    pakaiIsi("wedding", {
      groom: { name: "Andi", nickname: "" },
      bride: { name: "Sinta", nickname: "" },
    });
    expect(await judul()).toContain("Andi & Sinta");
  });

  it("non-pernikahan memakai nama acara, BUKAN nama brand", async () => {
    pakaiIsi("family", { eventName: "Khitanan Rafa" });
    const t = await judul();
    expect(t).toBe("Khitanan Rafa");
    // Penjaga sesungguhnya: layout menambahkan "· Merriva", jadi judul yang
    // berisi nama brand menghasilkan "Merriva · Merriva".
    expect(t).not.toBe("Merriva");
  });

  it("non-pernikahan tanpa nama acara → nama brand (bukan string kosong)", async () => {
    // Kosong tak boleh lolos: judul kosong membuat WhatsApp menampilkan URL
    // mentah, yang lebih buruk daripada nama brand.
    pakaiIsi("family", { eventName: "" });
    expect(await judul()).toBe("Merriva");
  });
});

/**
 * Syarat RESMI pratinjau tautan WhatsApp (DECISIONS #119): og:title,
 * og:description, dan og:url WAJIB; og:url harus kanonik tanpa parameter
 * identitas pengguna. Dulu og:url tak pernah dikeluarkan dan gambarnya PNG
 * 1,4 MB — kartu jatuh ke tautan polos, persis rupa pesan penipuan.
 */
describe("/{slug} — metadata kartu pratinjau WhatsApp", () => {
  const meta = async (slug = "andi-sinta") =>
    generateMetadata({ params: Promise.resolve({ slug }) });

  it("og:url = path kanonik undangan, TANPA ?g= token tamu", async () => {
    const m = await meta();
    expect(m.openGraph?.url).toBe("/andi-sinta");
    expect(String(m.openGraph?.url)).not.toContain("?");
  });

  it("gambar dinyatakan JPEG (route kini mengirim JPEG, bukan PNG)", async () => {
    const images = (await meta()).openGraph?.images as Array<{ type: string }>;
    expect(images[0].type).toBe("image/jpeg");
  });

  it("deskripsi = hari & tanggal (zona acara) · tempat — ajakan", async () => {
    // 2026-12-20T02:00Z di WIB = Minggu 20 Desember 2026, 09.00.
    expect((await meta()).description).toBe(
      "Minggu, 20 Desember 2026 · Masjid — buka undangan & konfirmasi kehadiran",
    );
  });

  it("nama tempat yang panjang tak ikut (kartu 1–2 baris)", async () => {
    const rows = refs.tables.invitation_events.data as Array<
      Record<string, unknown>
    >;
    rows[0].venue_name = "Gedung Serbaguna Pemuda Pancasila Kecamatan Sukasari";
    expect((await meta()).description).toBe(
      "Minggu, 20 Desember 2026 — buka undangan & konfirmasi kehadiran",
    );
  });

  it("tanpa sesi & tanpa event_date → kembali ke deskripsi lama (bukan tanggal kosong)", async () => {
    refs.tables.invitation_events = { data: [], error: null };
    expect((await meta()).description).toBe("Undangan");
  });

  it("galat membaca jadwal → MELEMPAR, bukan kartu tanpa tanggal yang di-cache (#45)", async () => {
    refs.tables.invitation_events = { data: null, error: BOOM };
    await expect(meta()).rejects.toSatisfy(galatBacaan("invitation_events"));
  });
});

describe("/preview/{id} — pratinjau pemilik tak menampilkan isian palsu", () => {
  const buka = (embed?: string) =>
    PreviewPage({
      params: Promise.resolve({ id: INV_ID }),
      searchParams: Promise.resolve(embed ? { embed } : {}),
    });

  it("bingkai: galat membaca status → MELEMPAR, bukan 404 'tak ada'", async () => {
    refs.tables.invitations = { data: null, error: BOOM };
    await expect(buka()).rejects.toSatisfy(
      galatBacaan("invitations (bingkai)"),
    );
  });

  it("bingkai: undangan memang tak terlihat (RLS, tanpa galat) → tetap 404", async () => {
    refs.tables.invitations = { data: null, error: null };
    await expect(buka()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([
    "invitations",
    "themes",
    "invitation_events",
    "media",
    "packages",
    "songs",
  ])(
    "isi iframe: galat %s → MELEMPAR (dulu pratinjau tanpa jadwal/galeri membuat pemilik mengira isiannya hilang)",
    async (table) => {
      refs.tables[table] = { data: null, error: BOOM };
      await expect(buka("1")).rejects.toSatisfy(galatBacaan(table));
    },
  );

  it("isi iframe: semua berhasil → tema dirender dengan jadwalnya", async () => {
    render(await buka("1"));
    expect(tema().data.events.map((e) => e.name)).toEqual(["Akad"]);
  });
});

describe("/{slug}/momen — tamu tak diberi 'belum aktif' karena kedipan DB", () => {
  const buka = (slug = "andi-sinta") =>
    MomenGuestPage({ params: Promise.resolve({ slug }) });

  it("galat membaca undangan → MELEMPAR (dulu 404)", async () => {
    refs.tables.invitations = { data: null, error: BOOM };
    await expect(buka()).rejects.toSatisfy(galatBacaan("invitations"));
  });

  it("galat membaca album → MELEMPAR (dulu 'Album belum aktif')", async () => {
    refs.tables.momen_albums = { data: null, error: BOOM };
    await expect(buka()).rejects.toSatisfy(galatBacaan("momen_albums"));
  });

  it("album memang belum ada (tanpa galat) → tetap layar 'belum aktif'", async () => {
    refs.tables.momen_albums = { data: null, error: null };
    render(await buka());
    expect(screen.queryByTestId("momen-camera")).toBeNull();
  });

  it("slug mustahil → 404 TANPA query", async () => {
    await expect(buka("a".repeat(61))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(refs.queries).toBe(0);
  });
});

describe("helper bersama", () => {
  it("getEffectiveLimits: galat DB dilempar; paket tak ada → lantai Basic; tanpa paket → Basic tanpa query", async () => {
    const client = fakeClient() as unknown as Parameters<
      typeof getEffectiveLimits
    >[0];
    refs.tables.packages = { data: null, error: BOOM };
    await expect(getEffectiveLimits(client, PKG)).rejects.toSatisfy(
      galatBacaan("packages"),
    );
    refs.tables.packages = { data: null, error: null };
    expect((await getEffectiveLimits(client, PKG)).watermark).toBe(true);
    refs.queries = 0;
    expect((await getEffectiveLimits(client, null)).watermark).toBe(true);
    expect(refs.queries).toBe(0);
  });

  it("resolveMusic: galat DB dilempar; lagu tak ada / nonaktif → tanpa musik", async () => {
    const client = fakeClient() as unknown as Parameters<
      typeof resolveMusic
    >[0];
    refs.tables.songs = { data: null, error: BOOM };
    await expect(resolveMusic(client, SONG)).rejects.toSatisfy(
      galatBacaan("songs"),
    );
    refs.tables.songs = { data: null, error: null };
    expect(await resolveMusic(client, SONG)).toBeNull();
    refs.tables.songs = {
      data: { title: "x", storage_path: "s.mp3", is_active: false },
      error: null,
    };
    expect(await resolveMusic(client, SONG)).toBeNull();
    expect(await resolveMusic(client, undefined)).toBeNull();
  });
});
