import "@testing-library/jest-dom/vitest";

// jsdom belum mengimplementasikan `scrollIntoView`, sedangkan komponen memakainya
// untuk memastikan pesan kegagalan benar-benar terlihat di layar ponsel.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// jsdom belum punya `ResizeObserver`, sedangkan pemangkas foto memakainya untuk
// menyesuaikan bingkai dengan lebar kolom (editor dipakai dari HP). Tanpa ini
// komponennya melempar saat dirender di test, bukan karena cacat kodenya.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
