// Stub `server-only` untuk lingkungan test (Vitest). Paket asli hanya menandai
// modul agar GAGAL bila ter-bundle ke klien (guard build-time); di test tak ada
// bundle klien, jadi modul kosong ini setara & aman. Memungkinkan unit-test
// modul server-only (mis. metrik admin) tanpa melepas guard di produksi.
export {};
