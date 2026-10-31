-- QR QRIS BinderPay disimpan bersama order (DECISIONS #99).
--
-- BinderPay tak punya halaman bayar hosted: `qr-mpm-generate` mengembalikan
-- string QR yang dirender di halaman KITA, dan membuat ulang QR untuk nomor
-- order yang sama ditolak (HTTP 500 `5004700`, diukur di sandbox). String ini
-- karenanya satu-satunya salinan QR order tersebut — tanpa kolom ini, pelanggan
-- yang menutup tab tak bisa lagi membayar ordernya.
--
-- Kolom biasa, bukan rahasia: QR hanya bisa dibayar sebesar nominal ordernya,
-- dan pemiliknya sudah membaca baris ini lewat RLS `orders_select`. Klien tak
-- bisa menulisnya (UPDATE `orders` hanya admin/service_role).
alter table public.orders
  add column if not exists qr_content text;

comment on column public.orders.qr_content is
  'String QRIS dari gateway tanpa halaman bayar hosted (BinderPay). NULL untuk Pakasir. Satu-satunya salinan: QR tak bisa dibuat ulang untuk nomor order yang sama.';
