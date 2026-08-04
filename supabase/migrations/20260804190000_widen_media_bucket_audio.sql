-- Perluas bucket `media` agar juga menerima berkas audio (pustaka lagu latar,
-- SPEC §5 `songs`). Sebelumnya bucket dikunci ke `image/webp` + 2 MB (untuk foto
-- galeri). Bucket TETAP tunggal (SPEC §6.4) — prefix path membedakan konten
-- (`inv/…` foto, `songs/…` audio). Validasi per-tipe tetap DI APLIKASI:
--   • foto: 2 varian WebP, batas MEDIA_MAX_BYTES (lib/media)
--   • audio: batas 8 MB + whitelist MIME (lib/audio)
-- Batas ukuran bucket dinaikkan ke 8 MB (audio) sebagai backstop kasar; batas
-- foto yang lebih ketat tetap ditegakkan aplikasi. Tulis tetap HANYA via
-- service_role (RLS storage.objects menolak tulis langsung dari browser).
update storage.buckets
set
  allowed_mime_types = array[
    'image/webp',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/opus',
    'audio/wav',
    'audio/x-wav',
    'audio/webm'
  ]::text[],
  file_size_limit = 8388608 -- 8 MB
where id = 'media';
