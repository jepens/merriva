import "@testing-library/jest-dom/vitest";

// jsdom belum mengimplementasikan `scrollIntoView`, sedangkan komponen memakainya
// untuk memastikan pesan kegagalan benar-benar terlihat di layar ponsel.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
