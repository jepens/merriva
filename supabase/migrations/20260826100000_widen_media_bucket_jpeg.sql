-- Perluas bucket `media` agar menerima `image/jpeg` selain `image/webp`.
-- Alasan: `canvas.toBlob('image/webp')` TIDAK didukung Safari/iOS (caniuse) →
-- klien fallback ke JPEG q0.82 (lib/image/encode). Tanpa MIME ini, unggah foto
-- galeri dari iPhone (dan foto Album Momen) ditolak. Bucket TETAP tunggal
-- (SPEC §6.4); validasi ketat per-tipe tetap DI APLIKASI (isVariantBlob + batas
-- byte + magic-byte untuk momen). Tulis tetap HANYA via service_role.
update storage.buckets
set
  allowed_mime_types = array[
    'image/webp',
    'image/jpeg',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/opus',
    'audio/wav',
    'audio/x-wav',
    'audio/webm'
  ]::text[]
where id = 'media';
