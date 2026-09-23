/**
 * Teks UI berbahasa Indonesia, terpusat (persiapan i18n). Lihat SPEC §9.
 * Seluruh string yang tampil ke pengguna sebaiknya berasal dari sini.
 */
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
  },
  auth: {
    // Label & field
    email: "Email",
    password: "Kata sandi",
    passwordNew: "Kata sandi baru",
    passwordConfirm: "Ulangi kata sandi",
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
    footerPrivacy: "Privasi",
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
    errorVerifyLink:
      "Tautan tidak valid atau sudah kedaluwarsa. Silakan minta ulang.",
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
      unlimited: "tanpa batas",
      limitReached:
        "Kuota tamu paket sudah penuh. Tingkatkan paket untuk menambah tamu.",
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
    // Sebar Undangan (SPEC §4.7).
    sebar: {
      title: "Sebar Undangan",
      subtitle: "Kirim link personal ke tiap tamu lewat WhatsApp.",
      back: "Kembali ke undangan",
      templateLabel: "Template pesan",
      templateHint:
        "Gunakan {nama}, {link}, dan {acara} — otomatis terisi untuk tiap tamu.",
      guestListTitle: "Daftar Tamu",
      empty: "Belum ada tamu. Tambahkan tamu lewat menu Tamu terlebih dahulu.",
      noPhone: "Tanpa nomor WA",
      waSend: "Kirim via WA",
      copyMsg: "Salin pesan",
      copied: "Tersalin",
      copyAll: "Salin semua pesan",
      copiedAll: "Semua pesan tersalin",
      sent: "Terkirim",
      countUnit: "tamu",
      defaultTemplate:
        "Kepada Yth. {nama},\n\nDengan penuh sukacita, kami mengundang Anda untuk hadir di {acara}. Doa serta kehadiran Anda sangat berarti bagi kami.\n\nInformasi lengkap & konfirmasi kehadiran dapat diakses melalui tautan berikut:\n{link}\n\nMerupakan suatu kehormatan bila Anda berkenan hadir. Terima kasih 🙏",
    },
  },
  // Checkout / aktivasi paket (SPEC §4.8).
  checkout: {
    title: "Aktifkan Undangan",
    subtitle:
      "Pilih paket untuk mengaktifkan & menyebarkan undangan. Pembayaran aman via QRIS atau Virtual Account.",
    back: "Kembali ke dashboard",
    popular: "Terpopuler",
    choose: "Pilih paket ini",
    redirecting: "Mengalihkan ke pembayaran…",
    securedBy: "Pembayaran diproses oleh Pakasir (QRIS & Virtual Account).",
    perDuration: (months: number) => `Masa aktif ${months} bulan`,
    notPayable: "Undangan ini tidak dapat dibayar saat ini.",
    packageUnavailable: "Paket tidak tersedia. Silakan coba lagi.",
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
      youtube: "Embed video YouTube",
      allThemes: "Semua tema (termasuk premium)",
      standardThemes: "Tema kategori standar",
      noWatermark: "Tanpa watermark Merriva",
      watermark: "Watermark kecil di footer",
      rsvp: "RSVP + ucapan & amplop digital",
    },
  },
  // Halaman cek status pembayaran (M3.3) — poll `transactiondetail`.
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
    reviewBody:
      "Terima kasih. Undangan Anda sedang ditinjau dan akan aktif setelah proses selesai. Hubungi kami bila butuh bantuan.",
    noneTitle: "Belum ada pembayaran",
    noneBody: "Belum ada order pembayaran untuk undangan ini.",
    errorTitle: "Tidak dapat memeriksa status",
    errorBody: "Terjadi kendala saat memeriksa pembayaran. Coba lagi sebentar.",
    timeoutTitle: "Masih menunggu konfirmasi",
    timeoutBody:
      "Konfirmasi belum diterima. Bila Anda sudah membayar, undangan akan aktif otomatis begitu terkonfirmasi — Anda bisa cek lagi atau tutup halaman ini.",
    retry: "Coba lagi",
    back: "Kembali ke dashboard",
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
      limitReached: "Jumlah foto sudah mencapai batas paket.",
      invalidFile: "Berkas harus berupa gambar (JPG, PNG, atau WebP).",
      tooLarge: "Foto terlalu besar setelah dikompres. Coba foto lain.",
      error: "Gagal mengunggah foto. Coba lagi.",
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
    sectionLabels: {
      hero: "Pembuka",
      opening: "Pembuka",
      intro: "Pembuka",
      quote: "Kutipan",
      couple: "Mempelai",
      principals: "Tokoh utama",
      countdown: "Hitung mundur",
      schedule: "Acara",
      event: "Acara",
      rundown: "Agenda",
      gallery: "Galeri",
      story: "Kisah",
      envelope: "Amplop hadiah",
      rsvp: "Ucapan & RSVP",
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
      needActiveTitle: "Aktifkan undangan dulu",
      needActiveBody:
        "Album Momen hanya bisa diaktifkan untuk undangan yang sudah aktif.",
      intro:
        "Kamera bersama untuk tamu — jatah jepret terbatas + filter film + foto terbuka serentak saat reveal. Pilih kapasitas peserta:",
      peserta: (n: number) => `${n} peserta`,
      pesertaUnlimited: "Peserta tak terbatas",
      free: "Gratis",
      freeCta: "Aktifkan gratis",
      freeActivating: "Mengaktifkan…",
      paidCta: "Pilih & bayar",
      redirecting: "Mengalihkan ke pembayaran…",
      securedBy: "Pembayaran diproses oleh Pakasir (QRIS & Virtual Account).",
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
      reviewBody:
        "Pembayaranmu tercatat tetapi album belum terbentuk. Tim kami akan menindaklanjuti — hubungi kami dengan menyebut kode pesanan di atas bila album belum aktif dalam 1x24 jam.",
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
      subtitle: "Kelola peran & status akun. Cari berdasarkan email / nama.",
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
      suspendReason: "Alasan",
      suspendCta: "Suspend",
      reinstateTitle: "Batalkan suspend",
      reinstateHint: "Kembalikan undangan dari status ditangguhkan.",
      reinstateCta: "Reinstate",
      ownerTitle: "Ganti pemilik",
      ownerHint: "Pindahkan undangan (+ order) ke pengguna lain (isi User ID).",
      ownerNewId: "User ID pemilik baru",
      ownerCta: "Pindahkan",
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
      youtube: "YouTube",
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
      user_suspend_self: "Tidak dapat menangguhkan akun Anda sendiri.",
      user_suspend_admin:
        "Turunkan peran admin ke klien dulu sebelum menangguhkan akun.",
      user_suspend_failed: "Gagal menangguhkan akun.",
      user_reinstate_ok: "Penangguhan akun dibatalkan.",
      user_reinstate_failed: "Gagal memulihkan akun.",
      activate_ok: "Undangan berhasil diaktifkan.",
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
      suspend_ok: "Undangan ditangguhkan.",
      suspend_invalid: "Alasan wajib diisi.",
      suspend_failed: "Gagal menangguhkan undangan.",
      reinstate_ok: "Penangguhan dibatalkan.",
      reinstate_not_suspended: "Undangan tidak sedang ditangguhkan.",
      reinstate_failed: "Gagal membatalkan penangguhan.",
      owner_ok: "Kepemilikan diperbarui.",
      owner_invalid: "User ID tidak valid.",
      owner_user_not_found: "Pengguna tujuan tidak ditemukan.",
      owner_failed: "Gagal mengganti pemilik.",
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
      "QRIS & Virtual Account",
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
      soon: "Demo segera hadir",
      tierPremium: "Premium",
      tierStandard: "Standar",
      universal: "Universal",
      filterAll: "Semua",
      filterLabel: "Saring per kategori acara",
      empty: "Belum ada tema pada kategori ini.",
      // Satuan (bukan fungsi) agar bisa dilewatkan sebagai prop ke komponen client
      // tanpa menyeret seluruh objek `copy` ke bundel /tema.
      countUnit: "tema tersedia",
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
          a: "QRIS dan Virtual Account bank, diproses secara aman lewat Pakasir. Kami tidak menyimpan data kartu atau rekening Anda.",
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
          a: "Musik dipilih dari koleksi instrumental bebas royalti bawaan platform. Ini untuk menghindari masalah hak cipta agar undangan Anda aman disebar luas.",
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
          "Delapan tema lintas tiga kategori acara. Buka demo hidup masing-masing tanpa perlu masuk.",
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
          youtube: "Embed video YouTube",
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
      contactEmail: "halo@merriva.id",
      updated: "Terakhir diperbarui 31 Juli 2026",
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
              "Konten undangan: teks, foto, jadwal acara, dan detail lain yang Anda masukkan.",
              "Data tamu: nama, nomor WhatsApp, status kehadiran (RSVP), dan ucapan — baik yang Anda tambahkan maupun yang diisi tamu.",
              "Data teknis: alamat IP, jenis perangkat, dan cookie sesi yang menjaga Anda tetap masuk.",
            ],
          },
          {
            heading: "Cara kami menggunakan data",
            body: [
              "Menyediakan dan mengoperasikan layanan undangan digital Anda.",
              "Memproses pembayaran dan mengirim kuitansi.",
              "Mengirim notifikasi penting, seperti pengingat masa aktif undangan.",
              "Menjaga keamanan layanan dan mencegah penyalahgunaan.",
            ],
          },
          {
            heading: "Pihak ketiga (pemroses data)",
            body: [
              "Supabase — hosting basis data dan autentikasi.",
              "Pakasir — pemroses pembayaran (QRIS & Virtual Account). Kami tidak menyimpan data kartu atau rekening pembayaran Anda.",
              "Resend — pengiriman email transaksional (kuitansi & pengingat).",
              "Cloudflare Turnstile — perlindungan anti-bot pada formulir publik.",
              "Masing-masing memproses data sesuai kebijakan privasinya sendiri.",
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
              "Anda dapat meminta penghapusan data kapan saja.",
            ],
          },
          {
            heading: "Keamanan",
            body: [
              "Akses ke data dibatasi pada tingkat baris (row-level security) sehingga pengguna hanya dapat mengakses datanya sendiri. Seluruh koneksi terenkripsi (HTTPS).",
            ],
          },
          {
            heading: "Hak Anda",
            body: [
              "Anda berhak mengakses, memperbaiki, atau menghapus data pribadi Anda, serta menarik persetujuan. Hubungi kami untuk menggunakan hak-hak ini.",
            ],
          },
          {
            heading: "Tanggung jawab atas data tamu",
            body: [
              "Sebagai pembuat undangan, Anda bertanggung jawab atas data tamu yang Anda unggah dan memastikan Anda berhak membagikannya kepada kami untuk keperluan undangan Anda.",
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
              "Kirim email ke alamat kontak di bawah, sertakan kode order dan penjelasan singkat, paling lambat 7 hari sejak pembayaran.",
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
