import { afterEach, describe, expect, it, vi } from "vitest";

import { fitToLine } from "@/themes/eternal-rose/fit-names";

/**
 * Pengepas nama eternal-rose (DECISIONS #107). jsdom tak punya tata letak, jadi
 * ukuran yang dibaca pengepas disuntik di sini. Yang dikunci adalah aritmetika
 * yang pernah salah: ukuran dibanding lebar KONTEN masker (padding ruang tinta
 * dikurangkan) — tanpa itu nama selebar 95–100% wadah tak dikecilkan dan tinta
 * italic di tepinya terpotong — dan nama yang muat tak disentuh.
 */

function pasang(o: {
  clientWidth: number;
  padding: number;
  need: number;
  fontSize: number;
}) {
  const el = document.createElement("span");
  const line = document.createElement("span");
  const text = document.createElement("span");
  line.append(text);
  el.append(line);
  el.style.fontSize = "12px"; // sisa pengepasan sebelumnya — wajib direset
  Object.defineProperty(line, "clientWidth", { value: o.clientWidth });
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (node) =>
      ({
        paddingLeft: node === line ? `${o.padding}px` : "0px",
        paddingRight: node === line ? `${o.padding}px` : "0px",
        fontSize: `${o.fontSize}px`,
      }) as CSSStyleDeclaration,
  );
  vi.spyOn(document, "createRange").mockReturnValue({
    selectNodeContents: () => {},
    getBoundingClientRect: () => ({ width: o.need }),
  } as unknown as Range);
  return { el, line };
}

describe("fitToLine", () => {
  afterEach(() => vi.restoreAllMocks());

  it("nama yang muat di lebar konten tetap berukuran desain", () => {
    const { el, line } = pasang({
      clientWidth: 297.6,
      padding: 12.8,
      need: 250,
      fontSize: 64,
    });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe("");
  });

  it("dibanding lebar KONTEN: lebih lebar dari konten tetapi muat di kotak berpadding → tetap dikecilkan", () => {
    // Konten 272 = 297,6 − 2×12,8. Teks 280 muat di kotak 297,6, tetapi tinta
    // italic-nya di tepi akan terpotong — inilah kasus "Abdurrauf".
    const { el, line } = pasang({
      clientWidth: 297.6,
      padding: 12.8,
      need: 280,
      fontSize: 64,
    });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe(`${Math.floor((64 * 272 * 0.98) / 280)}px`);
  });

  it("nama yang meluap dikecilkan sebanding, dibulatkan ke bawah", () => {
    const { el, line } = pasang({
      clientWidth: 272,
      padding: 0,
      need: 340,
      fontSize: 64,
    });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe("50px"); // ⌊64 × 272 × 0,98 / 340⌋ = ⌊50,17⌋
  });

  it("masker belum tertata (sampul display:none) → tak diubah", () => {
    const { el, line } = pasang({
      clientWidth: 0,
      padding: 0,
      need: 340,
      fontSize: 64,
    });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe("");
  });
});
