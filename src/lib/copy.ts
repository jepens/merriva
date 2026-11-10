/**
 * Teks UI berbahasa Indonesia, terpusat (persiapan i18n). Lihat SPEC §9.
 * Seluruh string yang tampil ke pengguna sebaiknya berasal dari sini.
 */
/**
 * SATU-SATUNYA alamat dukungan pelanggan (AUDIT-2026-10-01 A5). Dipakai
 * `copy.support` dan `copy.marketing.legal.contactEmail` agar alamatnya tak
 * bisa bercabang diam-diam. Literal, bukan env: mengubahnya butuh deploy —
 * disengaja, karena alamat ini ikut tercetak di dokumen yang disimpan pelanggan.
 */
const SUPPORT_EMAIL = "halo@merriva.id";

export const copy = {
  brand: {
    name: "Merriva",
    tagline: "Undangan digital untuk setiap momen bahagia.",
  },
  // Halaman 404 global (tamu yang membuka slug salah/kedaluwarsa).
  notFoundPage: {
    code: "404",
    title: "Halaman tidak ditemukan",
    body: "Tautan yang Anda buka mungkin salah ketik, kedaluwarsa, atau undangannya sudah tidak aktif.",
    cta: "Ke beranda Merriva",
    // Varian untuk PEMILIK di dalam dashboard (AUDIT-2026-10-01). Teks di atas
    // ditulis untuk TAMU undangan ("undangannya sudah tidak aktif") dan
    // menanamkan kecemasan palsu saat pemilik sekadar salah menyalin id.
    ownerTitle: "Halaman ini tidak ada",
    ownerBody:
      "Undangan yang Anda cari mungkin sudah dihapus, atau tautannya salah salin. Undangan Anda yang lain tidak terpengaruh.",
    ownerCta: "Kembali ke daftar undangan",
  },
  common: {
    loading: "Memuat…",
    error: "Terjadi kesalahan. Silakan coba lagi.",
    // Halaman gagal dimuat (DECISIONS #45): boundary runtime halaman dinamis
    // (`app/global-error.tsx`) & dashboard. Halaman 500 STATIS Next tak bisa
    // diganti, jadi render ISR `/{slug}` yang gagal tak memakai teks ini.
    loadError: {
      title: "Halaman belum bisa dimuat",
      body: "Terjadi gangguan saat memuat halaman ini. Coba lagi sebentar lagi.",
      retry: "Coba lagi",
    },
    save: "Simpan",
    cancel: "Batal",
    // Badan respons 503 route unduhan ZIP (galeri & Album Momen). Teks POLOS,
    // bukan JSX: unduhannya gagal, jadi inilah yang dirender peramban di tab.
    //
    // Nadanya ditentukan oleh momennya. Pemilik membuka ini karena email
    // peringatan pra-purge menyuruhnya menyelamatkan datanya, jadi kalimat
    // pertama harus langsung menutup ketakutan yang benar ("foto saya hilang")
    // dan menamai yang sebenarnya terjadi. Kalimat kedua menjelaskan kenapa
    // tak ada berkas yang terunduh — tanpa itu, "gagal" terbaca sebagai
    // "datanya tidak ada".
    arsipPadam: [
      "Foto Anda masih tersimpan, tetapi saat ini tidak bisa diambil dari penyimpanan.",
      "Berkas ZIP sengaja tidak dibuat agar Anda tidak menerima arsip kosong yang terlihat seperti arsip yang berhasil.",
      `Coba lagi beberapa menit lagi. Bila tetap gagal, email ${SUPPORT_EMAIL} dan sebutkan nama undangannya — kami bisa melihat penyebabnya dari sisi kami.`,
    ].join("\n\n"),
  },
  // Kontak dukungan (AUDIT-2026-10-01 A5). Sebelumnya produk menyuruh "hubungi
  // kami" di kartu pembayaran yang tertahan TANPA memberi alamat apa pun —
  // tepat saat uang pelanggan sudah keluar tetapi undangannya belum aktif.
  // Subject & body mailto memuat kode order karena kebijakan refund mewajibkan
  // pelanggan menyebutkannya, sementara state `error` pada poller tidak
  // merender ringkasan order sama sekali.
  // Pemberitahuan privasi di TITIK PENGUMPULAN (AUDIT-2026-10-01).
  // Tamu bukan pelanggan Merriva: ia menyerahkan nama, nomor WhatsApp, ucapan,
  // dan — di Album Momen — fotonya sendiri, tanpa pernah punya hubungan dengan
  // kami. UU PDP menuntut pemberitahuan SEBELUM data dikumpulkan, dan satu-
  // satunya tempat yang sah untuk itu adalah formulirnya, bukan halaman legal
  // yang takkan pernah dibuka tamu.
  //
  // Tuan rumah disebut lebih dulu karena DIALAH pengendali datanya; Merriva
  // hanya pemroses. Anchor biasa, bukan `next/link` — halaman undangan punya
  // anggaran bundel 64 KB gzip dan prefetch halaman marketing tak ada gunanya
  // bagi tamu.
  guestPrivacy: {
    note: "Data yang kamu kirim dikelola tuan rumah acara.",
    link: "Kebijakan Privasi",
    href: "/privasi",
  },
  support: {
    email: SUPPORT_EMAIL,
    title: "Butuh bantuan?",
    body: "Email tim Merriva. Kami menanggapi pada hari kerja, biasanya dalam 1x24 jam.",
    bodyWithOrder:
      "Email tim Merriva dan sebutkan kode order Anda. Bila acara sudah dekat, tulis juga tanggal acaranya agar kami dahulukan.",
    cta: "Email tim Merriva",
    emailLabel: "Atau kirim manual ke",
    footerLine: "Ada kendala? Email kami di",
    mailSubject: "Bantuan Merriva",
    mailSubjectOrder: (orderCode: string) =>
      `Bantuan Merriva — order ${orderCode}`,
    mailBody: "Ceritakan kendala Anda di sini.",
    mailBodyOrder: (orderCode: string) =>
      `Kode order: ${orderCode}\n\nCeritakan kendala Anda di sini:\n`,
  },
  auth: {
    // Label & field
    email: "Email",
    password: "Kata sandi",
    passwordNew: "Kata sandi baru",
    passwordConfirm: "Ulangi kata sandi",
    // Tombol lihat kata sandi (AUDIT-2026-10-01 B2). Dipakai sebagai
    // `aria-label`, jadi harus berbunyi sebagai PERINTAH, bukan status.
    passwordShow: "Tampilkan kata sandi",
    passwordHide: "Sembunyikan kata sandi",
    // Syarat ditampilkan SEBELUM submit — sebelumnya pengguna baru mengetahuinya
    // dari pesan penolakan, setelah tantangan Turnstile terlanjur terpakai.
    passwordHint: "Minimal 8 karakter.",
    // Ganti kata sandi dari dalam akun (AUDIT-2026-10-01 B1).
    passwordCurrent: "Kata sandi saat ini",
    currentPasswordWrong: "Kata sandi saat ini salah.",
    passwordChanged:
      "Kata sandi berhasil diubah. Perangkat lain yang masih masuk akan diminta masuk ulang saat sesinya berakhir.",
    changePasswordTitle: "Ubah kata sandi",
    changePasswordSubtitle:
      "Masukkan kata sandi saat ini untuk memastikan ini benar-benar Anda.",
    changePasswordCta: "Ubah kata sandi",
    // Ditampilkan bila /reset-password/ubah dibuka TANPA tautan email yang
    // segar — mis. oleh sesi yang sudah lama masuk di perangkat itu.
    recoveryGrantMissing:
      "Tautan atur ulang sudah kedaluwarsa atau halaman ini dibuka tanpa tautan email. Minta tautan baru, atau ubah kata sandi dari halaman Profil dengan memasukkan kata sandi saat ini.",
    fullName: "Nama lengkap",
    phone: "Nomor WhatsApp",
    phoneHint: "Opsional. Untuk notifikasi & pengingat (mis. 08123456789).",
    // Login
    loginTitle: "Masuk ke Merriva",
    loginSubtitle: "Kelola undangan digital Anda.",
    loginCta: "Masuk",
    // Register
    registerTitle: "Buat akun Merriva",
    registerSubtitle: "Gratis — mulai buat undangan dalam hitungan menit.",
    registerCta: "Daftar",
    // Reset
    resetTitle: "Lupa kata sandi",
    resetSubtitle: "Kami akan mengirim tautan atur ulang ke email Anda.",
    resetCta: "Kirim tautan reset",
    resetSent:
      "Jika email terdaftar, tautan atur ulang kata sandi telah dikirim. Silakan cek kotak masuk (dan folder spam).",
    updatePasswordTitle: "Atur kata sandi baru",
    updatePasswordCta: "Simpan kata sandi",
    // OAuth
    google: "Lanjutkan dengan Google",
    orSeparator: "atau",
    // Links
    toRegister: "Belum punya akun? Daftar",
    toLogin: "Sudah punya akun? Masuk",
    forgotPassword: "Lupa kata sandi?",
    // Chrome layout auth (split-screen)
    backHome: "Kembali ke beranda",
    footerRights: (year: number) => `© ${year} Merriva`,
    footerTerms: "Syarat",
    footerPrivacy: "Privasi",
    // Baris persetujuan (AUDIT-2026-10-01 A2). Keputusan pemilik: NOTIS, bukan
    // checkbox — dasar pemrosesannya perjanjian (bukan persetujuan), jadi
    // centang tak diwajibkan hukum dan hanya menambah friksi di funnel.
    termsNoticeBefore: "Dengan mendaftar, Anda menyetujui",
    termsNoticeAnd: "dan",
    footerHelp: "Bantuan",
    // Messages
    signupSuccess:
      "Akun dibuat. Kami mengirim tautan verifikasi ke email Anda — klik untuk mengaktifkan akun.",
    invalidCredentials: "Email atau kata sandi salah.",
    signOut: "Keluar",
    genericAuthError: "Gagal memproses permintaan. Silakan coba lagi.",
    rateLimited: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
    turnstileFailed:
      "Verifikasi anti-bot gagal. Muat ulang halaman lalu coba lagi.",
    errorOauthLogin: "Gagal masuk dengan Google. Silakan coba lagi.",
    // Dibedakan dari pesan di atas DENGAN SENGAJA: "coba lagi" adalah saran yang
    // keliru untuk salah konfigurasi — berapa kali pun dicoba hasilnya sama, dan
    // pengguna menyalahkan dirinya sendiri atau akun Google-nya.
    errorOauthConfig:
      "Masuk dengan Google sedang tidak tersedia karena konfigurasi server belum lengkap. Tim kami sudah diberi tahu. Sementara ini silakan masuk dengan email dan kata sandi.",
    errorVerifyLink:
      "Tautan tidak valid atau sudah kedaluwarsa. Silakan minta ulang.",
    // Templat email Supabase masih bawaan (DECISIONS #81). Untuk PENDAFTARAN,
    // akunnya sudah aktif — GoTrue mengonfirmasinya satu hop sebelum peramban
    // sampai ke kita — jadi menyuruh "minta tautan ulang" seperti pesan di atas
    // adalah saran yang mustahil dipenuhi: tokennya sudah terpakai.
    errorAccountActive:
      "Akun Anda sudah aktif. Silakan masuk dengan email dan kata sandi Anda.",
    // Untuk RESET KATA SANDI tak ada kabar baik yang bisa disampaikan: tautannya
    // sudah terpakai dan sesinya tak terbentuk. Jangan menyuruh mencoba lagi —
    // selama konfigurasinya belum dibetulkan, hasilnya akan sama persis.
    errorEmailLinkConfig:
      "Tautan email tidak bisa diproses karena konfigurasi server belum lengkap. Tim kami sudah diberi tahu — sementara ini silakan hubungi kami lewat halaman Bantuan.",
  },
  dashboard: {
    greeting: "Halo",
    invitationsTitle: "Undangan Saya",
    emptyTitle: "Belum ada undangan",
    emptyBody:
      "Mulai buat undangan pertama Anda — gratis untuk dibuat & dipreview.",
    createCta: "Buat Undangan",
    profileTitle: "Profil",
    profileSubtitle: "Nama dan nomor WhatsApp untuk notifikasi.",
    profileSaved: "Profil tersimpan.",
    emailReadonlyHint: "Email tidak dapat diubah di sini.",
    navInvitations: "Undangan",
    navProfile: "Profil",
    navOrders: "Pesanan",
    status: {
      draft: "Draf",
      pending_payment: "Menunggu pembayaran",
      active: "Aktif",
      expired: "Kedaluwarsa",
      suspended: "Ditangguhkan",
    },
    builderSoonTitle: "Buat Undangan",
    builderSoon:
      "Pembuat undangan multi-langkah sedang disiapkan dan hadir pada tahap M1 berikutnya.",
    backToList: "Kembali ke daftar undangan",
    cardEdit: "Edit",
    cardActivate: "Aktifkan",
    cardPay: "Lanjutkan pembayaran",
    cardRenew: "Perpanjang",
    cardGuestbook: "Ucapan & amplop",
    // Hapus undangan (self-service, hanya draf/kedaluwarsa — DATA-MODEL §5).
    cardDelete: "Hapus",
    deleteConfirm:
      "Hapus undangan ini secara permanen? Semua data tamu, RSVP, ucapan, dan foto akan dihapus dan tidak bisa dikembalikan.",
    deleting: "Menghapus…",
    deleteError: "Gagal menghapus undangan. Coba lagi.",
    deleteNotAllowed:
      "Undangan yang masih aktif tidak bisa dihapus. Tunggu masa aktif berakhir.",
    // Riwayat pesanan (AUDIT-2026-10-01 A4). Sebelumnya satu-satunya bacaan
    // order dari sisi pelanggan memakai `.limit(1)` pada halaman yang tak bisa
    // dijangkau lagi setelah membayar — perpanjangan & add-on menimbun order
    // lama, dan kode order hanya hidup di satu email sekali kirim.
    // Istilah dikunci: "pesanan" untuk halaman, "Kode order" untuk kodenya —
    // kebijakan refund menyuruh pelanggan menyebut "kode order".
    orders: {
      title: "Pesanan & Kuitansi",
      subtitle:
        "Pembayaran Anda di Merriva, termasuk perpanjangan dan Album Momen.",
      emptyTitle: "Belum ada pesanan",
      emptyBody:
        "Pembayaran pertama Anda akan muncul di sini beserta kode ordernya.",
      emptyCta: "Ke daftar undangan",
      back: "Kembali ke daftar pesanan",
      colOrder: "Kode order",
      colStatus: "Status",
      colPackage: "Paket",
      colKind: "Jenis",
      colDuration: "Masa aktif dibeli",
      colAmount: "Total",
      colCreated: "Dibuat",
      colPaidAt: "Dibayar",
      colMethod: "Metode pembayaran",
      colInvitation: "Undangan",
      colActiveUntil: "Aktif hingga",
      colBuyer: "Atas nama",
      durationMonths: (months: number) => `${months} bulan`,
      dash: "—",
      statusLabel: {
        pending: "Menunggu pembayaran",
        paid: "Lunas",
        expired: "Kedaluwarsa",
        failed: "Gagal",
        refunded: "Dana dikembalikan",
      },
      kindInvitation: "Paket undangan",
      kindAddonMomen: "Add-on Album Momen",
      // Order upgrade: paketnya paket undangan biasa, jadi `packages.kind` saja
      // akan melabelinya "Paket undangan" dan membuatnya tampak membeli masa
      // aktif. Labelnya ditentukan BERSAMA `orders.purpose` (B3).
      kindUpgrade: "Upgrade paket",
      kindUnknown: "Pesanan",
      packageUnknown: "Paket tidak tercatat",
      // HANYA nilai yang benar-benar diketahui. Channel lain diteruskan mentah
      // oleh `formatPaymentMethod` — pada bukti pembayaran, kode vendor lebih
      // jujur daripada label karangan.
      methodLabel: {
        qris: "QRIS",
        manual: "Dicatat manual oleh tim Merriva",
        gratis: "Gratis (akun Admin/Pro)",
      } as Record<string, string>,
      invitationDeleted: "Undangan ini sudah dihapus",
      viewReceipt: "Lihat kuitansi",
      continuePayment: "Lanjutkan pembayaran",
      checkStatus: "Cek status pembayaran",
      manageMomen: "Kelola Album Momen",
      openInvitation: "Buka undangan",
      // Kuitansi sebagai DOKUMEN yang disimpan pelanggan — karena itu penerbit
      // dan alamat kontaknya selalu tercetak, bahkan saat pesanan belum lunas.
      receiptTitle: "Kuitansi",
      receiptMetaTitle: (orderCode: string) => `Kuitansi ${orderCode}`,
      receiptDocTitle: "Kuitansi Pembayaran",
      receiptSubtitle:
        "Simpan halaman ini sebagai bukti pembayaran. Halaman ini tetap bisa Anda buka kapan pun dari menu Pesanan.",
      receiptNumber: "No. kuitansi",
      issuedBy: "Diterbitkan oleh",
      receiptValidityNote:
        "Kuitansi ini diterbitkan otomatis oleh sistem Merriva dan sah tanpa tanda tangan.",
      receiptUnpaidNotice:
        "Pesanan ini belum lunas, jadi dokumen ini belum menjadi bukti pembayaran. Selesaikan pembayaran lebih dulu.",
      print: "Cetak / simpan PDF",
      refundHint:
        "Perlu mengajukan pengembalian dana? Sertakan kode order di atas dan baca",
      refundLink: "Kebijakan Refund",
      attentionUpgradeTitle: "Upgrade sudah dibayar, paket belum naik",
      attentionUpgradeBody:
        "Selisih harga sudah kami terima tetapi paket undangannya belum berubah. Biasanya ini karena masa aktif undangan berakhir saat pembayaran berjalan. Hubungi kami dengan kode order di bawah — kami naikkan manual atau kembalikan dananya.",
      checkUpgradeStatus: "Cek status upgrade",
      attentionTitle: "Pembayaran sudah masuk, undangan belum aktif",
      attentionBody:
        "Satu pesanan Anda sudah lunas tetapi undangannya belum aktif. Biasanya ini selesai sendiri dalam beberapa menit. Bila acara Anda sudah dekat, hubungi kami sekarang dengan kode order di bawah — kami dahulukan.",
      page: (n: number) => `Halaman ${n}`,
      prev: "Sebelumnya",
      next: "Berikutnya",
    },
    // Moderasi ucapan & konfirmasi amplop (SPEC §4.6).
    guestbook: {
      title: "Ucapan & Amplop",
      subtitle: "Tinjau ucapan tamu dan konfirmasi amplop yang masuk.",
      back: "Kembali ke undangan",
      moderationOn:
        "Moderasi aktif — ucapan baru perlu Anda setujui sebelum tampil di halaman undangan.",
      moderationOff:
        "Moderasi nonaktif — ucapan langsung tampil. Anda tetap bisa menyembunyikan yang tidak pantas.",
      stats: {
        responses: "Respons",
        attending: "Hadir",
        notAttending: "Tidak hadir",
        pax: "Total tamu",
        messages: "Ucapan",
      },
      rsvpTitle: "Daftar Ucapan & RSVP",
      rsvpEmpty: "Belum ada RSVP yang masuk.",
      attending: "Hadir",
      notAttending: "Tidak hadir",
      paxUnit: "orang",
      pendingBadge: "Menunggu persetujuan",
      hiddenBadge: "Disembunyikan",
      approve: "Setujui",
      hide: "Sembunyikan",
      unhide: "Tampilkan kembali",
      working: "Menyimpan…",
      actionError: "Gagal menyimpan perubahan. Coba lagi.",
      giftTitle: "Konfirmasi Amplop",
      giftEmpty: "Belum ada konfirmasi amplop.",
      giftTransfer: "Transfer",
      giftGift: "Kado / Hadiah",
      giftPrivate: "Privat — hanya Anda yang melihat daftar ini.",
      // Buku amplop adalah satu-satunya daftar berisi UANG, dan ia ikut
      // terhapus permanen saat retensi berjalan — pemilik harus bisa
      // memindahkannya keluar (AUDIT-2026-10-01, gelombang C).
      giftExportCta: "Unduh Excel",
      giftExporting: "Menyiapkan…",
      giftCol: {
        name: "Nama tamu",
        type: "Jenis",
        amount: "Nominal (Rp)",
        note: "Catatan",
        date: "Waktu",
      },
      noMessage: "(tanpa ucapan)",
    },
    cardGuests: "Tamu",
    // Manajemen tamu (SPEC §4.7).
    guests: {
      title: "Manajemen Tamu",
      subtitle: "Kelola daftar tamu, alokasi kursi, dan link personal.",
      back: "Kembali ke undangan",
      count: "tamu",
      limitOf: "dari",
      // Kartu "unduh data undangan" (DECISIONS #70). Ditaruh di halaman TAMU
      // karena ke sinilah email peringatan pra-purge mengarahkan pemilik —
      // sebelum ini tautannya mendarat di halaman yang tak punya unduhan foto.
      dataTitle: "Unduh data undangan",
      dataBody:
        "Simpan salinan sebelum masa retensi berakhir. Daftar tamu beserta RSVP diunduh dari tabel di atas; foto galeri sebagai satu berkas ZIP.",
      dataFotoCta: (n: number) => `Unduh ${n} foto galeri (ZIP)`,
      // Jujur, dan harus tetap begini: foto dikompres di browser menjadi dua
      // varian WebP sebelum diunggah (SPEC §4.4) — server tidak pernah menerima
      // berkas kamera aslinya, jadi kami tak bisa mengembalikannya.
      dataFotoHint:
        "Yang diunduh adalah versi 1600 piksel yang tampil di undangan — bukan berkas asli dari kamera Anda, karena foto dikompres di perangkat Anda sebelum diunggah dan aslinya tak pernah sampai ke kami. Simpan aslinya sendiri.",
      dataFotoKosong: "Belum ada foto galeri yang diunggah.",
      unlimited: "tanpa batas",
      limitReached:
        // "Tingkatkan paket" dulu adalah instruksi tanpa tombol: tak ada satu
        // pun jalur upgrade di produk ini (AUDIT-2026-10-01 B3). Sejak jalurnya
        // ada, kalimat ini jujur — tombolnya di kartu undangan dashboard untuk
        // undangan aktif, dan di pemilih paket untuk yang belum.
        "Kuota tamu paket sudah penuh. Naikkan paket undangan ini untuk menambah tamu.",
      addTitle: "Tambah Tamu",
      addCta: "Tambah",
      adding: "Menambah…",
      name: "Nama",
      namePlaceholder: "Nama tamu",
      phone: "No. WhatsApp",
      phonePlaceholder: "08123456789 (opsional)",
      group: "Label / grup",
      groupPlaceholder: "Keluarga, Kantor, … (opsional)",
      pax: "Alokasi kursi",
      notes: "Catatan",
      notesPlaceholder: "Catatan internal (opsional)",
      empty: "Belum ada tamu. Tambahkan tamu pertama Anda.",
      paxUnit: "kursi",
      edit: "Ubah",
      save: "Simpan",
      saving: "Menyimpan…",
      cancel: "Batal",
      remove: "Hapus",
      removing: "Menghapus…",
      confirmRemove: "Hapus tamu ini? Tindakan ini tidak dapat dibatalkan.",
      copyLink: "Salin link",
      copied: "Tersalin",
      opened: "Sudah dibuka",
      waSent: "WA terkirim",
      actionError: "Gagal menyimpan. Coba lagi.",
    },
    // Impor / ekspor tamu (SPEC §4.7).
    guestsImport: {
      // Pesan parser (dipakai lib/guest-import.ts)
      emptyFile: "Berkas kosong atau tak terbaca.",
      missingNameColumn:
        "Kolom 'Nama' tidak ditemukan. Unduh template untuk format yang benar.",
      invalidRow: "Baris tidak valid.",
      // UI impor
      importTitle: "Impor Tamu",
      importHint:
        "Unggah file Excel (.xlsx) atau CSV. Wajib ada kolom Nama; kolom lain opsional.",
      chooseFile: "Pilih berkas (.xlsx / .csv)",
      template: "Unduh template",
      parsing: "Membaca berkas…",
      previewValid: "siap diimpor",
      previewInvalid: "baris bermasalah",
      previewRow: "Baris",
      confirmImport: "Impor",
      importing: "Mengimpor…",
      cancel: "Batal",
      resultInserted: "tamu berhasil ditambahkan.",
      resultSkippedLimit: "dilewati karena kuota paket penuh.",
      resultNothing: "Tidak ada tamu yang ditambahkan.",
      parseError:
        "Gagal membaca berkas. Pastikan format .xlsx atau .csv yang benar.",
      // UI ekspor
      exportCta: "Ekspor ke Excel",
      exporting: "Menyiapkan…",
      exportEmpty: "Belum ada tamu untuk diekspor.",
      // Header kolom ekspor
      col: {
        name: "Nama",
        phone: "No. WhatsApp",
        group: "Label",
        pax: "Alokasi Kursi",
        link: "Link Personal",
        opened: "Sudah Dibuka",
        rsvp: "Kehadiran",
        rsvpPax: "Jumlah Hadir",
        message: "Ucapan",
      },
      rsvpYes: "Hadir",
      rsvpNo: "Tidak hadir",
      rsvpNone: "Belum RSVP",
      yes: "Ya",
      no: "Tidak",
    },
    cardShare: "Sebar",
    cardMomen: "Album Momen",
    cardUpgrade: "Upgrade paket",
    // Sebar Undangan (SPEC §4.7).
    // Sebar Undangan (SPEC §4.7, DECISIONS #120). Template bawaan memuat tanggal
    // dan kalimat "tanpa aplikasi": penipuan undangan pernikahan di Indonesia
    // hampir selalu berupa berkas APK. Sengaja TIDAK memuat "mohon maaf hanya
    // mengundang lewat pesan" — persis kalimat pancingan Tria Stealer
    // (Kaspersky, Feb 2025). Jangan pula menjanjikan "tanpa mengunduh berkas":
    // tombol Simpan Kalender mengunduh .ics.
    sebar: {
      title: "Sebar Undangan",
      subtitle: "Kirim link personal ke tiap tamu lewat WhatsApp.",
      back: "Kembali ke undangan",
      templateLabel: "Pesan personal",
      templateHint:
        "Gunakan {nama}, {link}, {acara}, dan {tanggal} — otomatis terisi untuk tiap tamu.",
      templateGeneralLabel: "Pesan umum (tanpa nama tamu)",
      templateGeneralHint:
        "{nama} diisi nama yang Anda ketik di kartu Undangan umum, atau “Bapak/Ibu/Saudara/i”.",
      saveTemplate: "Simpan template",
      savingTemplate: "Menyimpan…",
      savedTemplate: "Template tersimpan",
      resetTemplate: "Kembalikan ke bawaan",
      unsavedTemplate: "Perubahan template belum disimpan",
      templateTooLong: "Template terlalu panjang (maks 2.000 karakter).",
      templateNeedsLink: "Template wajib memuat {link}.",
      templateNeedsLinkPersonal: "Pesan personal wajib memuat {link}.",
      templateNeedsLinkGeneral: "Pesan umum wajib memuat {link}.",
      saveFirst: "Simpan template dulu sebelum mengirim.",
      markFailed: (nama: string) =>
        `Tanda untuk ${nama} gagal disimpan — coba lagi.`,
      markUncertain: (nama: string) =>
        `Tanda untuk ${nama} mungkin belum tersimpan — muat ulang halaman untuk memastikan.`,
      unmarkFailed: (nama: string) =>
        `Pembatalan tanda ${nama} gagal — ${nama} tetap tercatat terkirim.`,
      unmarkUncertain: (nama: string) =>
        `Pembatalan tanda ${nama} mungkin belum tersimpan — muat ulang halaman untuk memastikan.`,
      dateFallback: "hari bahagia kami",
      generalNameFallback: "Bapak/Ibu/Saudara/i",
      // Kartu "merriva.id" (judul = domain, tanpa gambar) adalah kartu
      // SEMENTARA WhatsApp; menekan Kirim saat ia tampil mengirimnya apa
      // adanya (DECISIONS #122). Pemilik mengira itu pratinjaunya.
      previewTip:
        "Di WhatsApp, tunggu sampai kartu pratinjau bergambar muncul di atas kolom ketik, baru tekan Kirim — kartu yang hanya bertuliskan “merriva.id” berarti belum siap dan akan terkirim tanpa gambar. Kartu tak pernah muncul? Pastikan Setelan › Privasi › Lanjutan › “Nonaktifkan pratinjau tautan” dalam keadaan mati.",
      // ±10 detik = patokan resmi Meta; batas tunggu internal Desktop/Web 7
      // detik, sesudahnya kartu "merriva.id" menjadi hasil AKHIR (#122).
      previewDesktopTip:
        "Di WhatsApp komputer (Desktop/Web), kartu bergambar bisa butuh hingga ±10 detik — biarkan WhatsApp di HP tetap tersambung internet. Masih “merriva.id” sesudahnya? Kartu itu tak akan berubah: jangan kirim — hapus pesan di kolom ketik, lalu kirim ulang dari halaman ini.",
      etiquetteTip:
        "Kirim satu per satu ke kontak yang Anda kenal — WhatsApp dapat memblokir akun yang mengirim pesan massal.",
      desktopTip:
        "Di komputer, setiap kiriman membuka tab WhatsApp baru — menyebar ke banyak tamu lebih nyaman dari HP.",
      testWarning:
        "Jangan membuka link tamu sungguhan untuk menguji — tamu itu akan tercatat “Dibuka”.",
      generalTitle: "Undangan umum",
      generalDesc:
        "Untuk tamu yang belum ada di daftar. Linknya tanpa token dan tidak terlacak per tamu — tambahkan tamu ke daftar bila ingin terlacak.",
      generalNameLabel: "Nama tamu (opsional)",
      generalNamePlaceholder: "mis. Bu Siti sekeluarga",
      generalRsvpNote: (max: number) =>
        `Tamu mengetik namanya sendiri saat konfirmasi kehadiran (maks ${max} orang).`,
      sendGeneral: "Kirim via WhatsApp",
      copyGeneral: "Salin pesan umum",
      // Kode WhatsApp Web: satu kontak → pesan masuk kolom ketik (kartu dibuat
      // seperti biasa); beberapa kontak → langsung terkirim tanpa kartu (#122).
      generalOneContact:
        "Di daftar kontak WhatsApp, pilih satu kontak per kiriman — di WhatsApp Desktop/Web, memilih beberapa kontak sekaligus mengirim pesan tanpa kartu pratinjau.",
      guestListTitle: "Daftar Tamu",
      empty: "Belum ada tamu. Tambahkan tamu lewat menu Tamu terlebih dahulu.",
      // "satu": tanpa nomor = pemilih kontak; beberapa kontak sekaligus di
      // Desktop/Web terkirim tanpa kartu pratinjau (#122).
      noPhone: "Tanpa nomor — pilih satu kontak di WhatsApp",
      waSend: "Kirim via WA",
      copyMsg: "Salin pesan",
      copied: "Tersalin",
      copyAll: "Salin pesan di daftar ini",
      copiedAll: "Pesan di daftar ini tersalin",
      sent: "Terkirim",
      undo: "Batalkan",
      undoLabel: (nama: string) => `Tandai ${nama} belum dikirim`,
      countUnit: "tamu",
      progress: (sent: number, total: number, opened: number, rsvp: number) =>
        `Terkirim ${sent}/${total} · Dibuka ${opened} · RSVP ${rsvp}`,
      searchPlaceholder: "Cari nama tamu…",
      noMatch: "Tidak ada tamu di filter ini.",
      filter: {
        unsent: "Belum dikirim",
        sent: "Terkirim",
        opened: "Dibuka",
        rsvp: "Sudah RSVP",
        all: "Semua",
      },
      status: {
        unsent: "Belum dikirim",
        sent: "Terkirim",
        opened: "Dibuka",
        attending: "Hadir",
        notAttending: "Tidak hadir",
      },
      seq: {
        start: "Kirim satu per satu",
        title: "Kirim satu per satu",
        counter: (i: number, n: number) => `Tamu ${i} dari ${n}`,
        send: "Kirim via WhatsApp",
        noPhoneHint:
          "Tamu ini tanpa nomor — pilih kontaknya di WhatsApp (satu kontak saja).",
        // Dialog menutupi daftar tips; petunjuk kartu — termasuk jalan keluar
        // bila kartu "merriva.id" menjadi hasil akhir — harus terbaca di sini,
        // tepat sebelum pemilik pindah ke WhatsApp (#122). Menyebut tombol
        // `no` ("Belum, kirim ulang") apa adanya; test menjaga keduanya sama.
        previewHint:
          "Di WhatsApp, tekan Kirim setelah kartu bergambar muncul. Tetap “merriva.id” lewat ±10 detik? Jangan kirim — hapus pesan di kolom ketik, kembali ke sini, lalu pilih “Belum, kirim ulang”.",
        waitHint: "Setelah mengirim di WhatsApp, kembali ke halaman ini.",
        confirm: (nama: string) => `Sudah terkirim ke ${nama}?`,
        yes: "Ya, lanjut",
        no: "Belum, kirim ulang",
        skip: "Lewati",
        exit: "Selesai",
        done: "Antrean selesai.",
        empty: "Tidak ada tamu yang belum dikirimi.",
        showMessage: "Lihat pesan",
      },
      defaultTemplate:
        "Kepada Yth. {nama},\n\nDengan penuh sukacita, kami mengundang Anda untuk hadir di {acara} pada {tanggal}. Doa serta kehadiran Anda sangat berarti bagi kami.\n\nInformasi lengkap & konfirmasi kehadiran dapat diakses melalui tautan berikut:\n{link}\n\nUndangan ini berupa halaman web di merriva.id — cukup ketuk tautannya, tidak perlu memasang aplikasi apa pun.\n\nMerupakan suatu kehormatan bila Anda berkenan hadir. Terima kasih 🙏",
      defaultTemplateGeneral:
        "Kepada Yth.\n{nama}\ndi tempat\n\nDengan penuh sukacita, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di {acara} pada {tanggal}.\n\nInformasi lengkap acara & konfirmasi kehadiran:\n{link}\n\nUndangan ini berupa halaman web di merriva.id — cukup ketuk tautannya, tidak perlu memasang aplikasi apa pun. Mohon tuliskan nama Bapak/Ibu/Saudara/i saat mengisi konfirmasi kehadiran.\n\nMerupakan suatu kehormatan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu. Terima kasih 🙏",
    },
  },
  // Checkout / aktivasi paket (SPEC §4.8).
  checkout: {
    title: "Aktifkan Undangan",
    subtitle:
      "Pilih paket untuk mengaktifkan & menyebarkan undangan. Bayar dengan QRIS dari e-wallet atau m-banking apa pun.",
    back: "Kembali ke dashboard",
    popular: "Terpopuler",
    choose: "Pilih paket ini",
    redirecting: "Mengalihkan ke pembayaran…",
    // Akun Admin/Pro tak pernah ditagih (DECISIONS #100).
    freeSubtitle:
      "Akun Anda (Admin/Pro) tidak perlu membayar — undangan langsung aktif dengan paket teratas.",
    freePrice: "Gratis",
    freeCta: "Aktifkan gratis",
    freeActivating: "Mengaktifkan…",
    // Ditampilkan tepat di atas tombol bayar — titik tempat uang berpindah.
    termsNoticeBefore: "Dengan melanjutkan pembayaran, Anda menyetujui",
    termsNoticeAnd: "dan",
    securedBy: "Pembayaran QRIS diproses oleh BinderPay.",
    perDuration: (months: number) => `Masa aktif ${months} bulan`,
    notPayable: "Undangan ini tidak dapat dibayar saat ini.",
    // Pembeli tak bisa memperbaiki ini sendiri, jadi pesannya tak menyuruh
    // mencoba lagi — ia memberi jalan keluar yang benar-benar menolong.
    merchantMissing:
      "Pembayaran sedang tidak tersedia. Tim kami sedang menyelesaikan penyiapan. Hubungi halo@merriva.id bila acara Anda sudah dekat.",
    packageUnavailable: "Paket tidak tersedia. Silakan coba lagi.",
    // Tema bertier premium wajib paket Premium saat dibayar (DECISIONS #116).
    premiumThemeRequired:
      "Tema undangan ini khusus paket Premium. Pilih Premium untuk mengaktifkannya.",
    premiumThemeNote:
      "Tema yang Anda pilih termasuk tema premium, jadi hanya bisa diaktifkan dengan paket Premium.",
    premiumThemeOnly: "Khusus tema standar",
    // Sejak Pakasir v2, penerbitan tautan adalah panggilan jaringan yang bisa
    // gagal (mis. plafon 2 permintaan/detik). Pesannya menenangkan dengan
    // fakta yang benar: order-nya SUDAH tersimpan, dan percobaan ulang memakai
    // order yang sama karena `find-or-create` Pakasir berkunci `order_id`.
    linkFailed:
      "Gagal membuat tautan pembayaran. Coba lagi sebentar lagi — Anda belum ditagih apa pun.",
    // Add-on Album Momen (dibeli untuk undangan yang sudah aktif).
    momenNeedsActive:
      "Album Momen hanya bisa diaktifkan untuk undangan yang sudah aktif.",
    momenAlreadyOwned:
      "Undangan ini sudah punya Album Momen aktif. Upgrade tier belum tersedia.",
    momenPackageUnavailable:
      "Paket Album Momen tidak tersedia. Silakan coba lagi.",
    momenOrderPending:
      "Masih ada pembayaran Album Momen yang belum selesai. Tunggu sampai terverifikasi — album akan aktif sendiri.",
    // Syarat sebelum bayar (SPEC §4.8 langkah 0, DECISIONS #44). Halaman
    // aktivasi menampilkan SEMUA syarat yang belum terpenuhi sekaligus, masing-
    // masing dengan tombol ke tempat memperbaikinya.
    readinessTitle: "Lengkapi dulu sebelum membayar",
    readinessIntro:
      "Selesaikan hal berikut di editor. Setelah itu, kembali ke halaman ini untuk memilih paket.",
    readiness: {
      // Alamat terkunci setelah aktif → wajib diatur SEBELUM bayar agar halaman
      // publik tak 404 permanen.
      slug: {
        title: "Alamat undangan belum diatur",
        body: "Alamat (link) tidak bisa diubah setelah undangan aktif, jadi atur dulu sebelum membayar.",
        cta: "Atur alamat di editor",
      },
      // Sesi tanpa jam mulai tak pernah tampil ke tamu (#42).
      schedule: {
        title: "Belum ada sesi jadwal yang lengkap",
        body: "Tanpa tanggal & jam mulai, tamu tidak tahu kapan acaranya. Isi minimal satu sesi.",
        cta: "Lengkapi jadwal",
      },
    },
    // Penahan server bila halaman aktivasi dilewati.
    setSlugFirst:
      "Atur alamat undangan (link) di editor dulu sebelum membayar — alamat terkunci setelah aktif.",
    scheduleFirst:
      "Isi tanggal & jam mulai minimal satu sesi jadwal di editor dulu sebelum membayar — tanpa itu tamu tak tahu kapan acaranya.",
    // Sesi berisi yang belum berjam: TIDAK menghalangi bayar, tetapi tak tampil
    // ke tamu — disebut di halaman aktivasi agar pemilik tak kaget.
    unscheduledNote: (names: readonly string[]) =>
      `Belum tampil ke tamu karena tanggal & jam mulainya belum lengkap: ${names.join(", ")}.`,
    unscheduledCta: "Lengkapi jadwal",
    error: "Gagal memulai pembayaran. Silakan coba lagi.",
    // Fitur paket (dari packages.limits) untuk daftar centang.
    feat: {
      photos: (n: number) => `Galeri hingga ${n} foto`,
      guestsLimited: (n: number) => `Hingga ${n} tamu`,
      guestsUnlimited: "Tamu tanpa batas",
      youtube: "Video: unggah klip atau tautan YouTube",
      allThemes: "Semua tema (termasuk premium)",
      standardThemes: "Tema kategori standar",
      noWatermark: "Tanpa watermark Merriva",
      watermark: "Watermark kecil di footer",
      rsvp: "RSVP + ucapan & amplop digital",
    },
  },
  // Upgrade paket di tengah masa aktif — bayar SELISIH (AUDIT-2026-10-01 B3,
  // SPEC §4.8). Semua teks di sini punya satu kewajiban yang sama: pelanggan
  // harus paham SEBELUM membayar bahwa yang dibeli adalah peningkatan untuk
  // SISA masa aktif yang sedang berjalan — bukan periode baru.
  upgrade: {
    title: "Upgrade Paket",
    subtitle:
      "Naik ke paket yang lebih lengkap untuk sisa masa aktif undangan Anda. Anda hanya membayar selisih harganya.",
    back: "Kembali ke dashboard",
    currentLabel: "Paket sekarang",
    payLabel: "Yang Anda bayar",
    payHint: "Selisih harga",
    activeUntilLabel: "Masa aktif berakhir",
    daysLeft: (n: number) => (n === 0 ? "berakhir hari ini" : `sisa ${n} hari`),
    // Kalimat terpenting di halaman ini. Paket Premium biasanya datang dengan
    // masa aktif lebih panjang daripada Basic; upgrade TIDAK membawa tambahan
    // itu, dan pelanggan harus tahu sebelum menekan tombol — bukan sesudah.
    periodNotice:
      "Upgrade menaikkan paket untuk SISA masa aktif yang sedang berjalan. Masa aktif tidak diperpanjang dan tanggal berakhirnya tidak berubah.",
    gainsTitle: "Yang Anda dapat setelah upgrade",
    cta: "Bayar selisih & upgrade",
    redirecting: "Mengalihkan ke pembayaran…",
    // Akun Admin/Pro tak pernah ditagih (DECISIONS #100).
    freeSubtitle:
      "Akun Anda (Admin/Pro) tidak perlu membayar — paket langsung naik untuk sisa masa aktif.",
    freeCta: "Upgrade gratis",
    error: "Gagal memulai pembayaran upgrade. Silakan coba lagi.",
    // Gerbang: undangan belum/tidak bisa di-upgrade.
    needActiveTitle: "Upgrade hanya untuk undangan aktif",
    needActiveBody:
      "Paket hanya bisa dinaikkan selama masa aktif berjalan. Untuk undangan yang belum aktif atau sudah kedaluwarsa, pilih paket yang Anda inginkan saat aktivasi atau perpanjangan — harganya penuh, tetapi masa aktifnya baru.",
    noPackageTitle: "Paket undangan ini tidak tercatat",
    noPackageBody:
      "Tidak ada harga paket yang bisa dijadikan pengurang, jadi selisihnya tak bisa dihitung. Hubungi kami dan kami bantu pindahkan paketnya manual.",
    topTierTitle: "Sudah di paket tertinggi",
    topTierBody:
      "Undangan ini sudah memakai paket paling lengkap yang tersedia. Tidak ada yang perlu di-upgrade.",
    // Penahan server (halaman dilewati / sudah basi).
    notUpgradable:
      "Paket undangan ini tidak bisa dinaikkan saat ini. Upgrade hanya untuk undangan yang masa aktifnya sedang berjalan.",
    noCurrentPackage:
      "Paket undangan ini tidak tercatat, jadi selisih harganya tak bisa dihitung. Hubungi kami untuk pindah paket manual.",
    packageUnavailable: "Paket tujuan tidak tersedia. Silakan coba lagi.",
    noDifference:
      "Paket itu tidak lebih tinggi dari paket Anda sekarang, jadi tidak ada selisih yang perlu dibayar.",
    orderPending:
      "Masih ada pembayaran upgrade yang belum selesai. Tunggu sampai terverifikasi — paketnya akan naik sendiri.",
    // Poller status pembayaran upgrade (jalur aktivasi otoritatif kedua).
    payment: {
      pendingTitle: "Menunggu konfirmasi pembayaran",
      pendingBody: (orderCode: string) =>
        `Order ${orderCode} sedang kami tunggu konfirmasi pembayarannya. Paket akan naik otomatis begitu pembayaran terverifikasi — halaman ini memperbarui sendiri.`,
      pendingHint:
        "Sudah bayar tetapi belum berubah? Biarkan halaman ini terbuka beberapa saat. Anda juga bisa menutupnya — pembayaran tetap diproses di latar.",
      activeTitle: "Paket Anda sudah naik",
      activeBody:
        "Pembayaran terverifikasi dan paket undangan sudah diperbarui. Masa aktifnya tidak berubah.",
      reviewTitle: "Pembayaran diterima — paket belum berubah",
      reviewBody:
        "Pembayaran Anda tercatat, tetapi paketnya belum bisa dinaikkan (biasanya karena masa aktif undangan berakhir saat pembayaran berjalan). Hubungi kami dengan kode order di bawah — kami selesaikan manual atau kembalikan dananya.",
      expiredTitle: "Sesi pembayaran kedaluwarsa",
      expiredBody:
        "Pembayaran upgrade tidak selesai dalam batas waktu. Anda bisa memulainya lagi.",
      errorTitle: "Status pembayaran tidak bisa dipastikan",
      errorBody:
        "Kami belum bisa memastikan status pembayaran upgrade ini. Coba lagi sebentar; bila Anda yakin sudah membayar, hubungi kami dengan kode order.",
      timeoutTitle: "Masih menunggu konfirmasi",
      timeoutBody:
        "Konfirmasi pembayaran belum sampai. Pembayaran tetap diproses di latar — cek lagi nanti, atau hubungi kami bila acara Anda sudah dekat.",
      chooseAgain: "Pilih paket lagi",
      checkNow: "Cek sekarang",
      checking: "Memeriksa…",
      retry: "Coba lagi",
      viewInvitation: "Lihat undangan",
      back: "Ke dashboard",
      package: "Paket tujuan",
      amount: "Selisih dibayar",
      order: "Kode order",
    },
  },
  // Halaman cek status pembayaran (M3.3) — poll status transaksi OTORITATIF.
  paymentStatus: {
    title: "Status Pembayaran",
    order: "Kode order",
    package: "Paket",
    amount: "Total",
    checkNow: "Cek sekarang",
    checking: "Memeriksa…",
    waitingTitle: "Menunggu konfirmasi pembayaran",
    waitingBody:
      "Setelah pembayaran selesai, undangan aktif otomatis — biasanya hanya beberapa detik. Halaman ini memperbarui sendiri.",
    successTitle: "Pembayaran berhasil!",
    successBody: "Undangan Anda kini aktif dan siap disebar.",
    viewInvitation: "Lihat undangan",
    shareInvitation: "Sebar undangan",
    toDashboard: "Ke dashboard",
    expiredTitle: "Sesi pembayaran kedaluwarsa",
    expiredBody:
      "Pembayaran tidak selesai dalam batas waktu. Silakan mulai lagi untuk mengaktifkan undangan.",
    activateAgain: "Aktifkan lagi",
    reviewTitle: "Pembayaran diterima — undangan sedang ditinjau",
    // "Hubungi kami bila butuh bantuan." dibuang: kalimat itu menyuruh tanpa
    // memberi alamat, tepat di layar yang muncul saat uang sudah keluar
    // (AUDIT-2026-10-01 A5). Alamatnya kini dirender `SupportContact`.
    reviewBody:
      "Terima kasih. Pembayaran Anda sudah kami terima dan undangan sedang ditinjau — biasanya selesai dalam 1x24 jam. Bila acara Anda sudah dekat, hubungi kami dengan kode order di bawah agar kami dahulukan.",
    noneTitle: "Belum ada pembayaran",
    noneBody: "Belum ada order pembayaran untuk undangan ini.",
    errorTitle: "Tidak dapat memeriksa status",
    errorBody: "Terjadi kendala saat memeriksa pembayaran. Coba lagi sebentar.",
    timeoutTitle: "Masih menunggu konfirmasi",
    timeoutBody:
      "Konfirmasi belum diterima. Bila Anda sudah membayar, undangan akan aktif otomatis begitu terkonfirmasi — Anda bisa cek lagi atau tutup halaman ini.",
    retry: "Coba lagi",
    back: "Kembali ke dashboard",
    // QRIS yang dirender di halaman KITA (BinderPay tak punya halaman bayar
    // hosted — DECISIONS #99). Dipakai ketiga poller: undangan, upgrade, Album
    // Momen.
    qris: {
      title: "Pindai QRIS untuk membayar",
      body: "Buka aplikasi e-wallet atau m-banking apa pun yang mendukung QRIS, lalu pindai kode ini.",
      // Mayoritas pelanggan membuka dashboard dari HP — QR di layar HP yang
      // sama tak bisa dipindai olehnya. Tangkapan layar disebut eksplisit:
      // tombol unduh di iPhone masuk ke Files, bukan Foto, dan di browser
      // dalam-aplikasi sering tak berfungsi — hanya tangkapan layar yang pasti.
      mobileHint:
        "Membayar dari HP ini? Ambil tangkapan layar (atau simpan gambar QR-nya), lalu pilih pindai dari galeri di aplikasi pembayaran Anda.",
      save: "Simpan gambar QR",
      alt: "Kode QRIS pembayaran",
      validUntil: (waktu: string) => `Berlaku sampai ${waktu}`,
    },
  },
  create: {
    title: "Buat Undangan Baru",
    subtitle: "Pilih jenis acara dan tema. Undangan gratis dibuat & dipreview.",
    chooseCategory: "1. Pilih jenis acara",
    chooseTheme: "2. Pilih tema",
    category: {
      wedding: "Pernikahan",
      corporate: "Corporate",
      family: "Keluarga",
    },
    categoryDesc: {
      wedding: "Akad & resepsi, mempelai, love story.",
      corporate: "Gathering, seminar, rundown acara.",
      family: "Khitanan, ulang tahun, syukuran.",
    },
    noThemeForCategory:
      "Tema untuk kategori ini segera hadir. Coba kategori lain.",
    themeUnavailable: "Tema tidak tersedia untuk kategori ini.",
    submit: "Buat & Lanjut Isi",
    creating: "Membuat…",
    previewBtn: "Preview",
    useTheme: "Gunakan Tema",
    chosen: "Dipilih",
    selectThemeAria: (name: string) => `Pilih tema ${name}`,
    tier: { standard: "Standar", premium: "Premium" },
  },
  editor: {
    title: "Edit Undangan",
    address: "Alamat undangan",
    category: "Jenis acara",
    backToDashboard: "Kembali ke dashboard",
    notFound: "Undangan tidak ditemukan.",
    slug: {
      label: "Alamat undangan",
      prefix: "merriva.id/",
      placeholder: "rina-dan-bima",
      hint: "Huruf kecil, angka, dan tanda hubung. 3–60 karakter.",
      checking: "Memeriksa ketersediaan…",
      available: "Tersedia — alamat ini bisa dipakai.",
      taken: "Alamat ini sudah dipakai. Coba yang lain.",
      save: "Simpan alamat",
      saving: "Menyimpan…",
      saved: "Alamat tersimpan.",
      notDraft: "Alamat tidak dapat diubah setelah undangan aktif.",
      unset: "Belum diatur — alamat masih sementara.",
      current: "Alamat saat ini:",
      suggestion: "Pakai:",
      error: "Gagal memeriksa ketersediaan.",
      retry: "Coba lagi",
    },
    steps: {
      info: "Info dasar",
      couple: "Mempelai",
      schedule: "Jadwal",
      gallery: "Galeri",
      story: "Cerita",
      envelope: "Amplop",
      settings: "Pengaturan",
      // Corporate & family
      detail: "Detail acara",
      agenda: "Agenda",
      wishes: "Doa & Harapan",
    },
    music: {
      label: "Musik latar",
      none: "Tanpa musik",
      hint: "Diputar otomatis saat tamu membuka undangan (bisa dimatikan tamu).",
      empty:
        "Pustaka lagu belum tersedia. Admin dapat menambah lagu di panel admin.",
    },
    fields: {
      title: "Judul undangan",
      titlePlaceholder: "The Wedding of …",
      groomNickname: "Panggilan mempelai pria",
      brideNickname: "Panggilan mempelai wanita",
      eventDate: "Tanggal acara utama",
      groomTitle: "Mempelai Pria",
      brideTitle: "Mempelai Wanita",
      fullName: "Nama lengkap",
      fatherName: "Nama ayah",
      motherName: "Nama ibu",
      childOrder: "Urutan anak",
      childOrderPlaceholder: "Putra pertama dari …",
      storyTitle: "Judul",
      storyDate: "Tanggal",
      storyDatePlaceholder: "Maret 2020",
      storyNarrative: "Narasi",
      envelopeEnabled: "Aktifkan amplop digital",
      bank: "Bank",
      accountNumber: "Nomor rekening",
      accountHolder: "Atas nama",
      ewalletProvider: "E-wallet (GoPay/OVO/Dana)",
      ewalletNumber: "Nomor",
      giftAddress: "Alamat kirim kado (opsional)",
      timezone: "Zona waktu acara",
      moderateGuestbook: "Moderasi ucapan (perlu disetujui dulu)",
      sectionLegend: "Tampilkan bagian",
      greetingOpen: "Sapaan pembuka",
      greetingClose: "Sapaan penutup",
      youtubeUrl: "Tautan YouTube (Premium)",
      livestreamUrl: "Tautan live streaming (Premium)",
      // Corporate
      eventName: "Nama acara",
      eventNamePlaceholder: "Annual Summit 2026",
      organizer: "Penyelenggara",
      organizerPlaceholder: "PT Merriva Indonesia",
      description: "Deskripsi acara",
      descriptionPlaceholder: "Ceritakan tujuan & gambaran acara…",
      picTitle: "Narahubung (PIC)",
      picName: "Nama PIC",
      picPhone: "No. WhatsApp PIC",
      picEmail: "Email PIC",
      // Family
      celebrant: "Nama yang merayakan",
      celebrantPlaceholder: "Nama anak / yang berulang tahun",
      parents: "Orang tua / keluarga",
      parentsPlaceholder: "Bapak & Ibu … (opsional)",
    },
    list: {
      addStory: "Tambah cerita",
      addBank: "Tambah rekening",
      addEwallet: "Tambah e-wallet",
      remove: "Hapus",
      storyItem: "Cerita",
      bankSection: "Rekening bank",
      ewalletSection: "E-wallet",
      bankEmpty: "Belum ada rekening.",
      ewalletEmpty: "Belum ada e-wallet.",
      storyEmpty: "Belum ada cerita.",
      // Tombol "Tambah" dinonaktifkan saat daftar penuh — alasannya WAJIB
      // terlihat (tombol mati tanpa penjelasan terasa seperti form rusak).
      full: (n: number) =>
        `Maksimal ${n.toLocaleString("id-ID")} entri. Hapus salah satu untuk menambah yang baru.`,
    },
    sections: {
      countdown: "Hitung mundur",
      gallery: "Galeri foto",
      story: "Cerita / love story",
      envelope: "Amplop digital",
    },
    // Label linimasa per kategori (dipakai TimelineStep + label section "story"
    // di Pengaturan). Section KEY tetap "story" untuk semua kategori (tema
    // menggerbangi linimasa via isSectionVisible(settings,"story")); hanya
    // label yang berbeda.
    timeline: {
      wedding: {
        add: "Tambah cerita",
        item: "Cerita",
        empty: "Belum ada cerita.",
        title: "Judul",
        date: "Tanggal",
        datePlaceholder: "Maret 2020",
        narrative: "Narasi",
        section: "Cerita / love story",
      },
      corporate: {
        add: "Tambah agenda",
        item: "Agenda",
        empty: "Belum ada agenda / rundown.",
        title: "Nama sesi / agenda",
        date: "Waktu",
        datePlaceholder: "09.00–10.00 WIB",
        narrative: "Deskripsi",
        section: "Agenda / rundown",
      },
      family: {
        add: "Tambah doa / harapan",
        item: "Doa / Harapan",
        empty: "Belum ada doa & harapan.",
        title: "Judul",
        date: "Tanggal (opsional)",
        datePlaceholder: "",
        narrative: "Isi",
        section: "Doa & harapan",
      },
    },
    gallery: {
      add: "Tambah foto",
      addHint:
        "JPG, PNG, atau WebP dari galeri/kamera. Otomatis dikompres di perangkat.",
      empty: "Belum ada foto. Tambahkan momen terbaik kalian.",
      photosLabel: "foto",
      remove: "Hapus foto",
      working: "Menyiapkan & mengunggah…",
      limitReached:
        "Jumlah foto sudah mencapai batas paket. Naikkan paket undangan ini untuk menambah foto.",
      // Foto di atas batas paket (turun paket / alih kepemilikan, DECISIONS
      // #116): tetap tersimpan, tetapi undangan hanya menampilkan N pertama.
      overLimit: (max: number) =>
        `Undangan hanya menampilkan ${max} foto pertama sesuai paket. Foto lainnya tetap tersimpan — hapus yang tak perlu atau naikkan paket untuk menampilkannya.`,
      invalidFile: "Berkas harus berupa gambar (JPG, PNG, atau WebP).",
      tooLarge: "Foto terlalu besar setelah dikompres. Coba foto lain.",
      error: "Gagal mengunggah foto. Coba lagi.",
      // Pengganti pengunggah di tema tanpa section galeri (sakinah): tanpa
      // penjelasan, langkah "Galeri" yang tak berisi galeri terasa rusak.
      notInTheme: "Tema ini tidak menampilkan galeri foto.",
    },
    // Foto bernama (SPEC §4.4 langkah 2): satu per jenis, di luar batas foto
    // paket — batas itu tentang galeri.
    photo: {
      add: "Unggah foto",
      replace: "Ganti",
      remove: "Hapus",
      working: "Mengunggah…",
      hint: "JPG, PNG, atau WebP. Otomatis dikompres di perangkat.",
      preview: "Pratinjau foto",
      coverLabel: "Foto untuk pratinjau tautan",
      // Menyebut PERSIS di mana fotonya muncul, karena ia TIDAK muncul di
      // halaman undangan. Label lama "Foto sampul" membuat pemilik mencarinya
      // di layar pembuka dan tak menemukannya. Bingkai penyesuaiannya memakai
      // rasio kanvas OG, jadi yang dibingkai di sini = yang dikirim WhatsApp.
      coverHint:
        "Tampil saat tautan undangan dibagikan di WhatsApp — bukan di halaman undangannya.",
      // Tema yang JUGA merender sampul di halamannya (slot `cover` di
      // `media.slots`, mis. halaman muka koran `warta`).
      coverLabelInTheme: "Foto sampul",
      coverHintInTheme:
        "Tampil di halaman pembuka undangan, juga saat tautan undangan dibagikan di WhatsApp.",
      groomLabel: "Foto mempelai pria",
      brideLabel: "Foto mempelai wanita",
      personHint: "Bila kosong, undangan menampilkan monogram inisial.",
      logoLabel: "Logo perusahaan",
      // Jujur: datanya tersimpan, tetapi belum ada satu pun tema yang
      // merendernya. Menjanjikan lebih dari itu akan membuat pemilik mengunggah
      // lalu mencari-cari di mana fotonya muncul.
      logoHint: "Tersimpan, tetapi belum ditampilkan tema mana pun.",
      zoom: "Perbesaran",
      // Bingkai di editor memakai gaya yang SAMA dengan tema, jadi kalimat ini
      // boleh menjanjikan kemiripan — dan penyesuaiannya bisa diubah kapan saja
      // karena yang disimpan hanya angka, bukan foto yang sudah terpangkas.
      adjustHint: "Seret fotonya untuk menggeser. Bingkai ini mengikuti tema.",
    },
    // Blok "Video" langkah Pengaturan (FASE J) — unggah berkas + tautan YouTube.
    video: {
      legend: "Video",
      fileLabel: "Unggah video",
      limits: "Maks. 60 detik · 40 MB · landscape (mendatar) · MP4, WebM, MOV",
      priority:
        "Video unggahan tampil menggantikan tautan YouTube bila keduanya diisi.",
      add: "Pilih video",
      replace: "Ganti video",
      remove: "Hapus video",
      reading: "Memeriksa video…",
      working: "Mengunggah video…",
      preview: "Pratinjau video",
      // Fitur paket yang sama dengan YouTube (`limits.youtube`) — ditegakkan
      // server; teks ini hanya menjelaskan kenapa tombolnya mati.
      locked:
        "Video (unggahan maupun YouTube) tampil di undangan khusus paket Premium.",
      errors: {
        type: "Format video tidak didukung. Pakai MP4, WebM, atau MOV.",
        size: "Ukuran video melebihi 40 MB. Potong atau kompres dulu.",
        duration: "Durasi video melebihi 60 detik. Potong dulu sebelum unggah.",
        orientation:
          "Video harus landscape (mendatar). Putar atau rekam ulang secara mendatar.",
        unreadable:
          "Video tidak bisa dibaca peramban ini. Coba ekspor ulang sebagai MP4 (H.264).",
        limit: "Video hanya tersedia untuk paket Premium.",
        rate: "Terlalu banyak unggahan. Tunggu sebentar lalu coba lagi.",
        auth: "Sesi berakhir. Muat ulang halaman lalu coba lagi.",
        invalid: "Berkas video ditolak server. Periksa format & ukurannya.",
        server: "Video gagal diunggah. Coba lagi.",
      },
    },
    // Lagu MP3 unggahan pemilik (DECISIONS #121) — di bawah pilihan pustaka.
    customMusic: {
      legend: "Lagu sendiri (MP3)",
      limits: "MP3 · maks. 10 MB · durasi 10 detik–7 menit",
      priority:
        "Lagu sendiri diputar menggantikan pilihan dari pustaka di atas. Bila dihapus, undangan kembali memakai lagu pustaka.",
      // Versi teks ini = CUSTOM_MUSIC_ATTEST_VERSION (lib/custom-music.ts).
      // Mengubah isinya WAJIB menaikkan angka itu. (Versi 1 belum pernah
      // tampil ke pelanggan sebelum rilis 9 Nov 2026.) Tanggung jawab sengaja
      // DIBATASI pada klaim akibat pelanggaran pernyataan ini — selaras dengan
      // klausul ganti rugi S&K (DECISIONS #121), bukan pengalihan tanpa batas.
      attest:
        "Saya menyatakan rekaman ini milik saya, berlisensi untuk dipakai di undangan, atau sudah mendapat izin pemegang hak ciptanya. Saya paham lagu komersial tanpa izin (misalnya unduhan dari YouTube atau Spotify) dilarang. Bila pernyataan ini tidak benar, saya bertanggung jawab atas klaim pihak lain yang timbul karenanya, dan Merriva dapat menghapus musik ini bila ada laporan pelanggaran.",
      attestNeeded: "Centang pernyataan di atas untuk mengunggah.",
      // Diumumkan lewat aria-live (pembaca layar).
      uploaded: "Lagu berhasil diunggah.",
      removed: "Lagu dihapus.",
      // Undangan turun paket: lagu tersimpan tak diputar, tetapi pemilik tetap
      // bisa menghapusnya (berkasnya masih ada sampai disapu/purge).
      // Rujukan tersimpan yang objeknya sudah tak hidup (perakit render
      // memutar lagu pustaka sebagai gantinya).
      notPlayed:
        "Berkas lagu ini sudah tidak tersedia, jadi undangan memakai lagu pustaka. Hapus lalu unggah ulang bila perlu.",
      lockedHasSong:
        "Lagu ini tidak diputar karena undangan bukan Premium. Anda tetap bisa menghapusnya.",
      add: "Pilih berkas MP3",
      replace: "Ganti lagu",
      remove: "Hapus lagu",
      reading: "Memeriksa lagu…",
      working: "Mengunggah lagu…",
      current: "Lagu terpasang",
      unnamed: "Lagu unggahan",
      preview: "Dengarkan lagu",
      // Netral, tanpa ajakan beli: musik sendiri sengaja tidak dijadikan
      // nilai jual paket (DECISIONS #121).
      locked: "Unggah lagu sendiri tersedia untuk undangan Premium.",
      lockedByAdmin: (email: string) =>
        `Musik unggahan di undangan ini dinonaktifkan tim Merriva karena laporan pelanggaran hak cipta. Hubungi ${email} bila Anda memegang izinnya.`,
      errors: {
        empty: "Berkas kosong. Pilih berkas MP3 lain.",
        type: "Format tidak didukung. Pilih berkas MP3.",
        size: "Ukuran berkas melebihi 10 MB. Pilih versi berkualitas lebih rendah (mis. 128 kbps) atau lagu yang lebih pendek.",
        format:
          "Berkas ini bukan MP3 yang bisa diputar. Pilih berkas MP3 lain.",
        corrupt: "Berkas MP3 rusak atau tidak utuh. Pilih berkas lain.",
        short: "Lagu terlalu pendek — minimal 10 detik.",
        long: "Lagu terlalu panjang — maksimal 7 menit.",
        unreadable: "Berkas tidak bisa dibaca. Coba pilih ulang.",
        attest: "Centang pernyataan hak cipta lebih dulu.",
        // Server menolak versi pernyataan (halaman dimuat sebelum teksnya
        // diperbarui) — kotaknya SUDAH tercentang, jadi pesan `attest` keliru.
        attestStale:
          "Teks pernyataan hak cipta sudah diperbarui. Muat ulang halaman, lalu centang dan unggah lagi.",
        plan: "Unggah lagu sendiri hanya tersedia untuk undangan Premium.",
        locked:
          "Unggah musik di undangan ini dikunci tim Merriva karena laporan pelanggaran hak cipta.",
        quota:
          "Batas unggah lagu untuk undangan ini (5 kali per 24 jam) sudah tercapai. Coba lagi besok.",
        rate: "Terlalu banyak unggahan. Tunggu sebentar lalu coba lagi.",
        auth: "Sesi berakhir. Muat ulang halaman lalu coba lagi.",
        invalid: "Berkas ditolak server. Periksa format & ukurannya.",
        server: "Lagu gagal diunggah. Coba lagi.",
      },
    },
    schedule: {
      // Sesi berisi yang jam mulainya belum lengkap (DECISIONS #42).
      startMissing:
        "Sesi ini belum tampil di undangan sampai tanggal & jam mulai diisi lengkap.",
      // Isian Mulai dikosongkan pada sesi yang sudah berjam: jam lama dipertahankan.
      startKept:
        "Tanggal & jam belum lengkap. Yang tersimpan masih jam sebelumnya sampai isian ini lengkap.",
      tzHint: "Waktu mengikuti zona yang dipilih di langkah Pengaturan.",
      empty: "Belum ada sesi. Tambahkan akad, resepsi, dan sesi lainnya.",
      session: "Sesi",
      name: "Nama sesi",
      namePlaceholder: "Akad Nikah / Resepsi",
      start: "Mulai",
      end: "Selesai (opsional)",
      venue: "Nama tempat / gedung",
      address: "Alamat",
      mapsUrl: "Tautan Google Maps",
      add: "Tambah sesi",
    },
    save: {
      saving: "Menyimpan…",
      saved: "Tersimpan",
      error: "Gagal menyimpan",
    },
    nav: {
      prev: "Sebelumnya",
      next: "Berikutnya",
      // Langkah terakhir: menutup wizard dan membuka pratinjau.
      finish: "Selesai",
      finishing: "Menyimpan…",
      finishFailed:
        "Perubahan terakhir belum tersimpan, jadi halaman tidak dipindah. Periksa koneksi Anda lalu tekan Selesai lagi.",
      // Ditolak server: mengirim ulang isi yang sama tak akan pernah berhasil,
      // jadi pemilik diarahkan memperbaiki isian — bukan memeriksa koneksi.
      finishRejected: (langkah: string) =>
        `Ada isian yang perlu diperbaiki di langkah ${langkah}. Perbaiki isian bertanda merah, lalu tekan Selesai lagi.`,
      // Penolakan yang path-nya tak dikenali langkah mana pun.
      finishRejectedUnknown:
        "Ada isian yang ditolak server. Periksa isian bertanda merah, lalu tekan Selesai lagi.",
    },
    // Pesan per isian saat skema draft menolak (DECISIONS #41) — pengganti
    // pesan bawaan Zod yang berbahasa Inggris.
    validation: {
      tooLong: (n: number) => `Maksimal ${n.toLocaleString("id-ID")} karakter.`,
      tooMany: (n: number) => `Maksimal ${n.toLocaleString("id-ID")} entri.`,
      required: "Wajib diisi.",
      invalid: "Isian ini belum valid.",
    },
    // Penghitung karakter isian panjang (mis. "1.850/2.000 karakter").
    counter: (len: number, max: number) =>
      `${len.toLocaleString("id-ID")}/${max.toLocaleString("id-ID")} karakter`,
    // Teks pembaca layar pada langkah yang berisi isian bermasalah.
    stepNeedsFix: "perlu diperbaiki",
  },
  preview: {
    // Pratinjau gagal dimuat (DECISIONS #45) — gagal membaca TIDAK mengubah isian.
    loadError: {
      title: "Pratinjau belum bisa dimuat",
      body: "Sambungan ke server sedang terganggu. Isian yang sudah tersimpan tidak terpengaruh — coba lagi sebentar lagi.",
      retry: "Coba lagi",
    },
    badge: "Pratinjau",
    note: "Hanya Anda yang melihat ini.",
    demoBadge: "Contoh Tema",
    backToEditor: "Edit",
    allThemes: "Semua tema",
    home: "Beranda",
    themeUnavailable: "Tema undangan ini belum tersedia untuk pratinjau.",
    backToDashboard: "Kembali ke dashboard",
    frameTitle: "Pratinjau undangan di layar ponsel",
    // CTA aktivasi di bar pratinjau pemilik. Lebih pendek daripada teks kartu
    // dashboard (`dashboard.cardPay` dsb.) karena bar tetap harus muat di 360px.
    activateCta: {
      activate: "Aktifkan",
      pay: "Bayar",
      renew: "Perpanjang",
    },
    // Showcase tema publik (/preview/tema/{slug}).
    useThisTheme: "Gunakan tema ini",
    showcaseNote:
      "Pratinjau langsung dengan data contoh. Gulir di dalam layar untuk melihat seluruh undangan.",
    otherThemes: "Tema lainnya",
    prevTheme: "Sebelumnya",
    nextTheme: "Berikutnya",
  },

  // Kustomisasi tampilan oleh pembeli (Fase G / CUSTOMIZER-SPEC).
  appearance: {
    title: "Kustomisasi Tampilan",
    subtitle: "Sesuaikan warna, font, dan bagian undangan Anda.",
    back: "Kembali",
    save: "Simpan",
    saving: "Menyimpan…",
    saved: "Tampilan tersimpan.",
    reset: "Reset ke bawaan",
    resetConfirm: "Kembalikan tampilan ke bawaan tema?",
    dirty: "Ada perubahan belum disimpan.",
    error: "Gagal menyimpan tampilan. Coba lagi.",
    invalid: "Ada pilihan yang tidak valid.",
    unsupported: "Tema ini belum mendukung kustomisasi.",
    premiumBadge: "Premium",
    premiumHint: "Opsi ini tersedia di paket Premium.",
    tabs: {
      color: "Warna",
      font: "Font",
      sections: "Bagian",
      style: "Gaya",
    },
    colorVariant: "Palet warna",
    customAccent: "Warna aksen kustom",
    followPalette: "Ikuti palet",
    customAccentHint: "Warna aksen bebas — teks otomatis dijaga tetap terbaca.",
    contrastNote:
      "Warna teks disesuaikan otomatis agar tetap terbaca (WCAG AA).",
    fontPair: "Pasangan font",
    galleryStyle: "Gaya galeri",
    styleLabels: {
      strip: "Deret geser",
      grid: "Kisi",
      polaroid: "Polaroid",
      // Gaya galeri gelombang 3 (THEME-WAVE3 §2).
      arch: "Lengkung",
      songket: "Songket",
      okta: "Oktagon",
    },
    motion: "Gerak",
    motionFull: "Penuh",
    motionCalm: "Tenang",
    grain: "Tekstur kertas",
    on: "Aktif",
    off: "Nonaktif",
    sectionsHint:
      "Atur urutan & tampil/sembunyi bagian. Seret atau pakai panah.",
    show: "Tampilkan",
    hide: "Sembunyikan",
    moveUp: "Naikkan",
    moveDown: "Turunkan",
    locked: "Wajib tampil",
    dragHandle: "Seret untuk mengurutkan",
    // Satu label per id KANONIK (THEME-CONTRACT §1). Sinonim lama
    // (`opening`, `intro`, `principals`, `event`, `rundown`) sengaja dibuang:
    // entri yatim membuat nama lama terasa masih sah dan mengundang tema
    // berikutnya memakainya lagi — test kontrak menolak yang yatim.
    sectionLabels: {
      hero: "Pembuka",
      quote: "Kutipan",
      couple: "Mempelai",
      countdown: "Hitung mundur",
      schedule: "Acara",
      agenda: "Agenda",
      gallery: "Galeri",
      video: "Video",
      story: "Kisah",
      envelope: "Amplop hadiah",
      rsvp: "Ucapan & RSVP",
      // Section khas tema (`x-`) ikut di sini agar label editor & test kontrak
      // satu sumber; bukan sinonim id kanonik.
      "x-doa": "Doa pengantin",
    },
  },

  public: {
    // Gagal dimuat karena DB terganggu (DECISIONS #45) — boundary Album Momen
    // `app/[slug]/momen/error.tsx`. Halaman undangan `/{slug}` sengaja TANPA
    // boundary segmen (anggaran bundle JS tamu), jadi galatnya disajikan lewat
    // versi baik terakhir / halaman 500 statis bawaan Next.
    loadError: {
      title: "Undangan belum bisa dimuat",
      body: "Sambungan ke server sedang terganggu. Coba lagi sebentar lagi.",
      retry: "Coba lagi",
    },
    // Nama cadangan sesi yang namanya dikosongkan pemilik (tamu tetap melihat
    // label, editor tetap memuat isian kosong apa adanya — DECISIONS #42).
    eventFallbackName: "Acara",
    // Label lightbox galeri (dipakai komponen bersama `_shared/lightbox`).
    gallery: {
      enlarge: "Perbesar foto",
      close: "Tutup",
      prev: "Foto sebelumnya",
      next: "Foto berikutnya",
      dialog: "Galeri foto",
    },
    // Label aria pemutar section video (komponen bersama `_shared/video`) —
    // satu sumber untuk ke-14 tema; eyebrow-nya tetap di `labels.ts` tema.
    video: {
      play: "Putar video",
      unmute: "Nyalakan suara",
      mute: "Senyapkan",
    },
    cover: {
      recipient: "Kepada Yth.",
      recipientFallback: "Bapak / Ibu / Saudara/i",
      invited: "Dengan hormat, kami mengundang Anda pada acara",
      open: "Buka Undangan",
      weddingKicker: "Undangan Pernikahan",
      defaultKicker: "Undangan",
      groomFallback: "Mempelai Pria",
      brideFallback: "Mempelai Wanita",
    },
    // Deskripsi kartu pratinjau tautan (og:description, DECISIONS #119):
    // "Minggu, 6 Desember 2026 · Gedung X — buka undangan & konfirmasi kehadiran".
    // Nama tempat hanya ikut bila pendek — Meta menyarankan 1–2 baris.
    linkPreview: {
      cta: "buka undangan & konfirmasi kehadiran",
      venueMax: 40,
    },
    music: {
      play: "Putar musik",
      pause: "Jeda musik",
    },
    expired: {
      title: "Masa aktif undangan telah berakhir",
      body: "Terima kasih atas perhatian Anda. Undangan ini sudah tidak aktif. Untuk informasi lebih lanjut, silakan hubungi tuan rumah acara.",
      brand: "Dibuat dengan Merriva",
    },
  },

  guestbook: {
    eyebrow: "RSVP",
    heading: "Konfirmasi Kehadiran",
    subheading:
      "Mohon konfirmasi kehadiran Anda untuk membantu kami mempersiapkan acara.",
    form: {
      name: "Nama",
      namePlaceholder: "Nama Anda",
      attendanceLabel: "Apakah Anda akan hadir?",
      attending: "Ya, saya hadir",
      notAttending: "Maaf, berhalangan",
      pax: "Jumlah tamu",
      message: "Ucapan & doa",
      messagePlaceholder: "Tulis ucapan & doa untuk kedua mempelai (opsional)",
      submit: "Kirim Konfirmasi",
      submitting: "Mengirim…",
      success: "Terima kasih, konfirmasi Anda sudah kami terima.",
      successModerated:
        "Terima kasih! Ucapan Anda akan tampil setelah ditinjau tuan rumah.",
      invalid: "Periksa kembali isian Anda.",
      rateLimited: "Terlalu banyak percobaan. Coba lagi beberapa saat.",
      captchaFailed:
        "Verifikasi anti-bot gagal. Muat ulang halaman lalu coba lagi.",
      closed: "Undangan ini sedang tidak menerima konfirmasi.",
      // Link umum (tanpa token, DECISIONS #120): ditolak di form dengan pesan
      // jelas — dulu angka di atas batas dipotong diam-diam oleh server.
      paxMax: (max: number) =>
        `Maksimal ${max} orang untuk konfirmasi lewat tautan ini. Untuk rombongan lebih besar, hubungi tuan rumah.`,
      paxInvalid: "Isi jumlah tamu dengan angka bulat, minimal 1.",
    },
    wall: {
      heading: "Ucapan & Doa",
      empty: "Belum ada ucapan. Jadilah yang pertama memberi doa!",
      loadMore: "Muat lebih banyak",
      loading: "Memuat…",
      // Dibedakan dari `empty`: gagal memuat BUKAN berarti belum ada ucapan.
      failed: "Ucapan belum bisa dimuat sekarang.",
      retry: "Coba lagi",
    },
    gift: {
      trigger: "Konfirmasi Kirim Amplop / Kado",
      title: "Konfirmasi Pengiriman",
      intro:
        "Sudah mengirim amplop atau kado? Beri tahu tuan rumah — bersifat privat.",
      name: "Nama",
      namePlaceholder: "Nama Anda",
      typeLabel: "Jenis",
      typeTransfer: "Transfer",
      typeGift: "Kado / Hadiah",
      amount: "Nominal (opsional)",
      amountPlaceholder: "mis. 100000",
      note: "Pesan (opsional)",
      notePlaceholder: "Catatan singkat untuk tuan rumah",
      submit: "Kirim Konfirmasi",
      submitting: "Mengirim…",
      success:
        "Terima kasih 🙏 Konfirmasi Anda sudah kami teruskan ke tuan rumah.",
      invalid: "Periksa kembali isian Anda.",
      close: "Tutup",
    },
  },
  // Album Momen — halaman kamera tamu publik (/[slug]/momen). Dibuka mayoritas
  // via WebView WhatsApp; teks pendek & jelas untuk layar HP.
  momen: {
    brand: "Merriva Momen",
    // Tombol masuk melayang di halaman undangan (muncul bila album aktif).
    fab: {
      label: "Album Momen",
      aria: "Buka Album Momen — kamera bersama untuk tamu",
    },
    notActive: {
      title: "Album Momen belum aktif",
      body: "Undangan ini belum mengaktifkan kamera bersama. Hubungi tuan rumah bila kamu ingin ikut memotret momen acara.",
    },
    masuk: {
      quota: (n: number) => `${n} jepretan`,
      introInstant: (shots: string) =>
        `Jadilah fotografer di acara ini! Kamu punya ${shots} — foto langsung tampil di album bersama.`,
      introReveal: (shots: string, revealLabel: string) =>
        `Jadilah fotografer di acara ini! Kamu punya ${shots} — semua foto tersembunyi dan terbuka serentak pada ${revealLabel}.`,
      pills: ["Tanpa install aplikasi", "6 filter film", "Terbuka bersama"],
      nameLabel: "Namamu (tampil di fotomu)",
      namePlaceholder: "mis. Sasa",
      start: "Mulai Memotret",
      starting: "Menyiapkan…",
      turnstileNote: "Dilindungi verifikasi anti-bot",
    },
    camera: {
      title: "Album Momen",
      remaining: (n: number) => `${n} jepretan tersisa`,
      close: "Tutup",
      flip: "Balik kamera",
      shutter: "Jepret",
      fromGallery: "Unggah dari galeri",
      uploading: "Menyimpan…",
      savedHidden: "Tersimpan ✓ — tersembunyi sampai reveal",
      // Kirim ulang jepretan yang gagal diunggah (DECISIONS #46) — fotonya
      // disimpan klien, jadi tamu tak perlu (dan sering tak bisa) mengulang.
      retryPhoto: "Kirim ulang foto",
      // Dipakai saat pesan galat di layar BUKAN milik jepretan yang tertunda
      // (mis. tamu lalu memilih berkas HEIC): tombol kirim ulang tetap ada,
      // tetapi harus jelas foto mana yang dimaksud.
      pendingShot: "Satu jepretan sebelumnya belum terkirim.",
      savedInstant: "Tersimpan ✓",
      permissionHint:
        "Izinkan akses kamera di browser, atau unggah foto dari galeri.",
    },
    habis: {
      title: "Jatahmu terpakai semua!",
      body: (total: number) =>
        `Terima kasih sudah ikut memotret. ${total} foto sudah terkumpul di album. Semua terbuka serentak dalam:`,
      revealed: "Album sudah terbuka — lihat semua foto sekarang.",
      toGallery: "Lihat Album",
      d: "Hari",
      h: "Jam",
      m: "Menit",
      s: "Detik",
    },
    gallery: {
      kickerRevealed: "Album Momen · Terbuka 🎉",
      sub: (photos: number, people: number) =>
        `${photos} foto oleh ${people} fotografer dadakan`,
      empty: "Belum ada foto di album. Jadilah yang pertama memotret!",
      cameraAgain: "Kamera",
      loadMore: "Muat lebih banyak",
      loading: "Memuat…",
      downloadPhoto: "Unduh foto",
      close: "Tutup",
      by: (name: string) => `oleh ${name}`,
    },
    // Dashboard host — aktivasi add-on (gratis / berbayar).
    activate: {
      title: "Album Momen",
      // Foto Album Momen adalah SATU-SATUNYA foto di produk ini yang tak bisa
      // dibuat ulang — tamu yang memotretnya, dan tak ada salinan di tempat
      // lain. Sebelum ini, begitu undangan tak lagi aktif, satu-satunya tautan
      // ZIP-nya hidup di dalam `MomenManager` yang tak pernah dirender di
      // halaman ini, sehingga pemiliknya mendarat di "aktifkan dulu" dan
      // menyimpulkan fotonya terkunci di balik perpanjangan — lalu retensi
      // menghapusnya. Route ZIP-nya sendiri tak pernah memeriksa status
      // undangan, jadi datanya selalu terjangkau; yang hilang hanya pintunya.
      archivedTitle:
        "Undangan ini tidak aktif — unduh fotonya selagi masih ada",
      archivedBody:
        "Album Momen tidak bisa dikelola saat undangan tidak aktif, tetapi foto yang sudah terkumpul masih bisa Anda unduh. Foto ini hanya ada di sini: tamu Anda yang memotretnya.",
      archivedCta: "Unduh semua foto (ZIP)",
      needActiveTitle: "Aktifkan undangan dulu",
      needActiveBody:
        "Album Momen hanya bisa diaktifkan untuk undangan yang sudah aktif.",
      // Katalog add-on bisa ditutup SELURUHNYA — kelima baris `packages`
      // ber-`kind='addon_momen'` di-`is_active=false` (gerbang rilis
      // LAUNCH-CHECKLIST Fase 4). Tanpa pesan ini halaman tetap merender panel:
      // pemilik membaca "Pilih kapasitas peserta:" lalu tak menemukan satu pun
      // kartu di bawahnya — halaman yang tampak rusak, bukan fitur yang
      // sengaja belum dibuka.
      closedTitle: "Album Momen belum dibuka",
      closedBody:
        "Add-on ini masih kami siapkan dan belum bisa diaktifkan. Undangan Anda tetap berjalan normal — kami kabari begitu Album Momen tersedia.",
      intro:
        "Kamera bersama untuk tamu — jatah jepret terbatas + filter film + foto terbuka serentak saat reveal. Pilih kapasitas peserta:",
      peserta: (n: number) => `${n} peserta`,
      pesertaUnlimited: "Peserta tak terbatas",
      free: "Gratis",
      freeCta: "Aktifkan gratis",
      freeActivating: "Mengaktifkan…",
      paidCta: "Pilih & bayar",
      redirecting: "Mengalihkan ke pembayaran…",
      securedBy: "Pembayaran QRIS diproses oleh BinderPay.",
      error: "Gagal mengaktifkan. Coba lagi.",
      back: "Kembali ke dashboard",
      // Order add-on masih menunggu pembayaran → JANGAN tampilkan panel harga
      // (pemilik bisa menekan "Aktifkan gratis" dan kehilangan tier yang dibeli).
      pendingTitle: "Menunggu pembayaran",
      pendingBody: (orderCode: string) =>
        `Pesanan ${orderCode} belum terverifikasi. Album Momen akan aktif otomatis begitu pembayaranmu diterima — biasanya beberapa menit.`,
      pendingHint:
        "Jangan membuat pesanan baru agar tidak tertagih dua kali. Halaman ini memeriksa sendiri secara berkala.",
    },
    // Status pembayaran add-on (poll otoritatif kedua — DECISIONS #29).
    payment: {
      package: "Paket",
      amount: "Total",
      order: "Kode pesanan",
      checkNow: "Periksa sekarang",
      checking: "Memeriksa…",
      back: "Kembali ke dashboard",
      activeTitle: "Album Momen aktif 🎉",
      activeBody:
        "Pembayaranmu terverifikasi. Bagikan link kamera atau cetak QR meja untuk tamu.",
      manage: "Kelola album",
      expiredTitle: "Pesanan kedaluwarsa",
      expiredBody:
        "Pesanan ini sudah tidak berlaku. Kamu bisa memilih paket lagi tanpa tertagih dua kali.",
      chooseAgain: "Pilih paket lagi",
      reviewTitle: "Perlu dicek tim kami",
      // "kode pesanan di atas" dihindari: state `error` pada poller tidak
      // merender ringkasan order, jadi kodenya belum tentu ada di layar. Kontak
      // kini dirender `SupportContact` yang membawa kodenya sendiri.
      reviewBody:
        "Pembayaranmu tercatat tetapi album belum terbentuk. Tim kami akan menindaklanjuti. Bila album belum aktif dalam 1x24 jam, hubungi kami lewat kontak di bawah.",
      timeoutTitle: "Masih menunggu konfirmasi",
      timeoutBody:
        "Pembayaran belum terkonfirmasi sampai sekarang. Album tetap akan aktif otomatis begitu pembayaran diterima — kamu boleh menutup halaman ini.",
      errorTitle: "Gagal memeriksa status",
      errorBody: "Terjadi kendala saat memeriksa pembayaran. Coba lagi.",
      retry: "Coba lagi",
    },
    // Dashboard host — kelola album aktif.
    manage: {
      title: "Kelola Album Momen",
      tierLabel: (peserta: string) => `Kapasitas: ${peserta}`,
      monitorPhotos: "Foto terkumpul",
      monitorParticipants: "Peserta",
      monitorHidden: "Disembunyikan",
      settingsTitle: "Pengaturan",
      quotaPerGuest: "Jatah per tamu",
      quotaPerGuestHint: "1–20 jepretan tiap tamu",
      revealTitle: "Waktu reveal",
      revealInstant: "Langsung tampil",
      revealSchedule: "Jadwal sendiri",
      revealAtLabel: "Buka pada (WIB)",
      revealNeedsDate:
        'Isi dulu tanggal & jam bukanya. Bila ingin foto tampil seketika, pilih "Langsung tampil".',
      revealPastWarning:
        "Waktu itu sudah lewat — album akan langsung terbuka begitu disimpan.",
      defaultFilter: "Filter bawaan",
      allowLibrary: "Izinkan unggah dari galeri",
      allowLibraryHint: "Mati = hanya jepretan langsung",
      save: "Simpan pengaturan",
      saving: "Menyimpan…",
      saved: "Tersimpan ✓",
      revealNow: "Reveal sekarang",
      revealNowConfirm:
        "Buka semua foto untuk tamu sekarang? Tindakan ini tak bisa dibatalkan.",
      revealNowDone: "Album dibuka untuk semua 🎉",
      revealedNote: "Album sudah terbuka untuk tamu.",
      moderationTitle: "Moderasi foto",
      moderationHint:
        "Kamu bisa melihat semua foto sebelum reveal. Sembunyikan atau hapus yang tak pantas.",
      moderationEmpty: "Belum ada foto masuk.",
      moderationMore: "Muat lebih banyak foto",
      hide: "Sembunyikan",
      show: "Tampilkan",
      // Pasca-reveal, menyembunyikan IKUT menghapus berkas (KEA-3) — host wajib
      // tahu sebelum menekan, karena tindakannya permanen.
      hidePermanentConfirm:
        "Album sudah terbuka untuk tamu, jadi menyembunyikan foto ini sekaligus MENGHAPUS berkasnya agar tautannya tak bisa dibuka lagi. Tindakan ini permanen — foto tak bisa ditampilkan kembali. Lanjutkan?",
      purgedBadge: "Berkas dihapus",
      showPurged:
        "Berkas foto ini sudah dihapus saat disembunyikan, jadi tak bisa ditampilkan lagi.",
      del: "Hapus",
      delConfirm: "Hapus foto ini permanen?",
      hiddenBadge: "Disembunyikan",
      guestLinkTitle: "Link kamera tamu",
      guestLinkHint: "Bagikan / tempel di QR meja.",
      copy: "Salin",
      copied: "Tersalin ✓",
      qrCta: "Cetak QR meja (A6)",
      zipCta: "Unduh album (ZIP)",
      by: (name: string) => `oleh ${name}`,
      error: "Gagal. Coba lagi.",
    },
    // Halaman cetak QR meja (A6).
    qr: {
      title: "QR Meja — Album Momen",
      kicker: "Album Momen",
      instruction: "Pindai untuk ikut memotret momen acara",
      hint: "Setiap tamu dapat jatah jepretan terbatas + filter film. Foto terbuka bersama saat reveal.",
      print: "Cetak / Simpan PDF",
      back: "Kembali",
    },
    // Pesan kesalahan aksi tamu (dipetakan dari alasan RPC claim/confirm).
    error: {
      generic: "Gagal menyimpan foto. Coba lagi.",
      rateLimited: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
      session: "Sesi berakhir. Muat ulang halaman lalu masukkan namamu lagi.",
      turnstile: "Verifikasi anti-bot gagal. Coba lagi.",
      invalid: "Data foto tidak valid.",
      formatUnsupported:
        "Format foto ini belum didukung. Pilih foto JPG, PNG, atau WebP — atau jepret langsung dengan kamera.",
      libraryDisabled:
        "Tuan rumah hanya mengizinkan jepretan langsung dari kamera.",
      albumFull: "Album sudah penuh.",
      guestQuota: "Jatah jepretanmu sudah habis.",
      pesertaFull: "Kuota peserta album sudah penuh.",
      notActive: "Album tidak aktif.",
      // Gangguan sesaat (galat DB) — DIBEDAKAN dari `notActive` yang terdengar
      // permanen dan membuat tamu berhenti memotret (DECISIONS #46).
      temporary: "Sedang ada gangguan. Coba lagi sebentar lagi.",
    },
  },
  // Email transaksional (Resend — M3.5). Teks terpusat; markup dirakit di
  // `lib/email/templates.ts`.
  email: {
    brand: "Merriva",
    footer:
      "Email ini dikirim otomatis oleh Merriva. Mohon jangan membalas email ini.",
    // Kuitansi + link aktif (dikirim saat order → paid).
    receipt: {
      subject: "Pembayaran berhasil — undangan Anda kini aktif",
      preheader: "Pembayaran diterima. Undangan Anda aktif & siap disebar.",
      heading: "Pembayaran berhasil 🎉",
      greeting: (name: string | null) => (name ? `Halo ${name},` : "Halo,"),
      intro:
        "Terima kasih. Pembayaran Anda telah kami terima dan undangan Anda kini aktif serta siap disebar.",
      pkg: "Paket",
      total: "Total",
      order: "Kode order",
      paidAt: "Tanggal bayar",
      activeUntil: "Aktif hingga",
      cta: "Lihat undangan",
      outro: "Simpan email ini sebagai bukti pembayaran.",
    },
    // Peringatan pra-purge (AUDIT-2026-10-01 B7). `docs/DATA-MODEL.md` sudah
    // MENJANJIKAN email ini sejak lama; ia tak pernah dibuat.
    //
    // Nada: lugas, tanpa menakut-nakuti dan tanpa menghaluskan. Yang dibaca
    // orang di sini adalah kabar bahwa foto pernikahannya akan hilang — jadi
    // kalimat pertama menyebut tanggalnya, bukan basa-basi, dan tombolnya
    // menawarkan jalan keluar yang nyata.
    purgeWarning: {
      subject: (hari: number, slug: string) =>
        hari <= 7
          ? `${hari} hari lagi: data undangan ${slug} dihapus permanen`
          : `Data undangan ${slug} akan dihapus ${hari} hari lagi`,
      preheader: (tanggal: string) =>
        `Setelah ${tanggal}, data tamu dan foto undangan ini tidak dapat dipulihkan.`,
      heading: "Sebelum datanya dihapus",
      greeting: (name: string | null) => (name ? `Halo ${name},` : "Halo,"),
      intro: (slug: string, tanggal: string, hari: number) =>
        `Masa aktif undangan /${slug} sudah berakhir. Sesuai kebijakan retensi kami, data pribadinya dihapus permanen pada ${tanggal} — ${hari} hari lagi — dan setelah itu tidak dapat dipulihkan.`,
      yangHilang:
        "Yang dihapus: daftar tamu beserta nomor dan link personalnya, seluruh RSVP dan ucapan, catatan amplop, foto galeri, dan foto Album Momen.",
      yangTetap:
        "Yang tidak terhapus: riwayat pembayaran Anda, akun Anda, dan alamat undangan ini.",
      // Dua jalan keluar, urutannya berbeda per tahap: pada H-30 memperpanjang
      // masih keputusan yang wajar dipikirkan; pada H-7 menyelamatkan data jauh
      // lebih realistis daripada memutuskan membeli.
      ctaPerpanjang: "Perpanjang undangan",
      ctaUnduh: "Unduh data saya",
      // Diperbarui setelah ZIP galeri ada (DECISIONS #70). Kalimat lamanya
      // menyuruh pemilik "simpan aslinya" karena memang tak ada unduhan galeri;
      // sekarang ada, tetapi yang bisa kami berikan tetap versi 1600 px — berkas
      // kamera aslinya tak pernah sampai ke kami. Keduanya harus disebut, kalau
      // tidak kalimat ini berubah dari kurang-berguna menjadi menyesatkan.
      unduhHint:
        "Dari dashboard Anda dapat mengunduh daftar tamu beserta RSVP, catatan amplop, foto Album Momen, dan foto galeri sebagai berkas ZIP. Foto galeri yang kami simpan adalah versi 1600 piksel yang tampil di undangan — berkas asli dari kamera Anda tak pernah diunggah, jadi simpan aslinya sendiri.",
      outroPertama:
        "Kami akan mengingatkan sekali lagi menjelang tenggat. Bila Anda tak memerlukan datanya lagi, Anda tak perlu melakukan apa pun.",
      outroFinal:
        "Ini pengingat terakhir dari kami. Setelah tanggal di atas, data tersebut tidak dapat dikembalikan.",
    },
    // Kuitansi UPGRADE paket (B3). Berbeda dari kuitansi aktivasi: tak boleh
    // mengaku "undangan Anda kini aktif" (ia sudah aktif sebelum ini) dan tak
    // boleh menyiratkan masa aktif baru — nominalnya hanya selisih harga.
    upgradeReceipt: {
      subject: "Upgrade berhasil — paket undangan Anda sudah naik",
      preheader: "Pembayaran selisih diterima. Paket undangan Anda sudah naik.",
      heading: "Upgrade berhasil 🎉",
      greeting: (name: string | null) => (name ? `Halo ${name},` : "Halo,"),
      intro:
        "Terima kasih. Pembayaran selisih telah kami terima dan paket undangan Anda sudah naik. Masa aktif undangan tidak berubah.",
      pkg: "Paket sekarang",
      total: "Selisih dibayar",
      order: "Kode order",
      paidAt: "Tanggal bayar",
      activeUntil: "Masa aktif berakhir",
      cta: "Lihat undangan",
      outro: "Simpan email ini sebagai bukti pembayaran.",
    },
    // Kuitansi add-on Album Momen (dikirim saat order add-on → paid). Album ikut
    // masa retensi undangan (bukan durasi paket) → tanpa baris "aktif hingga".
    momenReceipt: {
      subject: "Album Momen aktif — undangan Anda kini punya kamera bersama",
      preheader: "Pembayaran diterima. Album Momen siap dibagikan ke tamu.",
      heading: "Album Momen aktif 📸",
      greeting: (name: string | null) => (name ? `Halo ${name},` : "Halo,"),
      intro:
        "Terima kasih. Pembayaran Anda telah kami terima dan Album Momen kini aktif. Tamu bisa memotret momen acara Anda lewat kamera bersama.",
      pkg: "Paket",
      total: "Total",
      order: "Kode order",
      paidAt: "Tanggal bayar",
      cta: "Kelola Album Momen",
      outro:
        "Buka pengaturan album untuk mengatur waktu buka foto & mencetak QR bagi tamu. Simpan email ini sebagai bukti pembayaran.",
    },
    // Pengingat masa aktif (cron H-14).
    reminder: {
      subject: (days: number) =>
        `Masa aktif undangan berakhir dalam ${days} hari`,
      preheader: "Perpanjang agar undangan tetap dapat diakses tamu.",
      heading: "Masa aktif undangan akan berakhir",
      greeting: (name: string | null) => (name ? `Halo ${name},` : "Halo,"),
      intro: (dateLabel: string, days: number) =>
        `Undangan Anda aktif hingga ${dateLabel} (${days} hari lagi). Perpanjang sekarang agar tetap dapat diakses tamu setelah tanggal tersebut.`,
      ctaRenew: "Perpanjang sekarang",
      ctaView: "Lihat undangan",
      outro: "Abaikan email ini bila undangan memang tak perlu diperpanjang.",
    },
    // Notis "sudah berakhir" — dikirim cron `expire-invitations` pada TRANSISI
    // active → expired (AUDIT-2026-10-01 B7). Posisinya di antara dua email yang
    // sudah ada, dan bedanya penting: `reminder` dikirim saat undangan MASIH
    // aktif, `purgeWarning` saat datanya akan DIHAPUS. Di sini layanannya sudah
    // berhenti sementara datanya masih utuh — satu-satunya email yang boleh
    // berkata "tamu Anda sudah tidak bisa membukanya".
    expired: {
      subject: (slug: string) => `Masa aktif undangan ${slug} sudah berakhir`,
      preheader:
        "Tautannya kini menampilkan pemberitahuan masa aktif berakhir. Data Anda masih tersimpan.",
      heading: "Masa aktif undangan sudah berakhir",
      greeting: (name: string | null) => (name ? `Halo ${name},` : "Halo,"),
      intro: (slug: string, tanggal: string) =>
        `Masa aktif undangan /${slug} berakhir pada ${tanggal}. Tamu yang membuka tautannya sekarang melihat pemberitahuan masa aktif berakhir, bukan undangan Anda.`,
      dataAman: (tanggal: string) =>
        `Datanya tidak hilang: daftar tamu, RSVP, ucapan, catatan amplop, dan foto tetap tersimpan sampai ${tanggal}. Perpanjang kapan saja dan undangan kembali tampil persis seperti sebelumnya.`,
      ctaRenew: "Perpanjang undangan",
      ctaDashboard: "Buka dashboard",
      // Kalimat kedua baru boleh ditulis sejak peringatan pra-purge H-30/H-7 ada
      // (DECISIONS #67). Sebelum itu ia akan menjadi janji yang tak ditepati.
      outro:
        "Bila Anda tak lagi memerlukannya, tak ada yang perlu dilakukan. Kami akan mengingatkan lebih dulu sebelum data tersebut dihapus.",
    },
    // Penangguhan oleh tim (AUDIT-2026-10-01 B7, DECISIONS #68).
    //
    // Satu-satunya email di produk ini yang mengabarkan tindakan PENEGAKAN. Dua
    // hal karenanya tidak bisa dikompromikan: alasannya datang dari kolom
    // terpisah yang memang ditulis untuk dibaca pelanggan (catatan internal tak
    // pernah ikut), dan jalur banding selalu disebut — penangguhan tanpa cara
    // membantahnya adalah penghakiman, bukan moderasi.
    suspended: {
      subject: (slug: string) => `Undangan ${slug} ditangguhkan sementara`,
      preheader:
        "Halaman undangan tidak dapat dibuka tamu sampai hal ini diselesaikan.",
      heading: "Undangan Anda ditangguhkan",
      greeting: (name: string | null) => (name ? `Halo ${name},` : "Halo,"),
      intro: (slug: string) =>
        `Undangan /${slug} kami tangguhkan sementara. Selama ditangguhkan, tamu yang membuka tautannya tidak dapat melihat undangan Anda.`,
      alasanJudul: "Alasan penangguhan",
      // Dipakai saat admin menangguhkan tanpa menulis penjelasan publik. Tetap
      // menyebut jalur banding — ketiadaan alasan bukan alasan untuk diam.
      alasanKosong:
        "Alasan rincinya akan kami sampaikan lewat email balasan. Silakan hubungi kami dan kami jelaskan.",
      dataAman:
        "Data Anda tidak terhapus: daftar tamu, RSVP, ucapan, catatan amplop, dan foto tetap tersimpan, dan masa aktif undangan tidak dipotong karena penangguhan ini.",
      bandingJudul: "Tidak setuju dengan keputusan ini?",
      banding: (email: string) =>
        `Balas email ini atau kirim pesan ke ${email}. Sertakan alamat undangan Anda, dan kami akan meninjau ulang. Bila penangguhannya keliru, kami pulihkan.`,
      ctaDashboard: "Buka dashboard",
    },
    // Pasangan dari `suspended`. Tanpa email ini, pelanggan yang bandingnya
    // DITERIMA tak pernah diberi tahu — ia hanya bisa menebak dengan membuka
    // tautannya sendiri, dan itu lebih merusak kepercayaan daripada tak pernah
    // mengirim email penangguhan sejak awal.
    reinstated: {
      subject: (slug: string) => `Penangguhan undangan ${slug} dicabut`,
      preheader: "Undangan Anda sudah tidak ditangguhkan.",
      heading: "Penangguhan sudah dicabut",
      greeting: (name: string | null) => (name ? `Halo ${name},` : "Halo,"),
      tampil: (slug: string) =>
        `Penangguhan undangan /${slug} sudah dicabut. Undangan Anda kembali dapat dibuka tamu seperti biasa.`,
      // Reinstate memulihkan status dari `active_until`: bila masa aktifnya sudah
      // lewat, undangan jadi `expired` — belum tampil. Mengabarkan "sudah tampil
      // kembali" di kasus itu adalah keterangan yang salah.
      belumTampil: (slug: string) =>
        `Penangguhan undangan /${slug} sudah dicabut. Masa aktif undangan ini sendiri sudah berakhir, jadi tautannya belum dapat dibuka tamu — perpanjang untuk menampilkannya kembali.`,
      ctaView: "Lihat undangan",
      ctaRenew: "Perpanjang undangan",
      outro: "Terima kasih atas kesabaran Anda.",
    },
    // Takedown musik unggahan (DECISIONS #121). Sama seperti `suspended`:
    // alasan dari kolom publik (catatan internal — yang bisa memuat identitas
    // pelapor — tak pernah ikut), dan jalur sanggahan selalu disebut.
    musicRemoved: {
      subject: (slug: string) => `Musik unggahan di undangan ${slug} dihapus`,
      preheader:
        "Undangan Anda tetap tayang; hanya musik yang Anda unggah yang dihapus.",
      heading: "Musik unggahan Anda dihapus",
      greeting: (name: string | null) => (name ? `Halo ${name},` : "Halo,"),
      intro: (slug: string) =>
        `Kami menghapus musik yang Anda unggah di undangan /${slug} setelah menerima laporan pelanggaran hak cipta. Undangan Anda tetap dapat dibuka tamu seperti biasa; bila Anda memilih lagu dari pustaka, lagu itu yang kini diputar.`,
      alasanJudul: "Alasan",
      alasanKosong:
        "Rincian laporannya akan kami sampaikan lewat email balasan. Silakan hubungi kami.",
      kunci:
        "Unggah musik di undangan ini kami kunci sampai kami membukanya kembali — misalnya setelah sanggahan Anda kami terima. Lagu dari pustaka Merriva tetap bisa Anda pilih kapan saja.",
      sanggahJudul: "Anda memegang izinnya?",
      sanggah: (email: string) =>
        `Balas email ini atau kirim pesan ke ${email} dengan bukti lisensi atau izin pemegang hak cipta, beserta alamat undangan Anda. Kami tinjau ulang, dan bila laporannya keliru kami buka kembali kuncinya.`,
      ctaDashboard: "Buka dashboard",
    },
  },
  admin: {
    brand: "Merriva Admin",
    nav: {
      overview: "Ringkasan",
      invitations: "Undangan",
      orders: "Order",
      users: "Pengguna",
      packages: "Paket",
      themes: "Tema",
      songs: "Lagu",
      toDashboard: "Ke dashboard",
    },
    overview: {
      title: "Ringkasan",
      subtitle: "Metrik utama Merriva.",
      newInvitations24h: "Undangan baru (24 jam)",
      newInvitations7d: "Undangan baru (7 hari)",
      totalInvitations: "Total undangan",
      activeInvitations: "Undangan aktif",
      conversion: "Konversi draft → bayar",
      convertedOf: (converted: number, total: number) =>
        `${converted} dari ${total} undangan`,
      revenueThisMonth: "Revenue bulan ini",
      paidOrdersThisMonth: (n: number) => `${n} order lunas bulan ini`,
      // Kesehatan scheduled job (AUDIT-2026-10-01). Keputusan pemilik: jejak di
      // panel, bukan dead-man switch eksternal. Yang paling penting ditampilkan
      // bukan "gagal" melainkan "basi" — job yang berhenti jalan tak pernah
      // mengirim galat, ia hanya diam.
      cron: {
        heading: "Scheduled job",
        subtitle:
          "Retensi UU PDP, aktivasi order lunas, dan pengingat H-14 bergantung pada job ini.",
        health: {
          ok: "Sehat",
          gagal: "Gagal",
          basi: "Tidak jalan",
          "belum-pernah": "Belum pernah jalan",
        },
        lastRun: "Terakhir jalan",
        lastOk: "Sukses terakhir",
        never: "—",
        failuresOf: (failures: number, runs: number) =>
          `${failures} gagal dari ${runs} jalan`,
        statsHeading: "Angka jalan terakhir",
        // Label untuk kunci `cron_runs.stats`. Kunci yang TIDAK ada di sini tetap
        // ditampilkan apa adanya — sengaja. Statistik baru ditambahkan tiap kali
        // ada fitur cron baru, dan angka yang hilang dari panel karena lupa
        // diberi label adalah kegagalan yang panel ini ada untuk mencegah.
        statLabel: {
          // expire-orders
          scanned: "dipindai",
          activated: "diaktifkan",
          keptPaid: "lunas, tak di-expire",
          expired: "dikedaluwarsakan",
          skipped: "dilewati (transien)",
          cancelFailed: "gagal batalkan di gateway",
          tanpaTxn: "tanpa txn_id",
          mudaScanned: "muda: dipindai",
          mudaActivated: "muda: diaktifkan",
          mudaPending: "muda: masih pending",
          budgetHabis: "anggaran panggilan gateway habis",
          // expire-invitations
          notified: "notis terkirim",
          notifyNoOwner: "notis: tanpa pemilik",
          notifyFailed: "notis gagal",
          notifyTruncated: "notis terpotong",
          // expiry-reminders
          sent: "pengingat terkirim",
          failed: "pengingat gagal",
          noOwner: "tanpa pemilik",
          truncated: "terpotong batas",
          // purge-expired
          purged: "dipurge",
          storageFailed: "objek storage gagal dihapus",
          heldForWarning: "ditahan menunggu peringatan",
          backstop: "dipurge via backstop",
          warned: "peringatan terkirim",
          warnFinal: "peringatan final",
          warnNoOwner: "peringatan: tanpa pemilik",
          warnFailed: "peringatan gagal",
          // purge-expired: sapu musik unggahan usang (DECISIONS #121)
          musicScanned: "musik: kandidat usang dibaca",
          musicSwept: "musik usang dihapus",
          musicFailed: "musik: objek gagal dihapus",
          musicTruncated: "musik: terpotong batas",
          musicSweepFailed: "musik: langkah sapu gagal",
          // backup-media (skrip host, DECISIONS #117)
          files: "berkas dicadangkan",
          bytes: "ukuran arsip (byte)",
        } as Record<string, string>,
        staleHint:
          "Melewati dua kali jadwalnya. Periksa crontab host VPS (LAUNCH-CHECKLIST Fase 3; backup-media: Fase 5) — job yang terhapus atau salah ketik tidak mengirim galat apa pun.",
      },
      recentActivity: "Aktivitas admin terakhir",
      noActivity: "Belum ada aktivitas admin.",
    },
    common: {
      searchCta: "Cari",
      all: "Semua status",
      empty: "Tidak ada data.",
      prev: "Sebelumnya",
      next: "Berikutnya",
      page: (n: number) => `Halaman ${n}`,
      back: "← Kembali",
      dash: "—",
      actions: "Aksi",
    },
    statusLabel: {
      draft: "Draf",
      pending_payment: "Menunggu bayar",
      active: "Aktif",
      expired: "Kedaluwarsa",
      suspended: "Ditangguhkan",
    },
    categoryLabel: {
      wedding: "Pernikahan",
      corporate: "Korporat",
      family: "Keluarga",
    },
    orderStatusLabel: {
      pending: "Menunggu",
      paid: "Lunas",
      expired: "Kedaluwarsa",
      failed: "Gagal",
      refunded: "Refund",
    },
    // Hapus akun (AUDIT-2026-10-01 A6). Tak bisa dibatalkan, jadi butuh alasan
    // DAN email target diketik ulang.
    deleteAccount: {
      cta: "Hapus akun",
      reasonLabel: "Alasan penghapusan",
      reasonPlaceholder: "mis. permintaan pelanggan via email 3 Okt",
      confirmLabel: "Ketik ulang email akun ini untuk konfirmasi",
      submit: "Hapus permanen",
      confirm:
        "Hapus akun ini permanen? Data tamu, RSVP, ucapan, dan foto akan hilang dan tidak bisa dikembalikan.",
      note: "Riwayat pesanan DIPERTAHANKAN ter-anonimisasi untuk pembukuan. Akun dengan undangan yang masih aktif akan ditolak.",
    },
    // Refund (AUDIT-2026-10-01 A3). Uangnya digerakkan di dashboard gateway
    // (BinderPay) — tombol ini mencatat keputusannya dan mencabut layanan yang
    // dibeli.
    refund: {
      cta: "Tandai refund",
      reasonLabel: "Alasan refund",
      reasonPlaceholder: "mis. pembayaran ganda, order MRV-XXXXXX",
      confirm:
        "Tandai order ini sebagai refund dan cabut layanannya? Uangnya tetap harus Anda kembalikan sendiri lewat dashboard gateway yang memprosesnya — BinderPay, atau Pakasir untuk order yang dibayar lewat Pakasir.",
      note: "Mencatat refund di sini TIDAK mengembalikan uang. Lakukan pengembaliannya di dashboard gateway yang memprosesnya (BinderPay, atau Pakasir untuk order yang dibayar lewat Pakasir), lalu tandai di sini agar laporan dan layanan ikut menyesuaikan.",
      okRevoked: "Order ditandai refund. Undangan dicabut (kedaluwarsa).",
      okStillPaid:
        "Order ditandai refund. Undangan TETAP aktif karena masih ada order lunas lain yang menopangnya.",
      okAlbumArchived:
        "Order add-on ditandai refund. Album Momen diarsipkan; undangan tidak disentuh.",
      notFound: "Order tidak ditemukan.",
      notPaid: "Hanya order berstatus Lunas yang bisa ditandai refund.",
      failed: "Gagal menandai refund. Coba lagi.",
    },
    invitations: {
      title: "Undangan",
      subtitle: "Semua undangan lintas pemilik.",
      searchPlaceholder: "Cari slug…",
      colSlug: "Slug",
      colCategory: "Kategori",
      colStatus: "Status",
      colOwner: "Pemilik",
      colActiveUntil: "Aktif hingga",
      colCreated: "Dibuat",
    },
    orders: {
      title: "Order",
      subtitle: "Semua pesanan pembayaran.",
      searchPlaceholder: "Cari kode order…",
      colCode: "Kode",
      colStatus: "Status",
      colAmount: "Nominal",
      colInvitation: "Undangan",
      colOwner: "Pemilik",
      colMethod: "Metode",
      colCreated: "Dibuat",
      colPaidAt: "Dibayar",
      colNotification: "Notifikasi",
      viewRaw: "Lihat payload",
      rawNone: "—",
    },
    users: {
      title: "Pengguna",
      subtitle:
        "Kelola peran & status akun. Cari berdasarkan email / nama. Peran Pro: aktivasi undangan & Album Momen tanpa bayar.",
      searchPlaceholder: "Cari email / nama…",
      colEmail: "Email",
      colName: "Nama",
      colPhone: "WhatsApp",
      colRole: "Peran",
      colStatus: "Status",
      colActions: "Aksi",
      colJoined: "Bergabung",
      roleAdmin: "Admin",
      roleClient: "Klien",
      rolePro: "Pro",
      statusActive: "Aktif",
      statusBanned: "Ditangguhkan",
      selfLabel: "Anda",
      roleSave: "Set peran",
      suspend: "Tangguhkan",
      reinstate: "Pulihkan",
    },
    detail: {
      title: "Detail undangan",
      sectionOwner: "Pemilik",
      sectionOrders: "Order",
      sectionActions: "Aksi",
      publicUrl: "URL publik",
      viewPublic: "Buka",
      activeUntil: "Aktif hingga",
      created: "Dibuat",
      category: "Kategori",
      ownerName: "Nama",
      ownerEmail: "Email",
      ownerPhone: "WhatsApp",
      ownerId: "User ID",
      ownerDeleted: "Akun sudah dihapus",
      noOrders: "Belum ada order.",
      // Aksi
      activateTitle: "Aktivasi manual",
      activateHint:
        "Aktifkan tanpa pembayaran online (mis. bayar di luar sistem). Hasil identik dengan aktivasi via pembayaran.",
      activateCta: "Aktifkan",
      choosePackage: "Pilih paket",
      extendTitle: "Perpanjang masa aktif",
      extendMonths: "Jumlah bulan (1–24)",
      extendCta: "Perpanjang",
      suspendTitle: "Suspend (konten bermasalah)",
      suspendReason: "Catatan internal (tidak dikirim ke pelanggan)",
      // Dua kolom, bukan satu yang dipakai dua kali: `reason` ditulis admin untuk
      // admin dan wajar memuat nama pelapor atau nomor pihak ketiga, sementara
      // kolom ini yang dikirim lewat email (DECISIONS #68).
      suspendPublicReason: "Alasan untuk pelanggan (dikirim via email)",
      suspendPublicHint:
        "Kosongkan bila belum ingin menjelaskan — emailnya tetap mengarahkan pelanggan untuk menghubungi kami.",
      suspendCta: "Suspend",
      reinstateTitle: "Batalkan suspend",
      reinstateHint: "Kembalikan undangan dari status ditangguhkan.",
      reinstateCta: "Reinstate",
      ownerTitle: "Ganti pemilik",
      ownerHint: "Pindahkan undangan (+ order) ke pengguna lain (isi User ID).",
      ownerNewId: "User ID pemilik baru",
      ownerCta: "Pindahkan",
      // Takedown musik unggahan (DECISIONS #121) — lebih ringan dari suspend:
      // undangan tetap tayang, hanya objek musiknya dihapus & unggah dikunci.
      musicTitle: "Musik unggahan (laporan hak cipta)",
      musicHint:
        "Hapus SEMUA berkas musik yang pernah diunggah di undangan ini dan kunci unggah musik. Undangan tetap tayang (kembali ke lagu pustaka/tanpa musik). Berkas berhenti tersaji dari cache paling lambat ±1 jam.",
      musicNone: "Tidak ada musik unggahan yang tersimpan.",
      musicLive: (n: number) => `${n} berkas musik unggahan tersimpan.`,
      musicCurrent: "Sedang dipakai:",
      musicLockedSince: (when: string) => `Unggah musik dikunci sejak ${when}.`,
      musicReason: "Catatan internal (boleh memuat identitas pelapor)",
      musicPublicReason: "Alasan untuk pelanggan (dikirim via email)",
      musicPublicHint:
        "Jangan cantumkan data pribadi pelapor. Kosongkan bila belum ingin menjelaskan — emailnya tetap mengarahkan pelanggan untuk menghubungi kami.",
      musicCta: "Hapus musik & kunci unggah",
      musicUnlockTitle: "Buka kunci unggah musik",
      musicUnlockHint:
        "Izinkan pemilik mengunggah musik lagi (mis. sanggahannya diterima dengan bukti lisensi).",
      musicUnlockCta: "Buka kunci",
    },
    packages: {
      title: "Paket",
      subtitle:
        "Ubah harga & limit. Perubahan langsung berlaku di landing & checkout (tanpa deploy).",
      code: "Kode",
      name: "Nama",
      price: "Harga (Rp)",
      duration: "Durasi (bulan)",
      active: "Aktif (tampil di checkout)",
      limitsTitle: "Limit",
      maxPhotos: "Maks foto",
      maxGuests: "Maks tamu",
      guestsUnlimited: "Tamu tanpa batas",
      // Satu flag untuk KEDUA sumber video (FASE J) — kuncinya tetap `youtube`.
      youtube: "Video (unggah & YouTube)",
      allThemes: "Semua tema",
      watermark: "Watermark",
      save: "Simpan paket",
    },
    themes: {
      title: "Tema",
      subtitle:
        "Metadata tema (kode tema tetap di repo). Atur nama, kategori, tier, urutan, status.",
      slug: "Slug (repo)",
      name: "Nama",
      categories: "Kategori",
      tier: "Tier",
      tierStandard: "Standar",
      tierPremium: "Premium",
      sortOrder: "Urutan",
      active: "Aktif (tampil di katalog)",
      save: "Simpan tema",
    },
    songs: {
      title: "Pustaka lagu",
      subtitle:
        "Musik latar yang bisa dipilih pemilik undangan. Klien memilih di langkah Pengaturan.",
      licenseNote:
        "Hanya unggah audio bebas-royalti / berlisensi. Anda bertanggung jawab atas hak pakai tiap trek — sistem tidak memverifikasi lisensi.",
      addTitle: "Tambah lagu",
      fieldTitle: "Judul lagu",
      fieldArtist: "Artis / kredit (opsional)",
      fieldFile: "Berkas audio (mp3/m4a/ogg, maks 8 MB)",
      add: "Unggah lagu",
      listTitle: "Lagu tersedia",
      colTitle: "Judul",
      colArtist: "Artis",
      active: "Aktif",
      inactive: "Nonaktif",
      activate: "Aktifkan",
      deactivate: "Nonaktifkan",
      delete: "Hapus",
      deleteConfirm: "Hapus lagu ini dari pustaka?",
      empty: "Belum ada lagu. Tambah lagu pertama di atas.",
    },
    msg: {
      pkg_ok: "Paket disimpan.",
      pkg_invalid: "Data paket tidak valid.",
      pkg_failed: "Gagal menyimpan paket.",
      theme_ok: "Tema disimpan.",
      theme_invalid: "Data tema tidak valid.",
      theme_failed: "Gagal menyimpan tema.",
      song_ok: "Lagu disimpan.",
      song_invalid:
        "Data lagu tidak valid (judul kosong / berkas bukan audio / terlalu besar).",
      song_failed: "Gagal menyimpan lagu.",
      song_deleted: "Lagu dihapus.",
      user_role_ok: "Peran pengguna diperbarui.",
      user_role_invalid: "Peran tidak valid.",
      user_role_self: "Tidak dapat mengubah peran akun Anda sendiri.",
      user_role_failed: "Gagal mengubah peran pengguna.",
      user_suspend_ok: "Akun ditangguhkan — pengguna tidak dapat login.",
      user_delete_ok:
        "Akun dihapus permanen. Riwayat pesanan dipertahankan ter-anonimisasi untuk pembukuan.",
      user_delete_has_active:
        "Akun ini masih punya undangan AKTIF. Tunggu masa aktifnya berakhir — tamunya sudah memegang tautannya.",
      user_delete_mismatch:
        "Email konfirmasi tidak cocok dengan akun yang dipilih. Tidak ada yang dihapus.",
      user_delete_invalid: "Alasan dan email konfirmasi wajib diisi.",
      user_delete_self: "Anda tidak bisa menghapus akun Anda sendiri.",
      user_delete_not_found: "Akun tidak ditemukan.",
      user_delete_auth_left:
        "Data pribadi sudah terhapus, tetapi baris login-nya gagal dihapus. Periksa Sentry dan hapus manual di dashboard Supabase.",
      user_delete_failed: "Gagal menghapus akun. Coba lagi.",
      user_suspend_self: "Tidak dapat menangguhkan akun Anda sendiri.",
      user_suspend_admin:
        "Turunkan peran admin ke klien dulu sebelum menangguhkan akun.",
      user_suspend_failed: "Gagal menangguhkan akun.",
      user_reinstate_ok: "Penangguhan akun dibatalkan.",
      user_reinstate_failed: "Gagal memulihkan akun.",
      activate_ok: "Undangan berhasil diaktifkan.",
      activate_ok_no_email:
        "Undangan berhasil diaktifkan, tetapi kuitansi TIDAK terkirim. Kabari pelanggan secara manual.",
      activate_invalid: "Pilihan paket tidak valid.",
      activate_draft_slug: "Atur alamat undangan (slug) dulu sebelum aktivasi.",
      activate_not_payable: "Undangan tidak dalam status yang bisa diaktifkan.",
      activate_pkg: "Paket tidak tersedia.",
      activate_failed: "Gagal mengaktifkan undangan.",
      extend_ok: "Masa aktif diperpanjang.",
      extend_invalid: "Jumlah bulan tidak valid (1–24).",
      extend_not_extendable:
        "Hanya undangan aktif/kedaluwarsa yang bisa diperpanjang.",
      extend_failed: "Gagal memperpanjang masa aktif.",
      suspend_ok: "Undangan ditangguhkan. Email pemberitahuan terkirim.",
      suspend_ok_no_email:
        "Undangan ditangguhkan, tetapi email pemberitahuan TIDAK terkirim. Kabari pemilik secara manual.",
      refund_ok_revoked:
        "Order ditandai refund. Undangan dicabut (kedaluwarsa). Kembalikan uangnya di dashboard gateway yang memprosesnya (BinderPay, atau Pakasir untuk order yang dibayar lewat Pakasir) bila belum.",
      refund_ok_still_paid:
        "Order ditandai refund. Undangan TETAP aktif karena masih ada order lunas lain yang menopangnya.",
      refund_ok_album:
        "Order add-on ditandai refund. Album Momen diarsipkan; undangan tidak disentuh.",
      refund_ok_downgraded:
        "Order upgrade ditandai refund. Paket undangan diturunkan kembali; masa aktifnya tidak disentuh.",
      refund_not_found: "Order tidak ditemukan.",
      refund_not_paid: "Hanya order berstatus Lunas yang bisa ditandai refund.",
      refund_invalid: "Alasan refund wajib diisi.",
      refund_failed: "Gagal menandai refund. Coba lagi.",
      suspend_invalid: "Alasan wajib diisi.",
      suspend_failed: "Gagal menangguhkan undangan.",
      reinstate_ok: "Penangguhan dibatalkan. Email pemberitahuan terkirim.",
      reinstate_ok_no_email:
        "Penangguhan dibatalkan, tetapi email pemberitahuan TIDAK terkirim. Kabari pemilik secara manual.",
      reinstate_not_suspended: "Undangan tidak sedang ditangguhkan.",
      reinstate_failed: "Gagal membatalkan penangguhan.",
      owner_ok: "Kepemilikan diperbarui.",
      owner_invalid: "User ID tidak valid.",
      owner_user_not_found: "Pengguna tujuan tidak ditemukan.",
      owner_failed: "Gagal mengganti pemilik.",
      music_ok:
        "Musik unggahan dihapus dan unggah musik dikunci. Email pemberitahuan terkirim.",
      music_ok_no_email:
        "Musik unggahan dihapus dan unggah musik dikunci, tetapi email pemberitahuan TIDAK terkirim. Kabari pemilik secara manual.",
      music_ok_partial:
        "Musik dinonaktifkan (tak lagi diputar) dan unggah dikunci, tetapi sebagian berkas gagal dihapus dari storage. Path-nya tercatat di Sentry — hapus manual.",
      music_invalid: "Catatan internal wajib diisi.",
      music_failed: "Gagal menghapus musik unggahan.",
      music_unlock_ok: "Kunci unggah musik dibuka.",
      music_unlock_not_locked:
        "Unggah musik di undangan ini tidak sedang dikunci.",
      music_unlock_failed: "Gagal membuka kunci unggah musik.",
    },
  },
  // Halaman marketing publik (SPEC §4.1): landing, katalog tema, harga, FAQ,
  // kebijakan privasi & refund. Statis + ISR; harga/tema selalu dari DB.
  marketing: {
    // Atribusi foto demo Pexels (lisensi: tautan Pexels + kredit fotografer).
    pexels: {
      by: "Foto contoh oleh",
      via: "via",
      label: "Pexels",
    },
    nav: {
      themes: "Tema",
      pricing: "Harga",
      faq: "FAQ",
      login: "Masuk",
      cta: "Buat Undangan",
      menu: "Menu",
      close: "Tutup",
      home: "Beranda",
    },
    hero: {
      eyebrow: "Undangan digital & buku tamu",
      titleLead: "Undangan digital untuk",
      titleAccent: "setiap momen bahagia",
      subtitle:
        "Pernikahan, acara korporat, hingga syukuran keluarga — rancang undangan yang elegan, sebar lewat WhatsApp, dan kumpulkan RSVP dalam satu tempat.",
      ctaPrimary: "Buat undangan gratis",
      ctaSecondary: "Jelajahi tema",
      note: "Gratis dibuat & dipreview. Bayar hanya saat siap disebar.",
    },
    // Sinyal kepercayaan berbasis fakta (bukan logo/testimoni palsu).
    trust: [
      "Dioptimalkan untuk WhatsApp",
      "RSVP + amplop digital",
      "Link personal per tamu",
      "Bayar pakai QRIS",
    ],
    how: {
      eyebrow: "Cara kerja",
      title: "Dari ide ke tersebar dalam tiga langkah",
      subtitle:
        "Tidak perlu desainer, tidak perlu aplikasi. Semua dari HP Anda.",
      steps: [
        {
          title: "Pilih tema & isi konten",
          body: "Pilih kategori acara dan tema, lalu isi form terpandu: mempelai, jadwal, galeri, cerita, dan amplop digital. Tersimpan otomatis.",
        },
        {
          title: "Preview gratis di HP",
          body: "Lihat hasil nyata undangan dalam bingkai ponsel sebelum membayar. Sesuaikan hingga pas.",
        },
        {
          title: "Aktifkan & sebar via WhatsApp",
          body: "Bayar sekali untuk mengaktifkan, tetapkan alamat undangan, lalu kirim link personal ke tiap tamu lewat WhatsApp.",
        },
      ],
    },
    themes: {
      eyebrow: "Katalog tema",
      title: "Tema untuk setiap acara",
      subtitle:
        "Setiap tema punya demo hidup berisi data contoh — bukan sekadar gambar. Buka, gulir, dan rasakan sebelum memilih.",
      all: "Lihat semua tema",
      demo: "Lihat demo",
      preview: "Preview",
      useTheme: "Gunakan Tema",
      demoOf: (name: string) => `Lihat demo tema ${name}`,
      // Judul kartu varian `/tema` + plakat pratinjaunya (THEME-WAVE3 §4).
      variantTitle: (theme: string, variant: string) => `${theme} — ${variant}`,
      soon: "Demo segera hadir",
      tierPremium: "Premium",
      tierStandard: "Standar",
      universal: "Universal",
      filterAll: "Semua",
      filterLabel: "Saring per kategori acara",
      empty: "Belum ada tema pada kategori ini.",
      // Satuan (bukan fungsi) agar bisa dilewatkan sebagai prop ke komponen client
      // tanpa menyeret seluruh objek `copy` ke bundel /tema. Kartu /tema = tema ×
      // varian (THEME-WAVE3 §4), jadi yang dihitung desain, bukan tema.
      countUnit: "pilihan desain",
    },
    features: {
      eyebrow: "Kenapa Merriva",
      title: "Dibuat untuk cara tamu Indonesia membuka undangan",
      items: [
        {
          title: "Mulus di WhatsApp",
          body: "Mayoritas tamu membuka undangan dari dalam WhatsApp. Halaman kami ringan dan cepat terbuka di sana — bukan hanya di browser desktop.",
        },
        {
          title: "RSVP, ucapan & amplop digital",
          body: "Satu form untuk konfirmasi kehadiran, ucapan & doa, plus amplop digital (transfer/kado) yang bersifat privat — hanya Anda yang melihatnya.",
        },
        {
          title: "Link personal per tamu",
          body: "Setiap tamu menerima link berisi namanya, dengan RSVP terisi otomatis. Sebar satu per satu lewat wa.me langsung dari HP Anda.",
        },
        {
          title: "Gratis dicoba dulu",
          body: "Buat dan preview undangan tanpa biaya. Pembayaran baru diminta saat Anda siap mengaktifkan dan menyebarkannya.",
        },
      ],
    },
    pricing: {
      eyebrow: "Harga",
      title: "Sekali bayar, aktif berbulan-bulan",
      subtitle:
        "Tanpa langganan. Pilih paket saat siap menyebarkan undangan Anda.",
      popular: "Terpopuler",
      cta: "Pilih paket ini",
      ctaGeneric: "Mulai buat undangan",
      seeAll: "Bandingkan paket selengkapnya",
      note: "Undangan gratis dibuat & dipreview — Anda hanya membayar saat mengaktifkan.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Pertanyaan yang sering diajukan",
      subtitle: "Belum terjawab? Hubungi kami — kami senang membantu.",
      more: "Lihat semua pertanyaan",
      items: [
        {
          q: "Apa itu Merriva?",
          a: "Platform undangan digital sekaligus buku tamu digital untuk pernikahan, acara korporat, dan acara keluarga. Anda membuat undangan sendiri, menyebarkannya lewat WhatsApp, dan mengelola RSVP dari satu dashboard.",
        },
        {
          q: "Apakah gratis?",
          a: "Membuat dan mem-preview undangan sepenuhnya gratis. Pembayaran hanya diminta saat Anda ingin mengaktifkan dan menyebarkan undangan — sekali bayar, bukan langganan.",
        },
        {
          q: "Berapa lama undangan tetap aktif?",
          a: "Sesuai paket: Basic aktif 6 bulan, Premium aktif 12 bulan sejak diaktifkan. Masa aktif bisa diperpanjang kapan pun sebelum atau sesudah berakhir.",
        },
        {
          q: "Bagaimana tamu membuka undangan?",
          a: "Lewat tautan seperti merriva.id/nama-anda yang bisa dibuka langsung di WhatsApp. Untuk tiap tamu, Anda bisa mengirim link personal berisi namanya, dengan form RSVP yang sudah terisi otomatis.",
        },
        {
          q: "Metode pembayaran apa saja yang didukung?",
          a: "QRIS dari e-wallet atau m-banking apa pun, diproses secara aman lewat BinderPay. Kami tidak menyimpan data kartu atau rekening Anda.",
        },
        {
          q: "Bisakah saya mengedit undangan setelah aktif?",
          a: "Bisa. Konten undangan dapat diperbarui kapan saja. Hanya alamat undangan (slug) yang dikunci — bisa diganti maksimal satu kali setelah aktif agar tautan yang sudah tersebar tidak rusak.",
        },
        {
          q: "Apakah data tamu dan amplop saya aman?",
          a: "Ya. Daftar tamu, RSVP, dan konfirmasi amplop bersifat privat — hanya Anda yang dapat melihatnya di dashboard. Tidak pernah ditampilkan di halaman publik.",
        },
        {
          q: "Apakah bisa pakai lagu favorit saya?",
          // DECISIONS #121: dijawab tegas, tanpa nada jualan. Unggahan hanya
          // sah bila pemiliknya memegang hak/izin; selebihnya dilarang.
          a: "Semua paket dapat memilih lagu dari koleksi instrumental bebas royalti bawaan Merriva. Undangan Premium juga dapat mengunggah satu lagu MP3 sendiri, tetapi hanya bila Anda memegang haknya atau sudah mendapat izin pemegang hak cipta, misalnya rekaman Anda sendiri atau musik berlisensi. Lagu komersial dari Spotify, YouTube, atau unduhan lain tanpa izin tertulis pemegang haknya dilarang, dan musik yang dilaporkan melanggar dapat kami hapus.",
        },
        {
          q: "Perlu mengunduh aplikasi?",
          a: "Tidak. Semuanya berjalan di browser — baik untuk Anda membuat undangan maupun untuk tamu membukanya.",
        },
        {
          q: "Bagaimana kebijakan pengembalian dana?",
          a: "Undangan adalah layanan digital yang langsung aktif setelah pembayaran, sehingga umumnya tidak dapat dikembalikan. Kendala teknis dan pembayaran ganda ditangani kasus per kasus. Selengkapnya di halaman Kebijakan Refund.",
        },
      ],
    },
    finalCta: {
      title: "Siap membuat undangan pertama Anda?",
      subtitle:
        "Gratis untuk dicoba. Rasakan hasilnya dulu, bayar saat benar-benar siap.",
      cta: "Buat undangan gratis",
      secondary: "Lihat harga",
    },
    footer: {
      tagline: "Undangan digital & buku tamu untuk setiap momen bahagia.",
      madeIn: "Dibuat untuk pasar Indonesia.",
      colProduct: "Produk",
      colCompany: "Merriva",
      colLegal: "Legal",
      rights: (year: number) => `© ${year} Merriva. Semua hak dilindungi.`,
    },
    pages: {
      themes: {
        title: "Katalog Tema",
        subtitle:
          "Tiap tema hadir dalam beberapa varian warna terkurasi, lintas tiga kategori acara. Buka demo hidup masing-masing tanpa perlu masuk.",
      },
      pricing: {
        title: "Harga",
        subtitle:
          "Sekali bayar untuk mengaktifkan undangan. Tanpa langganan, tanpa biaya tersembunyi.",
        comparisonTitle: "Perbandingan lengkap",
        featureCol: "Fitur",
        compare: {
          price: "Harga",
          duration: "Masa aktif",
          photos: "Galeri foto",
          guests: "Daftar tamu + link WA personal",
          themes: "Pilihan tema",
          youtube: "Video (unggah klip atau YouTube)",
          rsvp: "RSVP, ucapan & amplop digital",
          watermark: "Watermark footer",
          months: (n: number) => `${n} bulan`,
          photosVal: (n: number) => `${n} foto`,
          guestsUnlimited: "Tanpa batas",
          guestsVal: (n: number) => `${n} tamu`,
          themesAll: "Semua tema",
          themesStd: "Tema standar",
          watermarkYes: "Ada (kecil)",
          watermarkNo: "Tanpa watermark",
        },
      },
      faq: {
        title: "Pertanyaan yang Sering Diajukan",
        subtitle:
          "Hal-hal yang paling sering ditanyakan sebelum membuat undangan.",
      },
    },
    // Halaman legal. Ketentuan refund adalah draf standar produk digital —
    // pemilik wajib meninjau/menyesuaikan (SPEC §11: refund kasus per kasus).
    legal: {
      contactEmail: SUPPORT_EMAIL,
      // Identitas pelaku usaha (AUDIT-2026-10-01 A2). PP 80/2019 & Permendag
      // 31/2020 mewajibkan identitas ditampilkan SEBELUM pembayaran, dan
      // aggregator pembayaran rutin menangguhkan merchant yang tak punya.
      //
      // Keputusan pemilik (2026-10-03): jalan dulu sebagai USAHA PERSEORANGAN.
      // SATU sumber untuk /syarat, /privasi, /refund, dan kuitansi — mengisi di
      // sini mengisi semuanya. Nilai kosong TIDAK dirender (halaman tetap benar),
      // tetapi `name` + `address` WAJIB terisi sebelum menerima uang pertama;
      // butirnya ada di LAUNCH-CHECKLIST Fase 8.
      merchantHeading: "Identitas pelaku usaha",
      merchantOwner: "Penanggung jawab",
      merchantAddress: "Alamat",
      merchantTaxId: "NPWP/NIB",
      merchant: {
        form: "Usaha perseorangan",
        name: "Merriva",
        owner: "Muthalib",
        address:
          "Jl. Bougenvile Blok IW No.15, RT.6/RW.5, Klp. Dua Wetan, Kec. Ciracas, Kota Jakarta Timur, Daerah Khusus Ibukota Jakarta 13730",
        // Belum punya NPWP/NIB (pemilik, 15 Okt 2026). Dibiarkan KOSONG, bukan
        // diisi "-": field kosong memang tak dirender, sedangkan "-" akan
        // terbit sebagai baris "NPWP/NIB: -" yang tak memberi tahu apa pun.
        taxId: "",
      },
      // Tanggalnya ikut berubah setiap ISI halaman legal berubah. 15 Okt 2026:
      // identitas pelaku usaha terbit. 9 Nov 2026: musik unggahan (DECISIONS
      // #121) — klausul konten/lisensi/ganti rugi, takedown musik, bagian
      // "Laporan pelanggaran hak cipta" di /syarat, dan catatan unggah musik +
      // data pelapor di /privasi. (Satu tanggal untuk ketiga halaman.)
      updated: "Terakhir diperbarui 9 November 2026",
      backHome: "Kembali ke beranda",
      contactHeading: "Hubungi kami",
      contactBody: "Ada pertanyaan tentang halaman ini? Email kami di",
      privacy: {
        title: "Kebijakan Privasi",
        intro:
          "Merriva menghargai privasi Anda. Kebijakan ini menjelaskan data yang kami kumpulkan, cara kami menggunakannya, dan hak Anda atas data tersebut.",
        sections: [
          {
            heading: "Data yang kami kumpulkan",
            body: [
              "Data akun: nama, alamat email, dan nomor WhatsApp (opsional) yang Anda berikan saat mendaftar.",
              "Konten undangan: teks, foto, musik dan video yang Anda unggah, jadwal acara, dan detail lain yang Anda masukkan.",
              "Data tamu: nama, nomor WhatsApp, status kehadiran (RSVP), dan ucapan — baik yang Anda tambahkan maupun yang diisi tamu.",
              "Album Momen (bila diaktifkan): foto yang diunggah tamu dari kameranya, nama tampilan yang tamu isi sendiri, serta pengenal perangkat acak yang disimpan di peramban tamu untuk menghitung kuota peserta. Foto dapat memuat wajah tamu dan orang lain yang ada di acara.",
              "Data teknis: alamat IP, jenis perangkat, cookie sesi yang menjaga Anda tetap masuk, dan — khusus Album Momen — cookie sesi tamu bertanda tangan serta pengenal perangkat di penyimpanan lokal peramban (bukan cookie).",
              // DECISIONS #121 — tabel `music_uploads` (akun, waktu, sha256,
              // ukuran, durasi, attest_version) dan laporan yang masuk lewat email.
              "Catatan unggah musik (bila Anda mengunggah lagu sendiri): akun pengunggah, waktu unggah, sidik digital berkas, ukuran, durasi, dan versi pernyataan hak yang Anda centang.",
              "Laporan pelanggaran hak cipta: identitas dan kontak pelapor serta isi laporan yang dikirim ke alamat kontak kami.",
            ],
          },
          {
            heading: "Cara kami menggunakan data",
            body: [
              "Menyediakan dan mengoperasikan layanan undangan digital Anda.",
              "Memproses pembayaran dan mengirim kuitansi.",
              "Mengirim notifikasi penting, seperti pengingat masa aktif undangan.",
              "Menjaga keamanan layanan dan mencegah penyalahgunaan.",
              "Menangani laporan pelanggaran hak cipta atas konten yang diunggah, termasuk memberi tahu pengunggahnya.",
            ],
          },
          {
            heading: "Pihak ketiga (pemroses data)",
            body: [
              "Supabase — hosting basis data dan autentikasi.",
              "BinderPay — pemroses pembayaran (QRIS). Kami tidak menyimpan data kartu atau rekening pembayaran Anda.",
              "Resend — pengiriman email transaksional (kuitansi & pengingat).",
              "Cloudflare Turnstile — perlindungan anti-bot pada formulir publik.",
              "Sentry — pemantauan galat & kinerja pada versi produksi. Laporan galat disaring lebih dulu: token tamu, cookie, header, dan isi formulir dibuang sebelum dikirim.",
              // Backup media harian (DECISIONS #117). Pemroses yang tak dinamai
              // adalah pelanggaran (#58) — foto Album Momen memuat wajah tamu.
              "Cloudflare R2 — penyimpanan salinan cadangan foto & media (terenkripsi saat disimpan, kawasan Asia-Pasifik), terhapus otomatis sekitar 30 hari setelah dibuat.",
              "Masing-masing memproses data sesuai kebijakan privasinya sendiri.",
            ],
          },
          {
            heading: "Tempat data diproses",
            body: [
              "Basis data dan penyimpanan berkas kami berada di pusat data Singapura; salinan cadangan berkas disimpan di kawasan Asia-Pasifik. Layanan email, anti-bot, dan pemantauan galat yang kami gunakan juga memproses data di luar Indonesia.",
              "Kami memilih penyedia yang menerapkan enkripsi saat transit maupun saat disimpan, serta terikat kebijakan privasinya masing-masing.",
            ],
          },
          {
            heading: "Cookie",
            body: [
              "Kami hanya menggunakan cookie esensial untuk menjaga sesi login Anda. Tidak ada cookie iklan atau pelacakan pihak ketiga.",
            ],
          },
          {
            heading: "Penyimpanan & retensi data",
            body: [
              "Data disimpan selama akun dan undangan Anda aktif.",
              "Undangan yang telah kedaluwarsa tetap kami simpan hingga 6 bulan agar dapat Anda perpanjang, setelah itu dapat dihapus.",
              "Salinan cadangan foto & media kami simpan untuk pemulihan bencana dan terhapus otomatis sekitar 30 hari setelah dibuat, termasuk salinan data yang sudah dihapus.",
              "Anda dapat meminta penghapusan akun dan data kapan saja lewat alamat kontak di bawah. Permintaan diverifikasi ke alamat email akun Anda sendiri sebelum dijalankan.",
              "Pengecualian: catatan pesanan (nomor order, nominal, tanggal) tetap kami simpan untuk kewajiban pembukuan, tetapi sudah tidak lagi tertaut pada identitas Anda.",
              // DECISIONS #121: baris `music_uploads` & `admin_logs` takedown
              // bertahan selama kerangka undangan ada; FK user_id SET NULL saat
              // hapus akun. Berkas musiknya sendiri ikut retensi undangan.
              "Catatan unggah musik (akun pengunggah, waktu, sidik berkas, versi pernyataan hak) beserta catatan tindakan kami atas laporan pelanggaran kami simpan selama undangan yang bersangkutan masih tercatat di sistem kami, untuk menangani klaim hak cipta. Catatan ini tidak memuat isi berkasnya, dan sesudah akun Anda dihapus tidak lagi tertaut pada identitas Anda. Berkas musiknya sendiri ikut dihapus bersama data undangan lainnya.",
              "Data pelapor pelanggaran hak cipta hanya kami pakai untuk menangani laporannya dan tidak kami teruskan kepada pengunggah tanpa izin pelapor, kecuali bila diwajibkan peraturan perundang-undangan atau diminta pihak berwenang.",
            ],
          },
          {
            heading: "Keamanan",
            body: [
              "Akses ke data dibatasi pada tingkat baris (row-level security) sehingga pengguna hanya dapat mengakses datanya sendiri. Seluruh koneksi terenkripsi (HTTPS).",
            ],
          },
          {
            heading: "Dasar pemrosesan",
            body: [
              "Data akun dan undangan kami proses untuk menjalankan layanan yang Anda beli — yaitu pelaksanaan perjanjian antara Anda dan Merriva.",
              "Catatan pembayaran kami simpan untuk memenuhi kewajiban hukum di bidang pembukuan dan perpajakan.",
              "Catatan unggah musik dan laporan pelanggaran hak cipta kami proses untuk menangani klaim pihak lain atas konten yang diunggah, sebagai kepentingan yang sah.",
            ],
          },
          {
            heading: "Hak Anda",
            body: [
              "Anda berhak mengakses, memperbaiki, dan menghapus data pribadi Anda, serta meminta salinannya. Hubungi kami lewat alamat di bawah untuk menggunakan hak-hak ini.",
            ],
          },
          {
            heading: "Peran kami atas data tamu",
            body: [
              "Atas data tamu — nama, nomor WhatsApp, RSVP, ucapan, catatan amplop, dan foto Album Momen — Anda bertindak sebagai pengendali data: Andalah yang menentukan siapa diundang dan untuk apa datanya dipakai.",
              "Merriva bertindak sebagai pemroses: kami hanya menyimpan dan menampilkan data itu untuk menjalankan undangan Anda, tidak memakainya untuk tujuan kami sendiri, dan tidak menjualnya kepada siapa pun.",
              "Anda bertanggung jawab memastikan Anda berhak membagikan data tamu kepada kami. Kami bertanggung jawab menjaganya, menghapusnya saat diminta, dan memberi tahu Anda bila terjadi insiden.",
            ],
          },
          {
            heading: "Perubahan kebijakan",
            body: [
              "Kebijakan ini dapat diperbarui dari waktu ke waktu. Perubahan penting akan kami beritahukan melalui layanan atau email.",
            ],
          },
        ],
      },
      // Syarat & Ketentuan (AUDIT-2026-10-01 A2). Sebelum ini TIDAK ADA sama
      // sekali: tak ada dasar kontraktual untuk hal yang kodenya sudah kerjakan
      // — masa aktif berakhir, purge 6 bulan, penangguhan konten oleh admin,
      // dan penolakan refund setelah aktivasi.
      //
      // Setiap klausul di bawah MENCERMINKAN perilaku kode yang sudah ada.
      // Bila kelak perilakunya berubah, teks ini ikut diubah — kebijakan yang
      // menjanjikan hal yang tak dilakukan produknya adalah masalah yang lebih
      // besar daripada tak punya kebijakan (pelajaran dari /privasi, #58).
      terms: {
        title: "Syarat & Ketentuan",
        intro:
          "Dengan membuat akun atau membeli paket di Merriva, Anda menyetujui ketentuan di bawah ini. Mohon dibaca sebelum melakukan pembayaran.",
        sections: [
          {
            heading: "Layanan yang kami sediakan",
            body: [
              "Merriva menyediakan undangan digital yang dapat Anda isi sendiri, beserta halaman publik, buku tamu (RSVP & ucapan), amplop digital, dan — bila dibeli terpisah — add-on Album Momen.",
              "Layanan diberikan apa adanya pada saat Anda membelinya. Fitur dapat bertambah atau berubah; kami tidak mengurangi fitur yang sudah melekat pada paket yang telah Anda bayar selama masa aktifnya.",
            ],
          },
          {
            heading: "Akun Anda",
            body: [
              "Anda bertanggung jawab menjaga kerahasiaan kata sandi akun Anda. Seluruh aktivitas dari akun Anda dianggap dilakukan oleh Anda.",
              "Satu akun untuk satu orang atau satu usaha. Beri tahu kami segera bila Anda menduga akun Anda diakses pihak lain.",
            ],
          },
          {
            heading: "Masa aktif & kedaluwarsa",
            body: [
              "Masa aktif dihitung sejak pembayaran dikonfirmasi, dengan durasi sesuai paket yang Anda beli.",
              "Setelah masa aktif berakhir, halaman undangan berhenti tayang untuk tamu dan statusnya menjadi kedaluwarsa. Isi undangan tetap tersimpan dan dapat Anda aktifkan kembali dengan memperpanjang.",
              // Riwayat kalimat ini layak disimpan karena ia dua kali hampir menjadi
              // janji yang tak ditepati. Versi pertama menyuruh "unduh yang Anda
              // perlukan" untuk SEMUA butir termasuk foto galeri — padahal tak ada
              // tombol unduh galeri. #66 membuatnya jujur dengan mengakui ketiadaan
              // itu. #70 akhirnya membangun unduhannya, jadi kalimatnya kembali
              // menyebut galeri — TETAPI dengan batas yang tetap benar: yang kami
              // simpan hanya varian 1600 px, karena foto dikompres di browser dan
              // berkas kamera aslinya tak pernah sampai ke server (SPEC §4.4).
              // Menyebut "foto galeri bisa diunduh" tanpa batas itu akan menjadi
              // janji ketiga yang salah.
              "Enam bulan setelah masa aktif berakhir, data pribadi pada undangan tersebut — daftar tamu, RSVP, ucapan, catatan amplop, foto galeri, dan foto Album Momen — dihapus permanen dan tidak dapat dipulihkan; salinan cadangannya ikut musnah otomatis sekitar 30 hari kemudian. Sebelum tenggat itu Anda dapat mengunduh seluruhnya dari dashboard: daftar tamu beserta RSVP, catatan amplop, foto Album Momen, dan foto galeri sebagai berkas ZIP. Khusus foto galeri, yang kami simpan dan berikan adalah versi 1600 piksel yang tampil di undangan — foto dikompres di perangkat Anda sebelum diunggah sehingga berkas asli dari kamera tidak pernah kami terima; simpan aslinya sendiri.",
            ],
          },
          {
            heading: "Batas paket",
            body: [
              "Setiap paket memiliki batas jumlah tamu dan jumlah foto yang ditegakkan sistem, bukan sekadar ditampilkan di layar.",
              "Batas itu berlaku pada undangan yang bersangkutan selama masa aktifnya. Lihat halaman Harga untuk rincian paket yang berlaku saat ini.",
            ],
          },
          {
            heading: "Konten Anda",
            body: [
              "Isi undangan tetap milik Anda. Kami hanya menyimpan dan menampilkannya untuk menjalankan layanan Anda, dan tidak memakainya untuk tujuan lain.",
              // DECISIONS #121 (musik unggahan Premium). Lisensi SEMPIT, sengaja
              // tak seluas pesaing ("tak dapat dicabut"); berakhir bersama
              // kontennya — cocok dengan purge & takedown yang dijalankan kode.
              "Atas setiap konten yang Anda unggah, Anda memberi Merriva izin terbatas untuk menyimpan dan menayangkannya di undangan Anda selama layanan berjalan, tidak untuk keperluan lain. Izin itu berakhir saat konten dihapus. Berkas video dan musik yang Anda unggah ikut terhapus bersama data undangan saat masa retensinya berakhir, jadi simpan berkas aslinya sendiri.",
              "Anda menjamin berhak menggunakan setiap foto, video, musik, dan teks yang Anda unggah. Musik yang Anda unggah harus berupa rekaman milik Anda sendiri, musik berlisensi yang boleh dipakai untuk undangan, atau lagu yang izin pemegang hak ciptanya Anda pegang. Lagu komersial yang diambil dari Spotify, YouTube, atau unduhan lain tanpa izin tertulis pemegang haknya dilarang.",
              // Ganti rugi DIBATASI pada pelanggaran pengguna sendiri, dan tak
              // boleh dibaca sebagai pengalihan tanggung jawab Merriva (klausul
              // baku terlarang, UUPK Pasal 18 — batal demi hukum).
              "Bila pihak lain menuntut Merriva karena konten yang Anda unggah melanggar haknya, Anda bertanggung jawab atas klaim tersebut sebatas yang timbul dari pelanggaran Anda sendiri, tanpa mengurangi hak konsumen yang dijamin peraturan perundang-undangan.",
              "Dilarang mengunggah konten yang melanggar hukum Indonesia, menyinggung SARA, bermuatan pornografi, menipu, atau menyamar sebagai orang atau lembaga lain.",
            ],
          },
          {
            heading: "Data tamu Anda",
            body: [
              "Anda bertindak sebagai pengendali data atas nama, nomor WhatsApp, RSVP, ucapan, catatan amplop, dan foto Album Momen milik tamu Anda; Merriva bertindak sebagai pemroses.",
              "Anda bertanggung jawab memastikan Anda berhak membagikan data tamu kepada kami untuk keperluan undangan Anda. Rinciannya ada di Kebijakan Privasi.",
            ],
          },
          {
            heading: "Penangguhan & penghentian",
            body: [
              "Kami dapat menangguhkan undangan yang dilaporkan atau kami temukan melanggar ketentuan konten di atas. Penangguhan membuat halaman berhenti tayang; isinya tidak dihapus.",
              "Sedapat mungkin kami memberi tahu Anda lebih dulu dan memberi kesempatan memperbaiki, kecuali bila konten tersebut melanggar hukum atau membahayakan pihak lain.",
              // DECISIONS #121 — cermin `admin_takedown_custom_music`: objek musik
              // dihapus, `music_locked_at` diisi, undangan TIDAK ditangguhkan,
              // email `musicRemoved` dikirim. Kunci berlaku SAMPAI ADMIN
              // MEMBUKANYA (`admin_unlock_custom_music`), bukan "selama
              // ditinjau". Sengaja tanpa klausul penolakan refund (klausula
              // baku terlarang, UUPK Pasal 18 ayat 3); refund mengikuti /refund.
              "Atas laporan pelanggaran hak cipta, kami dapat menghapus musik yang Anda unggah tanpa menangguhkan undangan. Undangan tetap tayang dengan lagu pilihan Anda dari pustaka Merriva (atau tanpa musik), dan unggah musik di undangan itu kami kunci sampai kami membukanya kembali (misalnya setelah sanggahan Anda kami terima). Kami memberi tahu Anda lewat email beserta cara menyanggahnya. Penghapusan ini tidak mengubah masa aktif maupun fitur lain undangan Anda; pengembalian dana tetap mengikuti Kebijakan Refund.",
              "Anda dapat berhenti kapan saja dengan tidak memperpanjang, atau meminta penghapusan akun lewat alamat kontak kami.",
            ],
          },
          // Sarana pelaporan publik (Permenkominfo 5/2020 Pasal 10 ayat 2;
          // DECISIONS #121). Jalur v1 = email; form + Turnstile ditunda.
          // Tenggat "paling lambat 2 hari kerja" = janji yang dijalankan
          // prosedur `docs/RUNBOOK.md` — ubah keduanya bersamaan.
          {
            heading: "Laporan pelanggaran hak cipta",
            id: "laporan-hak-cipta",
            body: [
              `Bila Anda pemegang hak cipta, atau kuasanya, dan menemukan musik atau konten lain di undangan Merriva yang memakai karya Anda tanpa izin, kirim laporan ke ${SUPPORT_EMAIL}.`,
              "Sertakan identitas dan kontak Anda, karya yang Anda klaim beserta bukti hak atasnya, tautan undangan yang dimaksud, serta pernyataan bahwa laporan dibuat dengan itikad baik dan isinya benar.",
              "Laporan yang lengkap kami tindak segera, paling lambat 2 hari kerja, misalnya dengan menghapus musik yang dilaporkan. Laporan yang belum lengkap kami balas untuk meminta kelengkapannya.",
              "Pengunggah kami beri tahu dan dapat menyanggah dengan bukti lisensi atau izin pemegang hak. Bila sanggahannya terbukti, kami pulihkan kemampuan unggahnya. Data pribadi pelapor tidak kami teruskan kepada pengunggah tanpa izin pelapor.",
              "Pengguna yang berulang kali melanggar dapat kami tangguhkan undangannya atau akunnya.",
            ],
          },
          {
            heading: "Pembayaran",
            body: [
              "Harga yang berlaku adalah yang tertera saat Anda melakukan pembayaran. Seluruh nominal dalam Rupiah.",
              "Pembayaran diproses penyedia pembayaran pihak ketiga. Kami tidak menyimpan data kartu atau rekening Anda.",
              "Undangan menjadi aktif setelah pembayaran terkonfirmasi. Bila dana sudah terdebit tetapi undangan belum aktif, hubungi kami dengan menyertakan kode order Anda.",
            ],
          },
          {
            heading: "Pengembalian dana",
            body: [
              "Ketentuan pengembalian dana diatur terpisah di halaman Kebijakan Refund dan merupakan bagian tak terpisahkan dari Syarat & Ketentuan ini.",
            ],
          },
          {
            heading: "Ketersediaan layanan",
            body: [
              "Kami berusaha menjaga layanan tetap tersedia, tetapi tidak menjanjikan layanan bebas gangguan. Pemeliharaan terjadwal akan kami beritahukan bila memungkinkan.",
              "Gangguan dapat berasal dari pihak ketiga yang kami gunakan — penyedia hosting, pembayaran, atau jaringan — yang berada di luar kendali kami.",
            ],
          },
          {
            heading: "Batas tanggung jawab",
            body: [
              "Tanggung jawab Merriva atas klaim apa pun yang timbul dari layanan ini dibatasi paling banyak sebesar biaya paket yang Anda bayarkan untuk undangan yang bersangkutan.",
              "Kami tidak bertanggung jawab atas kerugian tidak langsung, termasuk kerugian akibat terganggunya acara, kehilangan kesempatan, atau kerugian reputasi.",
              "Batasan ini tidak mengurangi hak Anda yang dijamin peraturan perundang-undangan yang bersifat memaksa.",
            ],
          },
          {
            heading: "Perubahan ketentuan",
            body: [
              "Ketentuan ini dapat diperbarui. Perubahan yang berdampak material akan kami beritahukan melalui layanan atau email sebelum berlaku.",
              "Pembelian yang sudah berjalan tetap tunduk pada ketentuan yang berlaku saat pembayaran dilakukan.",
            ],
          },
          {
            heading: "Hukum yang berlaku",
            body: [
              "Ketentuan ini tunduk pada hukum Republik Indonesia. Setiap perselisihan diupayakan diselesaikan secara musyawarah lebih dulu melalui alamat kontak kami.",
            ],
          },
        ],
      },
      refund: {
        title: "Kebijakan Refund",
        intro:
          "Undangan digital adalah layanan yang langsung aktif setelah pembayaran. Berikut ketentuan pengembalian dana kami.",
        sections: [
          {
            heading: "Sebelum pembayaran",
            body: [
              "Membuat dan mem-preview undangan sepenuhnya gratis. Selama Anda belum membayar, tidak ada biaya apa pun yang dikenakan.",
            ],
          },
          {
            heading: "Setelah aktivasi",
            body: [
              "Karena layanan langsung diberikan begitu pembayaran berhasil — undangan aktif dan dapat langsung disebar — pembayaran pada umumnya tidak dapat dikembalikan.",
            ],
          },
          {
            heading: "Pengecualian (ditangani kasus per kasus)",
            body: [
              "Kegagalan teknis dari pihak kami yang membuat undangan tidak dapat digunakan dan tidak dapat kami perbaiki dalam waktu wajar.",
              "Pembayaran ganda atau dana terdebit tanpa undangan menjadi aktif.",
              "Dalam kasus seperti ini, kami akan meninjau dan memproses pengembalian yang sesuai.",
            ],
          },
          {
            heading: "Cara mengajukan",
            body: [
              "Kirim email ke alamat kontak di bawah, sertakan kode order dan penjelasan singkat, paling lambat 7 hari sejak pembayaran. Kode order bisa Anda lihat kapan saja di menu Pesanan pada dashboard.",
              "Kami menanggapi setiap permintaan dalam 3 hari kerja.",
            ],
          },
          {
            heading: "Proses pengembalian",
            body: [
              "Bila disetujui, pengembalian dana diproses melalui metode pembayaran asal dalam 7–14 hari kerja, mengikuti waktu proses penyedia pembayaran.",
            ],
          },
        ],
      },
    },
  },
} as const;

export type Copy = typeof copy;
