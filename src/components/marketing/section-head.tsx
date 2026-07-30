import type { ReactNode } from "react";

/** Kepala seksi marketing: eyebrow + judul display + subjudul opsional. */
export function SectionHead({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"
      }
      style={{ marginBottom: "clamp(1.75rem, 4vw, 2.75rem)" }}
    >
      <span className="mrv-eyebrow">{eyebrow}</span>
      <h2 className="mrv-display mrv-h2" style={{ marginTop: "0.85rem" }}>
        {title}
      </h2>
      {subtitle ? (
        <p className="mrv-lead" style={{ marginTop: "0.7rem" }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
