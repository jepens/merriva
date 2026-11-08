/**
 * Batas jumlah orang untuk RSVP lewat link UMUM (tanpa token tamu). Dinaikkan
 * dari 2 ke 4 atas keputusan pemilik (DECISIONS #120): pesan umum dikirim ke
 * tamu yang terlupa dari daftar, sering satu keluarga. Tamu bertoken memakai
 * `pax_allocated`-nya sendiri. Server (`submitRsvpAction`) menegakkannya; form
 * hanya mencerminkannya.
 *
 * Modul sendiri TANPA dependency: form RSVP adalah komponen klien di halaman
 * undangan publik, dan mengimpor modul validasi akan ikut menyeret Zod ke
 * bundelnya.
 */
export const RSVP_PAX_TANPA_TOKEN = 4;
