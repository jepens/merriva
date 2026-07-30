import { ImageResponse } from "next/og";

import { copy } from "@/lib/copy";

/**
 * OG image merek untuk seluruh halaman marketing (konvensi file Next). Statis &
 * seragam — pratinjau tautan Merriva di WhatsApp/media sosial tampak profesional
 * (SPEC §4.1: "meta SEO lengkap ... OG image"). Memakai font bawaan `next/og`
 * (tanpa baca berkas) → aman di image standalone.
 */
export const runtime = "nodejs";
export const alt = `${copy.brand.name} — ${copy.marketing.hero.titleLead} ${copy.marketing.hero.titleAccent}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = {
  paper: "#fbf9f6",
  ink: "#241f2b",
  inkSoft: "#5c5563",
  accent: "#9a6a22",
  line: "#e7ded2",
};

export default function MarketingOgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: C.paper,
        color: C.ink,
        padding: 84,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        {copy.brand.name}
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 14,
            background: "#c68a3c",
            marginLeft: 10,
            marginTop: 22,
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: C.inkSoft,
          }}
        >
          {copy.marketing.hero.eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginTop: 18,
            maxWidth: 900,
          }}
        >
          {copy.marketing.hero.titleLead}{" "}
          <span style={{ color: C.accent, marginLeft: 16 }}>
            {copy.marketing.hero.titleAccent}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 30,
          color: C.inkSoft,
          borderTop: `2px solid ${C.line}`,
          paddingTop: 28,
        }}
      >
        <span>merriva.id</span>
        <span>
          {copy.admin.categoryLabel.wedding} ·{" "}
          {copy.admin.categoryLabel.corporate} ·{" "}
          {copy.admin.categoryLabel.family}
        </span>
      </div>
    </div>,
    { ...size },
  );
}
