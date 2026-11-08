import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Form RSVP lewat link UMUM (tanpa token) — batas jumlah orang 4 (DECISIONS
 * #120). Form ber-`noValidate`, jadi atribut `max` tak mencegah angka yang
 * DIKETIK di papan angka HP; dulu server memotongnya diam-diam (6 → 4) sambil
 * menjawab sukses, dan tuan rumah menghitung katering untuk 4.
 */

const { submit } = vi.hoisted(() => ({
  submit: vi.fn(async () => ({ status: "success" as const })),
}));
vi.mock("@/server/actions/guestbook", () => ({ submitRsvpAction: submit }));

import { RsvpForm } from "@/components/public/guestbook/rsvp-form";
import { copy } from "@/lib/copy";
import { RSVP_PAX_TANPA_TOKEN } from "@/lib/rsvp-limits";

const t = copy.guestbook.form;

beforeEach(() => submit.mockClear());
afterEach(cleanup);

async function isi(guestToken?: string, pax = "6") {
  const user = userEvent.setup();
  render(<RsvpForm slug="rani-wanda" guestToken={guestToken} />);
  await user.type(screen.getByPlaceholderText(t.namePlaceholder), "Bu Siti");
  const jumlah = screen.getByLabelText(t.pax);
  await user.clear(jumlah);
  await user.type(jumlah, pax);
  await user.click(screen.getByRole("button", { name: t.submit }));
}

describe("RSVP link umum — maks 4 orang", () => {
  it("6 orang tanpa token → DITOLAK dengan pesan jelas, server tak dipanggil", async () => {
    await isi(undefined, "6");
    expect(screen.getByRole("alert")).toHaveTextContent(
      t.paxMax(RSVP_PAX_TANPA_TOKEN),
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("4 orang tanpa token → terkirim apa adanya", async () => {
    await isi(undefined, "4");
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ pax: 4, guestToken: undefined }),
    );
  });

  it("tamu BERTOKEN tak dibatasi 4 di form (server memakai alokasinya)", async () => {
    await isi("tokentamu1234", "6");
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ pax: 6, guestToken: "tokentamu1234" }),
    );
  });

  it("kolom jumlah bisa DIKOSONGKAN lalu diketik ulang (dulu '1' kembali → '13')", async () => {
    const user = userEvent.setup();
    render(<RsvpForm slug="rani-wanda" />);
    const jumlah = screen.getByLabelText(t.pax) as HTMLInputElement;
    await user.clear(jumlah);
    expect(jumlah.value).toBe("");
    await user.type(jumlah, "3");
    expect(jumlah.value).toBe("3");
  });

  // ("1e1" sah di input angka browser, tetapi jsdom membuang huruf "e" saat
  // diketik — regex yang sama menolaknya; tak bisa diuji di jsdom.)
  it.each(["2.5", "0"])(
    "'%s' → ditolak dengan pesan, bukan diam-diam dibulatkan",
    async (v) => {
      await isi("tokentamu1234", v);
      expect(screen.getByRole("alert")).toHaveTextContent(t.paxInvalid);
      expect(submit).not.toHaveBeenCalled();
    },
  );

  it("pesan galat jumlah hilang saat tamu memilih 'berhalangan'", async () => {
    const user = userEvent.setup();
    render(<RsvpForm slug="rani-wanda" />);
    await user.type(screen.getByPlaceholderText(t.namePlaceholder), "Bu Siti");
    const jumlah = screen.getByLabelText(t.pax);
    await user.clear(jumlah);
    await user.type(jumlah, "6");
    await user.click(screen.getByRole("button", { name: t.submit }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByLabelText(t.notAttending));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("batas form = batas server (satu konstanta)", () => {
    expect(RSVP_PAX_TANPA_TOKEN).toBe(4);
  });
});
