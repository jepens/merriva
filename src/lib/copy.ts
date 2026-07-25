/**
 * Teks UI berbahasa Indonesia, terpusat (persiapan i18n). Lihat SPEC §9.
 * Seluruh string yang tampil ke pengguna sebaiknya berasal dari sini.
 */
export const copy = {
  brand: {
    name: "Merriva",
    tagline: "Undangan digital untuk setiap momen bahagia.",
  },
  common: {
    loading: "Memuat…",
    error: "Terjadi kesalahan. Silakan coba lagi.",
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
    // Messages
    signupSuccess:
      "Akun dibuat. Kami mengirim tautan verifikasi ke email Anda — klik untuk mengaktifkan akun.",
    invalidCredentials: "Email atau kata sandi salah.",
    signOut: "Keluar",
    genericAuthError: "Gagal memproses permintaan. Silakan coba lagi.",
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
  },
  editor: {
    title: "Edit Undangan",
    address: "Alamat undangan",
    category: "Jenis acara",
    stepsSoon:
      "Formulir pengisian per-langkah (info, jadwal, galeri, dst.) hadir pada tahap berikutnya.",
    backToDashboard: "Kembali ke dashboard",
    notFound: "Undangan tidak ditemukan.",
  },
} as const;

export type Copy = typeof copy;
