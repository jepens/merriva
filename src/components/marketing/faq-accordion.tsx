/**
 * Akordeon FAQ berbasis `<details>/<summary>` native — TANPA JavaScript
 * (ringan untuk Lighthouse) dan aksesibel by default (keyboard + screen reader).
 */
export function FaqAccordion({
  items,
}: {
  items: readonly { q: string; a: string }[];
}) {
  return (
    <div className="mrv-faq">
      {items.map((item) => (
        <details key={item.q} className="mrv-faq__item" name="faq">
          <summary className="mrv-faq__q">{item.q}</summary>
          <p className="mrv-faq__a">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
